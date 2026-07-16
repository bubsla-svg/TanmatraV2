import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Lock } from "@phosphor-icons/react";
import { FADE_IN_UP } from "@/lib/motion";
import {
  useMenuCatalog,
  getDishBySlug,
  macrosAreProvisional,
  type DishData,
} from "@/lib/menuData";
import { useStitchCart } from "./stitchCartStore";

/**
 * Checkout (Tier P0 Refined) — Stitch "Tanmatra Premium Home" screen f049acb2…
 * on the Nocturnal Nourishment design system. Decomposed into micro-components
 * (Header / LocationPicker / AddressField / OrderSummaryItem / PricingRow /
 * CheckoutGate) per the large-screen brief.
 *
 * Honest data: line prices come from the cart / dish record (paise), the total
 * is COMPUTED (never a hardcoded ₹ literal), and per-item macros run through
 * macrosAreProvisional() — hidden when the dish has no trustworthy profile,
 * never shown as a number the record can't back.
 */

const FREE_DELIVERY_PAISE = 49900; // mirrors cartMath free-delivery threshold
const rupees = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;

// ── micro-components ────────────────────────────────────────────────────────

function CheckoutHeader() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 h-14 px-4 flex items-center justify-between bg-nn-bg/80 backdrop-blur-xl border-b border-white/5">
      <button aria-label="Back" className="min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center text-nn-primary active:scale-95 transition-transform">
        <ArrowLeft size={22} />
      </button>
      <h1 className="nn-display-lg-mobile font-bold tracking-tighter text-nn-primary">Tanmatra</h1>
      <span className="w-11 h-11" />
    </header>
  );
}

function LocationPicker() {
  return (
    <section className="flex flex-col gap-2">
      <button className="w-full min-h-[44px] p-4 rounded-xl bg-nn-surface/50 border border-nn-primary/20 hover:border-nn-primary/40 text-nn-primary flex items-center justify-center gap-2 transition-colors">
        <MapPin size={20} />
        <span className="nn-body-sm font-semibold">Use Current Location</span>
      </button>
      <div className="flex items-center gap-4 py-2">
        <span className="h-px flex-1 bg-white/10" />
        <span className="nn-label-caps text-nn-on-surface-variant">or enter manually</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>
    </section>
  );
}

function AddressField({ id, label, placeholder }: { id: string; label: string; placeholder: string }) {
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="nn-micro-data text-nn-on-surface-variant uppercase tracking-wider mb-1">{label}</label>
      <input
        id={id}
        type="text"
        placeholder={placeholder}
        className="min-h-[44px] rounded-lg bg-nn-surface/60 border border-white/10 px-3 nn-body-sm text-white placeholder:text-nn-on-surface-variant/50 focus:border-nn-primary/50 focus:outline-none transition-colors"
      />
    </div>
  );
}

function OrderSummaryItem({ dish, qty }: { dish: DishData; qty: number }) {
  const provisional = macrosAreProvisional(dish);
  const t = dish.macrosEstimated ? "~" : "";
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
      <div>
        <p className="nn-body-sm text-nn-on-surface">
          {dish.name}{qty > 1 ? ` ×${qty}` : ""}
        </p>
        {provisional ? (
          <p className="nn-micro-data text-nn-on-surface-variant mt-1">Macros pending verification</p>
        ) : (
          <p className="nn-micro-data text-nn-primary mt-1 tabular-nums">
            {t}{dish.macros.protein}g P • {t}{dish.macros.carbs}g C • {t}{dish.macros.fat}g F
          </p>
        )}
      </div>
      <p className="nn-body-sm text-nn-on-surface tabular-nums">{rupees(dish.price * qty)}</p>
    </div>
  );
}

function PricingRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`flex justify-between items-center nn-body-sm ${accent ? "text-nn-tertiary" : "text-nn-on-surface-variant"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

// ── screen ──────────────────────────────────────────────────────────────────

export default function StitchCheckout() {
  const { dishes } = useMenuCatalog();
  const lines = useStitchCart((s) => s.lines);

  // Real cart if present; otherwise a preview order from 2 live dishes.
  const order = useMemo(() => {
    if (lines.length > 0) {
      return lines
        .map((l) => ({ dish: getDishBySlug(l.slug), qty: l.qty }))
        .filter((x): x is { dish: DishData; qty: number } => Boolean(x.dish));
    }
    return dishes.slice(0, 2).map((dish) => ({ dish, qty: 1 }));
  }, [lines, dishes]);

  const itemTotal = order.reduce((s, { dish, qty }) => s + dish.price * qty, 0);
  const freeDelivery = itemTotal >= FREE_DELIVERY_PAISE;
  const deliveryPaise = freeDelivery ? 0 : 4000;
  const total = itemTotal + deliveryPaise;

  return (
    <div className="min-h-dvh bg-nn-bg text-nn-on-surface pb-28">
      <CheckoutHeader />
      <motion.main
        variants={FADE_IN_UP}
        initial="hidden"
        animate="show"
        className="pt-20 px-4 max-w-2xl mx-auto flex flex-col gap-8"
      >
        <section>
          <h2 className="nn-headline-md text-nn-on-surface">Checkout</h2>
          <p className="nn-body-sm text-nn-on-surface-variant mt-1">Step 1: Delivery Information</p>
        </section>

        <LocationPicker />

        <section className="flex flex-col gap-4 bg-nn-surface/30 backdrop-blur-xl p-4 rounded-xl border border-white/5">
          <h3 className="nn-label-caps text-nn-outline">Delivery Address</h3>
          <AddressField id="pincode" label="Pincode" placeholder="e.g. 560001" />
          <AddressField id="area" label="Area / Street" placeholder="e.g. Indiranagar, 100ft Road" />
          <AddressField id="house" label="House / Flat No." placeholder="e.g. Apt 4B, Building Name" />
          <AddressField id="instructions" label="Delivery Instructions (Optional)" placeholder="e.g. Leave at security" />
        </section>

        <section className="flex flex-col gap-1 bg-nn-surface/30 backdrop-blur-xl p-4 rounded-xl border border-white/5">
          <h3 className="nn-label-caps text-nn-outline mb-2">Order Summary</h3>
          {order.map(({ dish, qty }) => (
            <OrderSummaryItem key={dish.slug} dish={dish} qty={qty} />
          ))}
        </section>

        <section className="flex flex-col gap-2 p-4">
          <PricingRow label="Item Total" value={rupees(itemTotal)} />
          <PricingRow label="Delivery Fee" value={freeDelivery ? "FREE" : rupees(deliveryPaise)} accent={freeDelivery} />
          <div className="flex justify-between items-center nn-headline-md text-nn-primary mt-2 pt-2 border-t border-white/5">
            <span>Total Payable</span>
            <span className="tabular-nums">{rupees(total)}</span>
          </div>
        </section>
      </motion.main>

      {/* CheckoutGate */}
      <div className="fixed bottom-0 inset-x-0 z-40 p-4 bg-nn-bg/90 backdrop-blur-xl border-t border-white/5">
        <div className="max-w-2xl mx-auto flex flex-col gap-2">
          <p className="text-center nn-micro-data text-nn-on-surface-variant mb-1">Login required to complete checkout</p>
          <button className="w-full min-h-[44px] rounded-lg bg-nn-primary text-nn-on-primary-container font-bold nn-body-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all">
            <span>Login &amp; Pay</span>
            <Lock size={16} weight="fill" />
          </button>
        </div>
      </div>
    </div>
  );
}
