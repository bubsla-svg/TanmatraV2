import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { API_BASE } from "@/lib/apiBase";
import { RotateCcw, Check, X, CreditCard, AlertTriangle } from "lucide-react";

interface RefundRow {
  id: number;
  orderId: number;
  externalOrderId: string;
  amountPaise: number;
  status: string;
  reason: string | null;
  razorpayPaymentId: string | null;
  razorpayRefundId: string | null;
  requestedBy: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  note: string | null;
  createdAt: string;
}

const apiBase = API_BASE;

function readToken(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("rd-admin-token") ?? "";
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return iso;
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function RefundsPanel() {
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = useCallback((): Record<string, string> => {
    const t = readToken();
    return t ? { "x-admin-token": t } : {};
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${apiBase}/admin/refunds?status=pending`, {
        credentials: "include",
        headers: headers(),
      });
      if (r.status === 403) {
        setError("Ops scope required — paste an admin token in a panel above.");
        setRefunds([]);
        return;
      }
      if (!r.ok) {
        setError(`Failed to load (${r.status})`);
        return;
      }
      const j = (await r.json()) as { refunds: RefundRow[] };
      setRefunds(j.refunds ?? []);
    } catch (err) {
      setError(String((err as Error).message ?? err));
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (
    refund: RefundRow,
    action: "approve" | "reject",
  ) => {
    const promptLabel =
      action === "approve"
        ? "Optional note for approving this refund:"
        : "Optional note for rejecting this refund:";
    const note =
      typeof window === "undefined" ? null : window.prompt(promptLabel) ?? undefined;
    // window.prompt returns null when cancelled — abort the whole action.
    if (typeof window !== "undefined" && note === undefined) return;

    setBusyId(refund.id);
    try {
      const r = await fetch(`${apiBase}/admin/refunds/${refund.id}/${action}`, {
        method: "POST",
        credentials: "include",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ note: note || undefined }),
      });
      if (!r.ok) {
        let message = `Failed (${r.status})`;
        try {
          const data = (await r.json()) as { error?: string; message?: string };
          message = data.error ?? data.message ?? message;
        } catch {
          const t = await r.text().catch(() => "");
          if (t) message = t;
        }
        toast.error(message);
        return;
      }
      // Success — drop the row from the pending list.
      setRefunds((prev) => prev.filter((x) => x.id !== refund.id));
      toast.success(
        `Refund for ${refund.externalOrderId} ${
          action === "approve" ? "approved" : "rejected"
        }.`,
      );
    } catch (err) {
      toast.error(String((err as Error).message ?? err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Refunds — pending approval
            {refunds.length > 0 ? (
              <Badge variant="outline" className="text-[10px]">
                {refunds.length}
              </Badge>
            ) : null}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px]"
            onClick={() => void load()}
            disabled={loading}
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            {loading ? "Loading…" : "Refresh"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        {error ? <p className="text-[11px] text-orange-400">{error}</p> : null}
        {!error && refunds.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            No refunds awaiting approval.
          </p>
        ) : (
          refunds.map((r) => {
            const canRefund = !!r.razorpayPaymentId;
            const rowBusy = busyId === r.id;
            return (
              <div
                key={r.id}
                className="space-y-1.5 rounded-md border border-border/40 p-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-mono font-medium">
                    {r.externalOrderId}
                  </div>
                  <div className="font-bold">
                    {formatCurrency(r.amountPaise)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {canRefund ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    >
                      payment captured
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-red-500/10 text-red-400 border-red-500/30"
                    >
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      no captured payment
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {timeAgo(r.createdAt)}
                  </span>
                </div>
                {r.reason ? (
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    {r.reason}
                  </p>
                ) : null}
                <div className="flex gap-1 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] flex-1"
                    onClick={() => void decide(r, "approve")}
                    disabled={rowBusy || !canRefund}
                    title={
                      canRefund
                        ? "Issue the refund against the captured payment"
                        : "Can't refund without a captured payment (no razorpayPaymentId)"
                    }
                  >
                    <Check className="w-3 h-3 mr-1" />
                    {rowBusy ? "Working…" : "Approve"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px] flex-1"
                    onClick={() => void decide(r, "reject")}
                    disabled={rowBusy}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Reject
                  </Button>
                </div>
                {!canRefund ? (
                  <p className="text-[10px] text-muted-foreground italic">
                    A refund can't be issued without a captured payment.
                  </p>
                ) : null}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
