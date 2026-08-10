"use client";
// One-tap add. Normally mutates the LOCAL cart (§4.1 conversion lever). But when
// the URL carries ?group=CODE (an invitee arriving from a group order), the add
// POSTs the pick to the shared group instead — the host pays at close.
import type { DishData } from "@workspace/menu-catalog";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { addLine, qtyOf, setQty } from "@/lib/cartStore";
import { useCart } from "@/components/cart/CartProvider";
import { ApiError } from "@/lib/apiClient";
import { addItem } from "@/lib/groupOrdersApi";

// `isAvailable` is optional here (unlike DishData, where it's required): most
// call sites hand this component a full DishData and get it for free, but a
// few (InstantPlanPreview) build a narrower literal with no availability
// concept at all. `undefined` reads as available, same convention as
// cartStore's `opts.isAvailable` and catalog.ts's `!== false` checks.
type Dish = Pick<DishData, "id" | "slug" | "name" | "price"> & { isAvailable?: boolean };
const GROUP_CODE = /^[0-9A-Za-z]{6,8}$/;

export function AddToCart({ dish }: { dish: Dish }) {
  return (
    <Suspense fallback={dish.isAvailable === false ? <UnavailableAdd /> : <CartAdd dish={dish} />}>
      <AddToCartResolved dish={dish} />
    </Suspense>
  );
}

function AddToCartResolved({ dish }: { dish: Dish }) {
  const group = useSearchParams().get("group");
  // D-19: a paused dish is refused before either destination — the shared
  // group order (server-resolved) and the local cart both get the same
  // "Back soon" state, since adding to a group order the host can't
  // actually fulfil is the same contradiction as adding it locally.
  if (dish.isAvailable === false) return <UnavailableAdd />;
  if (group && GROUP_CODE.test(group)) return <GroupAdd code={group} dish={dish} />;
  return <CartAdd dish={dish} />;
}

/** D-19: the "Back soon" face — disabled, labeled, same footprint as Add so
 *  no layout shift when a dish's availability flips. */
function UnavailableAdd() {
  return (
    <button
      type="button"
      disabled
      aria-label="Back soon — kitchen has paused this dish"
      className="min-h-11 rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-semibold text-ink-muted opacity-70"
    >
      Back soon
    </button>
  );
}

/** Add my pick to the shared group order (server resolves price + safety). */
function GroupAdd({ code, dish }: { code: string; dish: Dish }) {
  const [status, setStatus] = useState<"idle" | "adding" | "added" | "auth" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  async function add() {
    setStatus("adding"); setMsg(null);
    try {
      await addItem(code, dish.id);
      setStatus("added");
      setTimeout(() => setStatus((s) => (s === "added" ? "idle" : s)), 1800);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setStatus("auth");
      else if (e instanceof ApiError && e.code === "safety_block") { setStatus("error"); setMsg("Blocked by your diet preferences"); }
      else { setStatus("error"); setMsg(e instanceof ApiError ? e.message : "Couldn't add to the group"); }
    }
  }

  if (status === "auth") {
    return (
      <Link href={`/login?next=${encodeURIComponent(`/menu?group=${code}`)}`} className="min-h-11 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink">
        Sign in to add
      </Link>
    );
  }
  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); void add(); }}
        disabled={status === "adding"}
        className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {status === "adding" ? "Adding…" : status === "added" ? "Added ✓" : "Add to group"}
      </button>
      {status === "error" && msg && <span className="max-w-32 text-right text-[10px] text-[var(--danger)]" title={msg}>{msg}</span>}
    </div>
  );
}

/** One-tap Add → in-place qty stepper (§4.1). Local cart; server re-prices at /orders. */
function CartAdd({ dish }: { dish: Dish }) {
  const { cart, setCart } = useCart();
  const qty = qtyOf(cart, dish.id, "dish");
  const line = { dishId: dish.id, kind: "dish" as const, slug: dish.slug, name: dish.name, pricePaise: dish.price };

  if (qty === 0) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          // AddToCartResolved already refuses to render this button for an
          // unavailable dish — this is cartStore's own backstop (D-19),
          // never the primary gate.
          setCart(addLine(cart, line, { isAvailable: dish.isAvailable }));
        }}
        className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
      >
        Add
      </button>
    );
  }

  return (
    <div className="flex items-center rounded-lg border border-line-strong bg-surface" role="group" aria-label={`${dish.name} quantity`}>
      {/* Same pressed feedback as the Add button above and the CartDrawer /
          checkout steppers — this stepper is the qty>0 face of every card in
          the browse-to-cart flow, and it was the one control giving zero
          tactile response. */}
      <button type="button" aria-label="Decrease quantity" onClick={(e) => { e.preventDefault(); setCart(setQty(cart, dish.id, "dish", qty - 1)); }} className="min-h-11 min-w-11 px-3 text-lg font-semibold text-ink transition-transform active:scale-[0.98]">
        −
      </button>
      <span aria-live="polite" className="tabular min-w-6 text-center text-sm font-semibold text-ink">{qty}</span>
      <button type="button" aria-label="Increase quantity" onClick={(e) => { e.preventDefault(); setCart(setQty(cart, dish.id, "dish", qty + 1)); }} className="min-h-11 min-w-11 px-3 text-lg font-semibold text-ink transition-transform active:scale-[0.98]">
        +
      </button>
    </div>
  );
}
