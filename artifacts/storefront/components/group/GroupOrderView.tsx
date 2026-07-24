"use client";
// Group-order view: anyone with the code sees it (public read); the host closes
// & pays for everyone. Close merges the group's picks into the local cart and
// routes to /checkout (reusing the existing money-path). Adding picks happens on
// /menu?group=CODE (deferred).
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DISHES } from "@workspace/menu-catalog";
import { ApiError } from "@/lib/apiClient";
import { formatPaise } from "@/lib/format";
import { addLine } from "@/lib/cartStore";
import { useCart } from "@/components/cart/CartProvider";
import { getAuthUser } from "@/lib/api";
import { getGroup, removeLine, closeGroup, groupSubtotalPaise, type GroupOrder } from "@/lib/groupOrdersApi";

export function GroupOrderView({ code }: { code: string }) {
  const router = useRouter();
  const { cart, setCart } = useCart();
  const [group, setGroup] = useState<GroupOrder | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getGroup(code).then((r) => { setGroup(r.group); setState("ready"); })
      .catch((e) => setState(e instanceof ApiError && e.status === 404 ? "missing" : "ready"));
    getAuthUser().then((r) => setUserId(r.user?.id ?? null)).catch(() => {});
  }, [code]);
  useEffect(() => { load(); }, [load]);

  const isHost = !!group && !!userId && group.hostUserId === userId;

  async function remove(lineId: string) {
    if (!group) return;
    setBusy(true); setError(null);
    try { setGroup((await removeLine(code, lineId)).group); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Couldn't remove that item."); }
    finally { setBusy(false); }
  }

  async function closeAndCheckout() {
    if (!group) return;
    setBusy(true); setError(null);
    try {
      const { group: closed } = await closeGroup(code);
      let next = cart, skipped = 0;
      for (const l of closed.items) {
        const dish = DISHES.find((d) => d.id === l.dishId);
        if (!dish) { skipped++; continue; }
        for (let i = 0; i < l.quantity; i++) next = addLine(next, { dishId: dish.id, slug: dish.slug, name: dish.name, pricePaise: l.unitPrice });
      }
      setCart(next);
      if (skipped > 0) setError(`${skipped} item(s) couldn't be transferred.`);
      router.push("/checkout");
    } catch (e) { setError(e instanceof ApiError ? e.message : "Couldn't close the group."); setBusy(false); }
  }

  if (state === "loading") return <p className="text-sm text-ink-muted">Loading group…</p>;
  if (state === "missing" || !group) return <p className="text-sm text-ink-muted">Group {code} was not found — it may have been closed or the code is incorrect.</p>;

  const closed = group.status === "closed";
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="tabular text-lg font-bold tracking-widest text-ink">{group.code}</p>
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase ${closed ? "bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-ink-muted" : "bg-sage text-sage-foreground"}`}>{group.status}</span>
        </div>
        <p className="mt-1 text-sm text-ink-muted">Hosted by {group.hostName} · {group.participants.length} participant{group.participants.length === 1 ? "" : "s"}</p>
        <p className="mt-3 text-xs leading-relaxed text-ink-faint">Share code <span className="font-semibold text-ink-muted">{group.code}</span>. Anyone with the link can add their own items — the host closes the order and pays for everyone.</p>
      </div>

      {error && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{error}</p>}

      {group.items.length === 0 ? (
        <p className="text-sm text-ink-muted">No items yet. Share the code with friends to get started.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {group.items.map((l) => (
            <li key={l.lineId} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{l.name}</p>
                <p className="text-xs text-ink-faint">Added by {l.addedByName} · Qty {l.quantity}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="tabular text-sm font-semibold text-ink">{formatPaise(l.unitPrice * l.quantity)}</span>
                {!closed && (isHost || l.addedBy === userId) && (
                  <button type="button" onClick={() => remove(l.lineId)} disabled={busy} aria-label="Remove" className="text-xs text-ink-faint hover:text-[var(--danger)] disabled:opacity-50">Remove</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {group.items.length > 0 && <p className="tabular text-right text-sm font-semibold text-ink">Subtotal {formatPaise(groupSubtotalPaise(group))}</p>}

      {closed ? (
        <p className="text-center text-sm text-ink-muted">This group order is closed.</p>
      ) : isHost ? (
        <div>
          <button type="button" onClick={closeAndCheckout} disabled={busy} className="w-full rounded-xl bg-gold px-6 py-3 text-sm font-semibold text-[var(--gold-ink)] disabled:opacity-60">{busy ? "Closing…" : "Close & checkout"}</button>
          <p className="mt-2 text-center text-[11px] text-ink-faint">Only you (the host) can close this order and pay for everyone.</p>
        </div>
      ) : (
        <Link href={`/menu?group=${group.code}`} className="w-full rounded-xl bg-gold px-6 py-3 text-center text-sm font-semibold text-[var(--gold-ink)]">Add your items</Link>
      )}
    </div>
  );
}
