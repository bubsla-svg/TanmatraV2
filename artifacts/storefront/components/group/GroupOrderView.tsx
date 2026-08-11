"use client";
// Group-order view: anyone with the code sees it (public read); the host closes
// & pays for everyone. Close merges the group's picks into the local cart and
// routes to /checkout (reusing the existing money-path). Adding picks happens on
// /menu?group=CODE (already live via AddToCart.tsx's GroupAdd).
//
// DEF-RECON-GROUPORDER-001: this is a straight port of a pre-Stitch-74 version
// of this file (quarantine/components/group/GroupOrderView.tsx) — the full
// lifecycle (get/removeLine/closeGroup) was already grounded and tested, and
// its token usage already matches the current design system, so there was
// nothing to redesign, only to restore. Group CREATION has no client entry
// point anywhere in the app (lib/groupOrdersApi.ts's own comment documents
// that as a deferred concern, not a regression this fix introduces) — out of
// scope here; a code getting to this screen at all still requires one to exist.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DISHES } from "@workspace/menu-catalog";
import { ApiError } from "@/lib/apiClient";
import { formatPaise } from "@/lib/format";
import { addLine } from "@/lib/cartStore";
import { useCart } from "@/components/cart/CartProvider";
import { Button } from "@/components/ui/button";
import { getAuthUser } from "@/lib/api";
import { getGroup, removeLine, closeGroup, groupSubtotalPaise } from "@/lib/groupOrdersApi";

export function GroupOrderView({ code }: { code: string }) {
  const router = useRouter();
  const { cart, setCart } = useCart();
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryKey = ["group-order", code];
  const {
    data: group,
    isPending,
    isError,
    error: loadError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => getGroup(code).then((r) => r.group),
    retry: (failureCount, e) => (e instanceof ApiError && e.status === 404 ? false : failureCount < 1),
  });

  useEffect(() => {
    getAuthUser().then((r) => setUserId(r.user?.id ?? null)).catch(() => {});
  }, []);

  const missing = isError && loadError instanceof ApiError && loadError.status === 404;
  const isHost = !!group && !!userId && group.hostUserId === userId;

  async function remove(lineId: string) {
    if (!group) return;
    setBusy(true); setError(null);
    try { queryClient.setQueryData(queryKey, (await removeLine(code, lineId)).group); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Couldn't remove that item."); }
    finally { setBusy(false); }
  }

  async function closeAndCheckout() {
    if (!group) return;
    setBusy(true); setError(null);
    try {
      const { group: closed } = await closeGroup(code);
      queryClient.setQueryData(queryKey, closed);
      let next = cart, skipped = 0;
      for (const l of closed.items) {
        const dish = DISHES.find((d) => d.id === l.dishId);
        if (!dish) { skipped++; continue; }
        for (let i = 0; i < l.quantity; i++) next = addLine(next, { dishId: dish.id, kind: "dish", slug: dish.slug, name: dish.name, pricePaise: l.unitPrice });
      }
      setCart(next);
      if (skipped > 0) setError(`${skipped} item(s) couldn't be transferred.`);
      // The plain /checkout route now defaults to the plan flow (redirects to
      // /plans without a `plan` id) — the guest dish-cart checkout needs the
      // explicit mode, same as CartDrawer's own Checkout link.
      router.push("/checkout?mode=alacarte");
    } catch (e) { setError(e instanceof ApiError ? e.message : "Couldn't close the group."); setBusy(false); }
  }

  if (isPending) return <p className="py-10 text-center text-sm text-ink-muted">Loading group…</p>;

  if (missing) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-10 text-center">
        <p className="text-sm font-semibold text-ink">Group {code} was not found</p>
        <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-ink-faint">It may have been closed, or the code is incorrect.</p>
      </div>
    );
  }

  if (isError || !group) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-10 text-center">
        <p className="text-sm font-semibold text-[var(--danger)]">Couldn&rsquo;t load this group order</p>
        <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-ink-faint">Something went wrong on our end — this usually clears up on retry.</p>
        <button type="button" onClick={() => void refetch()} disabled={isFetching} className="mt-4 rounded-lg border border-line px-5 py-2 text-xs font-semibold text-gold-text transition-opacity hover:opacity-80 disabled:opacity-50">
          {isFetching ? "Retrying…" : "Try again"}
        </button>
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
