"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Utensils, CheckCircle2, ShoppingBag } from 'lucide-react';
import { type PrecisionPlanResult } from '@/lib/wellnessApi';
import { useCart } from '@/components/cart/CartProvider';
import { addOrUpdateQty, type CartLine, type CartState } from '@/lib/cartStore';

interface PrecisionPlanResultsProps {
  plan: PrecisionPlanResult;
  /** Persisted draft identifier (wellnessApi.generatePrecisionPlan /
   *  getPrecisionPlanDraft) — not yet sent anywhere itself, but its presence
   *  is what proves this plan survived the round trip rather than living only
   *  in this component's props. */
  draftId: string;
}

/** Every real dish across the 7-day thali schedule, deduplicated with
 *  quantities combined — the same dishes/prices the menu already knows, so
 *  the à-la-carte checkout this hands off to re-prices them exactly like any
 *  other cart. */
function planCartLines(plan: PrecisionPlanResult): Omit<CartLine, "qty">[] {
  const byDish = new Map<number, { line: Omit<CartLine, "qty">; qty: number }>();
  for (const day of plan.dailyThalis) {
    for (const meal of day.meals) {
      const existing = byDish.get(meal.id);
      if (existing) {
        existing.qty += 1;
        continue;
      }
      byDish.set(meal.id, {
        qty: 1,
        line: {
          dishId: meal.id,
          kind: "dish",
          slug: meal.slug,
          name: meal.name,
          pricePaise: meal.pricePaise,
          macros: { calories: meal.calories, protein: meal.proteinGrams },
        },
      });
    }
  }
  // Flattened back to a plain line list with `qty` folded into repeated
  // addOrUpdateQty calls below — kept as a Map above only to dedupe by id.
  return Array.from(byDish.values()).flatMap(({ line, qty }) =>
    Array.from({ length: qty }, () => line),
  );
}

export const PrecisionPlanResults: React.FC<PrecisionPlanResultsProps> = ({ plan, draftId }) => {
  const router = useRouter();
  const { cart, setCart } = useCart();
  const [addingToCart, setAddingToCart] = useState(false);

  // Adds the plan's real dishes to the existing, working à-la-carte cart and
  // hands off to the existing, working guest checkout — replacing the old
  // `href="/checkout?plan=7day_precision&price=..."` link, which pointed at a
  // planId PLAN_CATALOG has never heard of (and a client-supplied price).
  // checkout.tsx's own `if (!id) redirect("/plans")` silently discarded the
  // whole generated plan on click. See docs/audit/PRECISION-PLANNER-DRAFT-ID.md.
  function checkoutPrecisionPlan() {
    setAddingToCart(true);
    const lines = planCartLines(plan);
    const withPlan = lines.reduce<CartState>(
      (state, line) => addOrUpdateQty(state, line, 1),
      cart,
    );
    setCart(withPlan);
    router.push('/checkout?mode=alacarte');
  }

  return (
    <div className="space-y-8" data-precision-draft-id={draftId}>
      {/* Target Biometrics & BMR Header Card */}
      <div className="rounded-2xl border border-gold/20 bg-gold/5 text-ink p-6 sm:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full bg-gold/20 text-gold-text font-extrabold text-xs border border-gold/30 inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-gold-text" /> BMR & TDEE Clinical Prescription
            </span>
            <h3 className="font-display text-2xl sm:text-3xl font-semibold leading-tight text-primary">
              Your Daily Target: {plan.targetCalories} <span className="text-sm font-normal text-ink-faint">kcal/day</span>
            </h3>
            <p className="text-xs text-ink-faint">
              Basal Metabolic Rate (BMR): <strong className="font-data font-bold text-primary">{plan.bmr} kcal</strong> • Total Daily Energy Expenditure (TDEE): <strong className="font-data font-bold text-primary">{plan.tdee} kcal</strong>
            </p>
          </div>

          {/* Macro Pills */}
          <div className="grid grid-cols-3 gap-2 bg-surface-raised p-3.5 rounded-2xl border border-line shrink-0 text-center">
            <div>
              <strong className="text-lg font-data font-bold text-primary block">{plan.targetProteinG}g</strong>
              <span className="text-2xs text-ink-faint font-bold uppercase tracking-[.16em]">Protein</span>
            </div>
            <div>
              <strong className="text-lg font-data font-bold text-primary block">{plan.targetCarbsG}g</strong>
              <span className="text-2xs text-ink-faint font-bold uppercase tracking-[.16em]">Carbs</span>
            </div>
            <div>
              <strong className="text-lg font-data font-bold text-primary block">{plan.targetFatG}g</strong>
              <span className="text-2xs text-ink-faint font-bold uppercase tracking-[.16em]">Fat</span>
            </div>
          </div>
        </div>
      </div>

      {/* 7-Day Thalis Display */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-display text-lg font-semibold leading-tight text-primary flex items-center gap-2">
            <Utensils className="w-5 h-5 text-sage-text" /> Personalized 7-Day Thali Schedule
          </h4>
          <span className="text-xs font-bold text-ink-muted">
            Total 7-Day Plan: ₹{Math.round(plan.totalPlanPricePaise / 100)}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plan.dailyThalis.map((thali) => (
            <div
              key={thali.dayNumber}
              className="bg-surface rounded-2xl p-5 border border-line space-y-3"
            >
              <div className="flex items-center justify-between border-b border-line pb-2">
                <strong className="font-display text-sm font-semibold text-primary">
                  {thali.dayName} (Thali #{thali.dayNumber})
                </strong>
                <span className="text-xs font-data font-semibold text-ink">
                  {thali.totals.calories} kcal • {thali.totals.proteinGrams}g P
                </span>
              </div>

              <div className="space-y-2">
                {thali.meals.map((m, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-xl bg-surface-subtle">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sage-text shrink-0" />
                      <span className="font-bold text-ink">{m.name}</span>
                    </div>
                    <span className="text-2xs text-ink-faint font-medium">{m.calories} kcal</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center text-2xs text-ink-muted pt-1 font-medium">
                <span>P: {thali.totals.proteinGrams}g • C: {thali.totals.carbsGrams}g • F: {thali.totals.fatGrams}g</span>
                <span className="font-data font-bold text-ink">₹{Math.round(thali.totals.pricePaise / 100)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Subscription Conversion CTA */}
      <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center sm:text-left">
          <h4 className="font-display text-xl font-semibold leading-tight text-primary">Get your Personalized 7-Day Thali Plan</h4>
          <p className="text-xs text-ink-muted font-medium">
            Adds all {plan.dailyThalis.reduce((n, d) => n + d.meals.length, 0)} meals to your cart — real menu dishes, priced and checked out the same way as everything else.
          </p>
        </div>

        <button
          type="button"
          onClick={checkoutPrecisionPlan}
          disabled={addingToCart}
          aria-busy={addingToCart}
          aria-live="polite"
          className="px-6 py-3 rounded-2xl bg-gold text-gold-ink font-semibold text-xs uppercase tracking-wider hover:brightness-110 transition-all shrink-0 flex items-center gap-2 disabled:opacity-60"
        >
          <ShoppingBag className="w-4 h-4" />
          <span>{addingToCart ? "Adding to cart…" : `Checkout 7-Day Plan (₹${Math.round(plan.totalPlanPricePaise / 100)})`}</span>
        </button>
      </div>
    </div>
  );
};
