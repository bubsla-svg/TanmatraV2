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
import { Button } from "@/components/ui/button";
import { getAuthUser } from "@/lib/api";
import { getGroup, removeLine, closeGroup, groupSubtotalPaise, type GroupOrder } from "@/lib/groupOrdersApi";

export function GroupOrderView({ code }: { code: string }) {
  const router = useRouter();
  const { cart, setCart } = useCart();
  const [group, setGroup] = useState<GroupOrder | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setState("loading");
    getGroup(code).then((r) => { setGroup(r.group); setState("ready"); })
      .catch((e) => setState(e instanceof ApiError && e.status === 404 ? "missing" : "error"));
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
        for (let i = 0; i < l.quantity; i++) next = addLine(next, { dishId: dish.id, kind: "dish", slug: dish.slug, name: dish.name, pricePaise: l.unitPrice });
      }
      setCart(next);
      if (skipped > 0) setError(`${skipped} item(s) couldn't be transferred.`);
      router.push("/checkout");
    } catch (e) { setError(e instanceof ApiError ? e.message : "Couldn't close the group."); setBusy(false); }
  }

  if (state === "loading") return <p className="py-10 text-center text-sm text-ink-muted">Loading group…</p>;

  if (state === "missing") {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-10 text-center">
        <p className="text-sm font-semibold text-ink">Group {code} was not found</p>
        <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-ink-faint">It may have been closed, or the code is incorrect.</p>
      </div>
    );
  }

  if (state === "error" || !group) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-10 text-center">
        <p className="text-sm font-semibold text-[var(--danger)]">Couldn&rsquo;t load this group order</p>
        <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-ink-faint">Something went wrong on our end — this usually clears up on retry.</p>
        <button type="button" onClick={load} className="mt-4 rounded-lg border border-line px-5 py-2 text-xs font-semibold text-gold-text transition-opacity hover:opacity-80">Try again</button>
      </div>
    );
  }

  const closed = group.status === "closed";
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-line bg-surface p-6 text-center">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <p className="tabular text-xl font-bold tracking-widest text-ink">{group.code}</p>
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase ${closed ? "bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-ink-muted" : "bg-sage text-sage-foreground"}`}>{group.status}</span>
        </div>
        <p className="mt-2 text-sm text-ink-muted">Hosted by {group.hostName} · {group.participants.length} participant{group.participants.length === 1 ? "" : "s"}</p>
        <p className="mx-auto mt-3 max-w-xs text-xs leading-relaxed text-ink-faint">Share code <span className="font-semibold text-ink-muted">{group.code}</span>. Anyone with the link can add their own items — the host closes the order and pays for everyone.</p>
      </div>

      {error && <p role="alert" className="rounded-xl border border-line bg-surface px-4 py-2.5 text-xs font-medium text-[var(--danger)]">{error}</p>}

      {group.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center">
          <p className="text-sm text-ink-muted">No items yet. Share the code with friends to get started.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {group.items.map((l) => (
            <li key={l.lineId} className="flex items-start justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{l.name}</p>
                <p className="mt-0.5 text-xs text-ink-faint">Added by {l.addedByName} · Qty {l.quantity}</p>
                {!closed && (isHost || l.addedBy === userId) && (
                  <button type="button" onClick={() => remove(l.lineId)} disabled={busy} aria-label="Remove" className="mt-1.5 text-xs font-medium text-ink-faint hover:text-[var(--danger)] disabled:opacity-50">Remove</button>
                )}
              </div>
              <span className="tabular shrink-0 pt-0.5 text-sm font-medium text-ink">{formatPaise(l.unitPrice * l.quantity)}</span>
            </li>
          ))}
        </ul>
      )}

      {group.items.length > 0 && (
        <div className="flex items-baseline justify-between border-t border-line pt-4">
          <p className="text-sm font-medium text-ink-muted">Subtotal</p>
          <p className="tabular text-lg font-bold text-ink">{formatPaise(groupSubtotalPaise(group))}</p>
        </div>
      )}

      {closed ? (
        <p className="rounded-xl border border-line bg-surface px-4 py-3 text-center text-sm text-ink-muted">This group order is closed.</p>
      ) : isHost ? (
        <div>
          <Button type="button" onClick={closeAndCheckout} disabled={busy} shape="xl" size="fluid" className="w-full px-6 py-3.5 font-semibold disabled:opacity-60">{busy ? "Closing…" : "Close & checkout"}</Button>
          <p className="mt-2 text-center text-[11px] text-ink-faint">Only you (the host) can close this order and pay for everyone.</p>
        </div>
      ) : (
        <Button asChild shape="xl" size="fluid" className="block w-full text-center px-6 py-3.5 font-semibold">
          <Link href={`/menu?group=${group.code}`}>Add your items</Link>
        </Button>
      )}
    </div>
  );
}
