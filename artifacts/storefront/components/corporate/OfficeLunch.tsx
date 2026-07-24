"use client";
// Office lunch RSVP: pick your meal within the per-person budget; see the team's
// aggregated picks; admins close the window. Session-gated (401 → PhoneAuth).
// No charge — the server records picks + enforces the budget (422 over_budget).
import { useCallback, useEffect, useState } from "react";
import { DISHES } from "@workspace/menu-catalog";
import { ApiError } from "@/lib/apiClient";
import { formatPaise } from "@/lib/format";
import { getOfficeOrder, pickOfficeOrder, closeOfficeOrder, officeWindowOpen, type OfficeOrder, type CompanyMember } from "@/lib/companyApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";
import { OfficePicker } from "./OfficePicker";

const AVAILABLE = DISHES.filter((d) => d.isAvailable !== false).slice(0, 30);
const fmtWhen = (iso: string) => new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export function OfficeLunch({ id }: { id: number }) {
  const [order, setOrder] = useState<OfficeOrder | null>(null);
  const [me, setMe] = useState<CompanyMember | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  const load = useCallback(async () => {
    try { const r = await getOfficeOrder(id); setOrder(r.officeOrder); setMe(r.membership); setState("ready"); setNeedsAuth(false); }
    catch (e) { if (e instanceof ApiError && e.status === 401) setNeedsAuth(true); else setState("missing"); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  async function save(items: { dishId: number; quantity: number }[]) {
    setBusy(true); setError(null);
    try { const { officeOrder } = await pickOfficeOrder(id, items); setOrder(officeOrder); }
    catch (e) { setError(e instanceof ApiError && e.code === "over_budget" ? "That's over your budget." : (e instanceof ApiError ? e.message : "Couldn't save your pick.")); }
    finally { setBusy(false); }
  }
  async function close() {
    setBusy(true);
    try { const { officeOrder } = await closeOfficeOrder(id); setOrder(officeOrder); } catch { /* soft */ } finally { setBusy(false); }
  }

  if (needsAuth) return (<div className="flex flex-col gap-4"><p className="text-sm text-ink-muted">Sign in to pick your meal.</p><PhoneAuth onVerified={() => void load()} /></div>);
  if (state === "loading") return <p className="text-sm text-ink-muted">Loading…</p>;
  if (state === "missing" || !order) return <p className="text-sm text-ink-muted">This office lunch isn&rsquo;t available to you.</p>;

  const open = officeWindowOpen(order);
  const myPick = me ? order.picks.find((p) => p.userId === me.userId) : undefined;
  const initial = Object.fromEntries((myPick?.items ?? []).map((i) => [i.dishId, i.quantity]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${open ? "bg-sage text-sage-foreground" : "bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-ink-muted"}`}>{open ? "Picks open" : order.status}</span>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-ink">{order.title}</h1>
        <p className="mt-1 text-sm text-ink-muted">{fmtWhen(order.scheduledFor)} · {order.address.line}, {order.address.city}</p>
        <p className="text-xs text-ink-faint">Budget {formatPaise(order.perEmployeeBudgetPaise)} / person</p>
      </div>

      {error && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{error}</p>}

      <div>
        <h2 className="text-sm font-semibold text-ink">Pick your meal</h2>
        {open
          ? <div className="mt-3"><OfficePicker dishes={AVAILABLE} initial={initial} budgetPaise={order.perEmployeeBudgetPaise} busy={busy} onSave={save} /></div>
          : <p className="mt-2 text-sm text-ink-muted">The pick window has closed.</p>}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-ink">Team picks ({order.picks.length})</h2>
        <p className="text-xs text-ink-faint">Aggregated total: {formatPaise(order.totalPaise)}</p>
        {order.picks.length === 0 ? <p className="mt-2 text-sm text-ink-muted">No picks yet.</p> : (
          <ul className="mt-3 flex flex-col gap-2">
            {order.picks.map((p) => (
              <li key={p.userId} className="rounded-xl border border-line bg-surface px-4 py-2.5">
                <div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-medium text-ink">{p.userName}</p><span className="tabular shrink-0 text-xs text-ink-muted">{formatPaise(p.totalPaise)}</span></div>
                <p className="mt-0.5 truncate text-xs text-ink-faint">{p.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {me?.role === "admin" && open && (
        <button type="button" onClick={close} disabled={busy} className="self-start rounded-xl border border-line px-5 py-2.5 text-sm font-semibold text-ink hover:border-line-strong disabled:opacity-60">Close picks</button>
      )}
    </div>
  );
}
