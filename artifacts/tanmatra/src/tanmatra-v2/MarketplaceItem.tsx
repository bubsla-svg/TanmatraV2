import { useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  marketplaceApi,
  marketplaceCheckoutIdempotencyKey,
} from "@/lib/marketplaceApi";
import { formatPrice } from "@/lib/api/adapter";
import { useOrders } from "@/lib/ordersContext";
import { onDishImageError } from "@/lib/imgFallback";

export default function V2MarketplaceItem() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { orders } = useOrders();
  const [qty, setQty] = useState(1);
  const [deliveryMode, setDeliveryMode] = useState<"ship" | "bundle_with_meal">(
    "ship",
  );
  const [bundleOrderId, setBundleOrderId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Holds the Idempotency-Key for the in-flight submit attempt. We
  // mint on first click and reuse the same key on any subsequent
  // click made before a terminal result (so a user-driven retry
  // after a timeout still hits the server's replay cache and does
  // NOT create a second order). Cleared on success so the next
  // distinct purchase intent gets its own key.
  const idempotencyRef = useRef<string | null>(null);

  const q = useQuery({
    queryKey: ["marketplace", "item", slug],
    queryFn: () => marketplaceApi.getItem(slug!),
    enabled: !!slug,
  });

  if (q.isLoading)
    return (
      <div className="tnm2 nn min-h-screen bg-[var(--tnm-surface-ink)] text-white antialiased">
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div className="appbar">
            <Link className="iconbtn" to="/marketplace" aria-label="Back to marketplace">
              <i className="ph-bold ph-arrow-left" />
            </Link>
            <div className="abt">Product</div>
          </div>
          <div className="content padx" style={{ paddingTop: 4 }}>
            <div className="skel" style={{ width: "100%", aspectRatio: "1 / 1", borderRadius: 12 }} />
            <div className="skel mt14" style={{ height: 14, width: 96 }} />
            <div className="skel mt10" style={{ height: 26, width: "75%" }} />
            <div className="skel mt10" style={{ height: 16, width: "40%" }} />
            <div className="skel mt14" style={{ height: 14, width: "100%" }} />
            <div className="skel mt6" style={{ height: 14, width: "100%" }} />
            <div className="skel mt6" style={{ height: 14, width: "66%" }} />
            <div className="skel mt20" style={{ height: 52, width: "100%", borderRadius: 12 }} />
          </div>
        </div>
      </div>
    );

  const item = q.data?.item;
  if (!item) {
    return (
      <div className="tnm2 nn min-h-screen bg-[var(--tnm-surface-ink)] text-white antialiased">
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div className="appbar">
            <Link className="iconbtn" to="/marketplace" aria-label="Back to marketplace">
              <i className="ph-bold ph-arrow-left" />
            </Link>
            <div className="abt">Product</div>
          </div>
          <div className="content padx">
            <div className="tc" style={{ padding: "52px 20px" }}>
              <i className="ph-bold ph-package" style={{ fontSize: 32, color: "var(--fnt)" }} />
              <div className="tt mt10">Item not found</div>
              <div className="fine mt6">This product may have been removed or is out of stock.</div>
              <Link className="btn btn-g mt20" to="/marketplace">Back to marketplace</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const recentOrders = orders
    .filter((o) => o.serverOrderId)
    .slice(0, 5);

  const handleCheckout = async () => {
    if (qty < 1) return;
    setSubmitting(true);
    try {
      if (!idempotencyRef.current) {
        idempotencyRef.current = marketplaceCheckoutIdempotencyKey();
      }
      const r = await marketplaceApi.checkout({
        idempotencyKey: idempotencyRef.current,
        items: [{ itemId: item.id, qty }],
        deliveryMode,
        bundleWithOrderId:
          deliveryMode === "bundle_with_meal" ? bundleOrderId : null,
      });
      // Terminal success — next "Buy" click is a new intent.
      idempotencyRef.current = null;
      toast.success(
        deliveryMode === "ship"
          ? "Order placed — arrives in 24–48 hours"
          : "Bundled with your next meal delivery",
        {
          action: { label: "View Orders", onClick: () => navigate("/orders") },
        },
      );
      navigate(`/marketplace?ordered=${r.order.id}`);
    } catch (e) {
      const msg = String((e as Error).message);
      if (msg.includes("401")) {
        toast.error("Sign in to place a marketplace order", {
          action: {
            label: "Sign in",
            onClick: () =>
              navigate(
                `/login?next=${encodeURIComponent(window.location.pathname)}`,
              ),
          },
        });
      } else if (msg.includes("out of stock")) {
        toast.error("This item is now out of stock");
      } else {
        toast.error("Could not place order — please try again");
      }
      // 4xx-style failures (auth, out of stock, validation) need a
      // fresh key on the next click because the user will edit qty
      // / delivery mode / address, changing the body. Network/5xx
      // throws have no status digits, keep the key so a retry hits
      // the server's replay cache.
      if (/\b[45]\d{2}\b/.test(msg) || msg.includes("out of stock")) {
        idempotencyRef.current = null;
      }
    } finally {
      setSubmitting(false);
    }
  };

  const imgSrc = item.image
    ? item.image.includes("unsplash.com")
      ? `${item.image}&fm=webp&auto=format`
      : item.image
    : null;

  const bundleDisabled = recentOrders.length === 0;
  const buyDisabled =
    submitting || (deliveryMode === "bundle_with_meal" && !bundleOrderId);

  return (
    <div
      className="tnm2 nn min-h-screen bg-[var(--tnm-surface-ink)] text-white antialiased"
      style={{ display: "flex", flexDirection: "column" }}
    >
      <div
        style={{ maxWidth: 480, margin: "0 auto", width: "100%", flex: 1, display: "flex", flexDirection: "column" }}
      >
        <div className="appbar">
          <Link className="iconbtn" to="/marketplace" aria-label="Back to marketplace">
            <i className="ph-bold ph-arrow-left" />
          </Link>
          <div className="abt">Product</div>
          <Link className="iconbtn" to="/cart" aria-label="Cart" title="Cart">
            <i className="ph-bold ph-shopping-bag" />
          </Link>
        </div>

        <div className="content padx" style={{ flex: 1, paddingTop: 4 }}>
          {/* Image */}
          <div
            className="plc"
            style={{ width: "100%", aspectRatio: "1 / 1", borderRadius: 12, overflow: "hidden" }}
          >
            {imgSrc ? (
              <img
                src={imgSrc}
                alt={item.name}
                loading="lazy"
                onError={onDishImageError}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span className="plccap">NO IMAGE</span>
            )}
          </div>

          {/* Badges */}
          <div className="fx ac wrap g6 mt14">
            {item.badges.map((b) => (
              <span key={b} className="pill">
                {b}
              </span>
            ))}
          </div>

          {/* Title + description */}
          <h1 className="h2 mt10">{item.name}</h1>
          <p className="fine mt6">{item.description}</p>

          {/* Price */}
          <div className="fx ac jb mt10">
            <span className="price safc" style={{ fontSize: 22 }}>
              {formatPrice(item.pricePaise)}
            </span>
            <span className="mono fntc" style={{ fontSize: 11 }}>
              {[item.weightLabel, item.supplierName ? `by ${item.supplierName}` : null]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>

          {/* Quantity */}
          <div className="lab mt20 mb6">Quantity</div>
          <div className="fx ac gap12">
            <button
              className="qbtn"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              aria-label="Decrease"
            >
              <i className="ph-bold ph-minus" />
            </button>
            <span
              className="mono"
              style={{ fontSize: 16, fontWeight: 600, width: 28, textAlign: "center" }}
            >
              {qty}
            </span>
            <button
              className="qbtn"
              onClick={() => setQty((q) => Math.min(20, q + 1))}
              aria-label="Increase"
            >
              <i className="ph-bold ph-plus" />
            </button>
            <span className="fine" style={{ marginLeft: 4 }}>
              {item.stockQty} in stock
            </span>
          </div>

          {/* Delivery */}
          <div className="lab mt20 mb6">Delivery</div>
          <button
            type="button"
            className={deliveryMode === "ship" ? "opt on" : "opt"}
            onClick={() => setDeliveryMode("ship")}
            style={{ alignItems: "flex-start" }}
          >
            <i className="ph-bold ph-truck" style={{ marginTop: 1 }} />
            <div className="f1" style={{ minWidth: 0 }}>
              <div className="small" style={{ fontWeight: 600, color: "var(--tx)" }}>
                Ship separately
              </div>
              <div className="fine mt2">Standalone parcel, arrives in 24–48 hours.</div>
            </div>
            {deliveryMode === "ship" && (
              <i className="ph-fill ph-check-circle safc" style={{ fontSize: 20, flex: "none" }} />
            )}
          </button>

          <button
            type="button"
            className={deliveryMode === "bundle_with_meal" ? "opt on" : "opt"}
            onClick={() => {
              if (!bundleDisabled) setDeliveryMode("bundle_with_meal");
            }}
            disabled={bundleDisabled}
            style={{ alignItems: "flex-start", opacity: bundleDisabled ? 0.45 : 1 }}
          >
            <i className="ph-bold ph-package" style={{ marginTop: 1 }} />
            <div className="f1" style={{ minWidth: 0 }}>
              <div className="small" style={{ fontWeight: 600, color: "var(--tx)" }}>
                Bundle with my next meal
              </div>
              <div className="fine mt2">
                Delivered with one of your active meal orders. Saves the shipping
                trip.
              </div>
            </div>
            {deliveryMode === "bundle_with_meal" && (
              <i className="ph-fill ph-check-circle safc" style={{ fontSize: 20, flex: "none" }} />
            )}
          </button>

          {deliveryMode === "bundle_with_meal" && recentOrders.length > 0 && (
            <select
              className="inp mb10"
              style={{ cursor: "pointer", background: "var(--tnm-surface-ink-2)", border: "1px solid rgba(255,255,255,0.08)" }}
              value={bundleOrderId ?? ""}
              onChange={(e) =>
                setBundleOrderId(
                  e.target.value ? Number(e.target.value) : null,
                )
              }
            >
              <option value="">Choose an order…</option>
              {recentOrders.map((o) => (
                <option key={o.serverOrderId} value={o.serverOrderId!}>
                  #{o.orderId} — {new Date(o.placedAt).toLocaleDateString()}
                </option>
              ))}
            </select>
          )}

          {/* Return policy */}
          <div className="note mt14">
            <i className="ph-fill ph-shield-check" />
            <span>
              7-day return on unopened items. Sealed supplements are
              non-returnable for safety.
            </span>
          </div>

          {/* Long description */}
          {item.longDescription && (
            <>
              <div className="text-[11px] font-semibold tracking-[0.06em] uppercase text-white/50 mt20 mb10">Details</div>
              <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4">
                <p
                  className="fine"
                  style={{ whiteSpace: "pre-line", color: "var(--mut)" }}
                >
                  {item.longDescription}
                </p>
              </div>
            </>
          )}

          <div style={{ height: 12 }} />
        </div>

        {/* Buy dock */}
        <div className="dock bg-[var(--tnm-surface-ink)] border-t border-white/[0.08]">
          <button
            className={"btn btn-p btn-lg btn-blk" + (buyDisabled ? " dis" : "")}
            onClick={handleCheckout}
            disabled={buyDisabled}
          >
            <i className="ph-bold ph-shopping-bag" />
            {submitting
              ? "Placing order…"
              : `Place order · ${formatPrice(item.pricePaise * qty)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
