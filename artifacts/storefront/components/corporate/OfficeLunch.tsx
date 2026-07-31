"use client";
// Office lunch RSVP: pick your meal within the per-person budget; see the team's
// aggregated picks; admins close the window. Session-gated (401 → PhoneAuth).
// No charge — the server records picks + enforces the budget (422 over_budget).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DISHES } from "@workspace/menu-catalog";
import { ApiError } from "@/lib/apiClient";
import { formatPaise } from "@/lib/format";
import { getOfficeOrder, pickOfficeOrder, closeOfficeOrder, officeWindowOpen } from "@/lib/companyApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";
import { OfficePicker } from "./OfficePicker";

const AVAILABLE = DISHES.filter((d) => d.isAvailable !== false).slice(0, 30);
const fmtWhen = (iso: string) => new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export function OfficeLunch({ id }: { id: number }) {
  const queryClient = useQueryClient();
  const queryKey = ["corporate", "office-lunch", id];

  const orderQuery = useQuery({
    queryKey,
    queryFn: () => getOfficeOrder(id),
  });

  const saveMutation = useMutation({
    mutationFn: (items: { dishId: number; quantity: number }[]) => pickOfficeOrder(id, items),
    onSuccess: (r) => queryClient.setQueryData(queryKey, (old: Awaited<ReturnType<typeof getOfficeOrder>> | undefined) => (old ? { ...old, officeOrder: r.officeOrder } : old)),
  });
  const closeMutation = useMutation({
    mutationFn: () => closeOfficeOrder(id),
    onSuccess: (r) => queryClient.setQueryData(queryKey, (old: Awaited<ReturnType<typeof getOfficeOrder>> | undefined) => (old ? { ...old, officeOrder: r.officeOrder } : old)),
  });

  const needsAuth = orderQuery.error instanceof ApiError && orderQuery.error.status === 401;
  const unavailable = orderQuery.error instanceof ApiError && (orderQuery.error.status === 404 || orderQuery.error.status === 403);

  if (needsAuth) return (<div className="flex flex-col gap-4"><p className="text-sm text-ink-muted">Sign in to pick your meal.</p><PhoneAuth onVerified={() => void orderQuery.refetch()} /></div>);
  if (orderQuery.isPending) return <p className="text-sm text-ink-muted">Loading…</p>;
  if (unavailable) return <p className="text-sm text-ink-muted">This office lunch isn&rsquo;t available to you.</p>;
  if (orderQuery.isError) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-6">
        <p className="text-sm text-ink-muted">Couldn&rsquo;t load this office lunch. Please try again.</p>
        <button type="button" onClick={() => void orderQuery.refetch()} className="shrink-0 text-sm font-semibold text-gold-text hover:underline">Try again</button>
      </div>
    );
  }

  const { officeOrder: order, membership: me } = orderQuery.data;
  const open = officeWindowOpen(order);
  const myPick = order.picks.find((p) => p.userId === me.userId);
  const initial = Object.fromEntries((myPick?.items ?? []).map((i) => [i.dishId, i.quantity]));

  const saveError = saveMutation.isError
    ? (saveMutation.error instanceof ApiError && saveMutation.error.code === "over_budget"
        ? "That's over your budget."
        : (saveMutation.error instanceof ApiError ? saveMutation.error.message : "Couldn't save your pick."))
    : null;
  const closeError = closeMutation.isError ? "Couldn't close picks. Please try again." : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${open ? "bg-sage text-sage-foreground" : "bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-ink-muted"}`}>{open ? "Picks open" : order.status}</span>
        <h1 className="text-xl font-semibold tracking-tight text-ink">{order.title}</h1>
        <div className="flex flex-col gap-1 text-sm text-ink-muted">
          <p>{fmtWhen(order.scheduledFor)} · {order.address.line}, {order.address.city}</p>
          <p>Budget <span className="tabular font-medium text-ink">{formatPaise(order.perEmployeeBudgetPaise)}</span> / person</p>
        </div>
      </div>

      {saveError && <p role="alert" className="text-sm font-medium text-[var(--danger)]">{saveError}</p>}
      {closeError && <p role="alert" className="text-sm font-medium text-[var(--danger)]">{closeError}</p>}

      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink">Pick your meal</h2>
        {open
          ? <div className="mt-3 rounded-2xl border border-line bg-surface p-6"><OfficePicker dishes={AVAILABLE} initial={initial} budgetPaise={order.perEmployeeBudgetPaise} busy={saveMutation.isPending} onSave={(items) => saveMutation.mutate(items)} /></div>
          : <p className="mt-3 text-sm text-ink-muted">The pick window has closed.</p>}
      </div>

      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink">Team picks <span className="text-sm font-normal text-ink-muted">({order.picks.length})</span></h2>
        <div className="mt-3 rounded-2xl border border-line bg-surface p-6">
          <div className="flex items-center justify-between gap-2 border-b border-line pb-4">
            <span className="text-sm font-medium text-ink">Aggregated total</span>
            <span className="tabular text-base font-semibold text-ink">{formatPaise(order.totalPaise)}</span>
          </div>
          {order.picks.length === 0 ? <p className="pt-4 text-sm text-ink-muted">No picks yet.</p> : (
            <ul className="mt-4 flex flex-col gap-4">
              {order.picks.map((p) => (
                <li key={p.userId} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{p.userName}</p>
                    <p className="mt-0.5 truncate text-xs text-ink-faint">{p.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</p>
                  </div>
                  <span className="tabular shrink-0 text-sm text-ink-muted">{formatPaise(p.totalPaise)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {me?.role === "admin" && open && (
        <button type="button" onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending} className="self-center text-sm font-semibold text-[var(--danger)] transition-opacity hover:opacity-80 disabled:opacity-40">Close picks</button>
      )}
    </div>
  );
}
