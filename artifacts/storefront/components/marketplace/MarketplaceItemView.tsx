"use client";
// Marketplace item detail + BUY (real money-path). Browse is public; the
// purchase is session-gated (401 → PhoneAuth) and settles via the shared
// Razorpay path (payForMarketplace). Ships separately, or bundles DELIVERY with
// a recent order (still its own paid order — bundleWithOrderId only links delivery).
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Circle, Minus, Plus } from "lucide-react";
import { ApiError } from "@/lib/apiClient";
import { formatPaise } from "@/lib/format";
import { createRazorpayAdapter } from "@/lib/razorpayAdapter";
import { getItem, payForMarketplace, type MarketplaceItem } from "@/lib/marketplaceApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";
import { Button } from "@/components/ui/button";
import { BundlePicker } from "./BundlePicker";
import { useCart } from "@/components/cart/CartProvider";
import { addOrUpdateQty } from "@/lib/cartStore";

export function MarketplaceItemView({ slug }: { slug: string }) {
  const { cart, setCart } = useCart();
  const [item, setItem] = useState<MarketplaceItem | null>(null);
  const [qty, setQty] = useState(1);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [mode, setMode] = useState<"ship" | "bundle">("ship");
  const [bundleId, setBundleId] = useState<number | null>(null);

  const load = useCallback(() => {
    getItem(slug).then((r) => setItem(r.item)).catch((e) => {
      if (e instanceof ApiError && e.status === 404) setMissing(true);
      else setError("Couldn't load this product.");
    });
  }, [slug]);
  useEffect(() => { load(); }, [load]);

  async function buy() {
    if (!item) return;
    if (mode === "bundle" && bundleId === null) { setError("Pick an order to bundle delivery with."); return; }
    setBusy(true); setError(null);
    try {
      await payForMarketplace(
        [{ itemId: item.id, qty }],
        createRazorpayAdapter(),
        mode === "bundle" ? { deliveryMode: "bundle_with_meal", bundleWithOrderId: bundleId } : {},
      );
      setPlaced(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setNeedsAuth(true);
      else if (e instanceof ApiError && e.status === 422) setError(e.message);
      else setError(e instanceof ApiError ? e.message : "Payment didn't complete — you can try again.");
    } finally { setBusy(false); }
  }

  if (missing) return <p className="text-sm text-ink-muted">Item not found. <Link href="/marketplace" className="font-medium text-gold-text hover:underline">Back to marketplace</Link>.</p>;
  if (!item) return <p className="text-sm text-ink-muted">{error ?? "Loading…"}</p>;
  if (placed) return (
    <div className="rounded-2xl border border-line bg-surface p-6 text-center">
      <p className="text-sm font-semibold text-ink">Order placed &amp; paid</p>
      <p className="mt-1 text-sm text-ink-muted">Your {item.name} is on its way. See it in your <Link href="/account/orders" className="font-medium text-gold-text hover:underline">orders</Link>.</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="aspect-square overflow-hidden rounded-2xl border border-line bg-surface-raised">
        {item.image && (
          // eslint-disable-next-line @next/next/no-img-element -- unoptimized <img>, see next.config
          <img src={item.image} alt="" className="h-full w-full object-cover" />
        )}
      </div>

      {item.badges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {item.badges.map((b) => (
            <span key={b} className="rounded-full border border-line px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink">
              {b}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-ink">{item.name}</h1>
        <p className="text-sm text-ink-muted">{item.description}</p>
      </div>

      <p className="tabular flex items-end gap-2 text-2xl font-bold text-ink">
        {formatPaise(item.pricePaise)}
        {(item.weightLabel || item.supplierName) && (
          <span className="pb-0.5 text-xs font-normal text-ink-faint">
            {[item.weightLabel, item.supplierName].filter(Boolean).join(" · ")}
          </span>
        )}
      </p>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 rounded-full border border-line bg-surface px-2 py-1.5">
          <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease" className="flex h-7 w-7 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink">
            <Minus size={16} />
          </button>
          <span className="tabular w-5 text-center text-sm text-ink">{qty}</span>
          <button type="button" onClick={() => setQty((q) => Math.min(20, item.stockQty, q + 1))} aria-label="Increase" className="flex h-7 w-7 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink">
            <Plus size={16} />
          </button>
        </div>
        <span className={`flex items-center gap-1 text-xs font-medium ${item.stockQty === 0 ? "text-[var(--danger)]" : "text-ink-faint"}`}>
          {item.stockQty === 0 ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
          {item.stockQty === 0 ? "Out of stock" : `${item.stockQty} in stock`}
        </span>
      </div>

      {item.longDescription && <p className="whitespace-pre-line text-xs leading-relaxed text-ink-muted">{item.longDescription}</p>}

      <div>
        <p className="text-sm font-medium text-ink-muted">Delivery</p>
        <div className="mt-2 flex flex-col gap-2">
          {(["ship", "bundle"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                mode === m ? "border-2 border-[var(--gold)] bg-surface-raised" : "border-line hover:bg-surface-raised"
              }`}
            >
              <span className={`text-sm font-semibold ${mode === m ? "text-ink" : "text-ink-muted"}`}>
                {m === "ship" ? "Ship separately" : "Add to a recent order"}
              </span>
              {mode === m ? <CheckCircle2 size={18} className="text-gold-text" /> : <Circle size={18} className="text-ink-faint" />}
            </button>
          ))}
        </div>
        {mode === "bundle" && <div className="mt-3"><BundlePicker key={String(needsAuth)} selected={bundleId} onSelect={setBundleId} onAuthError={() => setNeedsAuth(true)} /></div>}
      </div>

      {error && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{error}</p>}

      {needsAuth ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted">Sign in to place your order.</p>
          <PhoneAuth onVerified={() => {
            setNeedsAuth(false);
            if (!(mode === "bundle" && bundleId === null)) {
              void buy();
            }
          }} />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {item.stockQty === 0 ? (
            <div className="flex cursor-not-allowed items-center justify-center gap-2 rounded-full bg-surface-raised px-6 py-4 text-center text-sm font-semibold text-ink-faint">
              <AlertCircle size={16} className="text-[var(--danger)]" />
              Currently out of stock
            </div>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                shape="pill"
                size="fluid"
                onClick={() => setCart(addOrUpdateQty(cart, { dishId: item.id, kind: "marketplace", slug: item.slug, name: item.name, pricePaise: item.pricePaise }, qty))}
                className="px-6 py-3.5 font-semibold text-ink bg-surface hover:bg-surface-raised"
              >
                Add to Cart
              </Button>
              <Button type="button" onClick={buy} disabled={busy} shape="pill" size="fluid" className="px-6 py-3.5 font-semibold hover:opacity-90 disabled:opacity-60">
                {busy ? "Opening payment…" : `Place order · ${formatPaise(item.pricePaise * qty)}`}
              </Button>
            </>
          )}
        </div>
      )}
      <p className="text-center text-[11px] uppercase tracking-wide text-ink-faint">7-day return on unopened items. Sealed supplements are non-returnable for safety.</p>
    </div>
  );
}
