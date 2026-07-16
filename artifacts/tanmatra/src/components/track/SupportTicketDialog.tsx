import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/apiBase";
import { CheckCircle2, LifeBuoy } from "lucide-react";

interface SupportTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderDisplayId: string;
  orderServerId: number | undefined;
}

export default function SupportTicketDialog({
  open,
  onOpenChange,
  orderDisplayId,
  orderServerId,
}: SupportTicketDialogProps) {
  const [subject, setSubject] = useState(`Help with order ${orderDisplayId}`);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) {
      setSubject(`Help with order ${orderDisplayId}`);
      setBody("");
      setError(null);
      setDone(false);
      setSubmitting(false);
    }
  }, [open, orderDisplayId]);

  const trimmedSubject = subject.trim();
  const trimmedBody = body.trim();
  const canSubmit = trimmedSubject.length > 0 && trimmedBody.length > 0 && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const base = API_BASE;
      const payload: {
        subject: string;
        body: string;
        orderId?: number;
      } = { subject: trimmedSubject, body: trimmedBody };
      if (orderServerId && orderServerId > 0) payload.orderId = orderServerId;
      const r = await fetch(`${base}/support-tickets`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        let msg = `Could not send (${r.status})`;
        try {
          const data = (await r.json()) as { error?: string };
          if (data?.error) {
            msg =
              r.status === 401
                ? "Please sign in to contact our care team."
                : data.error;
          }
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your message");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="tnm2 nn bg-black/60"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={() => onOpenChange(false)}
    >
      <div
        className="card"
        style={{ maxWidth: 448, width: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <>
            <div className="tt fx ac gap8" style={{ color: "var(--color-stone-0)" }}>
              <CheckCircle2 className="w-5 h-5" style={{ color: "var(--sage)" }} />
              Care team is on it
            </div>
            <div className="fine mt6">
              Thanks — we've logged your request for order{" "}
              <span className="mono" style={{ fontSize: 12 }}>{orderDisplayId}</span>. Our
              care team will reply by email shortly.
            </div>
            <div className="fx gap8 mt16" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-p" onClick={() => onOpenChange(false)}>Close</button>
            </div>
          </>
        ) : (
          <>
            <div className="tt fx ac gap8" style={{ color: "var(--color-stone-0)" }}>
              <LifeBuoy className="w-5 h-5" style={{ color: "var(--safb)" }} />
              Need help with this order?
            </div>
            <div className="fine mt6">
              Tell us what's going on with order{" "}
              <span className="mono" style={{ fontSize: 12 }}>{orderDisplayId}</span> and
              our care team will get back to you.
            </div>
            <div className="col gap12 mt12">
              <div className="col gap6">
                <label htmlFor="ticket-subject" className="lab">
                  Subject
                </label>
                <input
                  id="ticket-subject"
                  className="inp"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={200}
                  disabled={submitting}
                />
              </div>
              <div className="col gap6">
                <label htmlFor="ticket-body" className="lab">
                  How can we help?
                </label>
                <textarea
                  id="ticket-body"
                  className="inp"
                  style={{ height: "auto", minHeight: 110, padding: "12px 14px", alignItems: "flex-start", display: "block" }}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                  maxLength={8000}
                  placeholder="Describe the issue — missing item, late delivery, allergen concern, etc."
                  disabled={submitting}
                />
              </div>
              {error && (
                <p className="fine" style={{ color: "var(--dgr)" }} role="alert">
                  {error}
                </p>
              )}
            </div>
            <div className="fx gap8 mt16" style={{ justifyContent: "flex-end" }}>
              <button
                className={`btn btn-g${submitting ? " dis" : ""}`}
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                className={`btn btn-p${!canSubmit ? " dis" : ""}`}
                onClick={submit}
                disabled={!canSubmit}
              >
                {submitting ? "Sending…" : "Send to care team"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
