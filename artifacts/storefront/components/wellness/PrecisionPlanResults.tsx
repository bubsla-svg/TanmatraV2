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
      <div className="bg-gradient-to-r from-[var(--gold)]/15 via-[var(--gold)]/10 to-[var(--surface)] text-ink p-6 sm:p-8 rounded-3xl shadow-2xl space-y-6 border border-[var(--gold)]/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full bg-gold/20 text-[var(--gold-text)] font-extrabold text-xs border border-[var(--gold)]/30 inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[var(--gold-text)]" /> BMR & TDEE Clinical Prescription
            </span>
            <h3 className="text-2xl sm:text-3xl font-black font-heading">
              Your Daily Target: {plan.targetCalories} <span className="text-sm font-normal text-ink-faint">kcal/day</span>
            </h3>
            <p className="text-xs text-ink-faint">
              Basal Metabolic Rate (BMR): <strong className="text-ink">{plan.bmr} kcal</strong> • Total Daily Energy Expenditure (TDEE): <strong className="text-ink">{plan.tdee} kcal</strong>
            </p>
          </div>

          {/* Macro Pills */}
          <div className="grid grid-cols-3 gap-2 bg-surface-raised p-3.5 rounded-2xl border border-line backdrop-blur-md shrink-0 text-center">
            <div>
              <strong className="text-lg font-black text-sage-text block">{plan.targetProteinG}g</strong>
              <span className="text-3xs text-ink-faint font-bold uppercase">Protein</span>
            </div>
            <div>
              <strong className="text-lg font-black text-[var(--gold-text)] block">{plan.targetCarbsG}g</strong>
              <span className="text-3xs text-ink-faint font-bold uppercase">Carbs</span>
            </div>
            <div>
              <strong className="text-lg font-black text-[var(--gold-text)] block">{plan.targetFatG}g</strong>
              <span className="text-3xs text-ink-faint font-bold uppercase">Fat</span>
            </div>
          </div>
        </div>
      </div>

      {/* 7-Day Thalis Display */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-black text-ink font-heading flex items-center gap-2">
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
              className="bg-surface rounded-3xl p-5 border border-line shadow-md space-y-3"
            >
              <div className="flex items-center justify-between border-b border-line pb-2">
                <strong className="text-sm font-black text-ink font-heading">
                  {thali.dayName} (Thali #{thali.dayNumber})
                </strong>
                <span className="text-xs font-black text-sage-text">
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
                    <span className="text-3xs text-ink-faint font-medium">{m.calories} kcal</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center text-2xs text-ink-muted pt-1 font-medium">
                <span>P: {thali.totals.proteinGrams}g • C: {thali.totals.carbsGrams}g • F: {thali.totals.fatGrams}g</span>
                <span className="font-bold text-ink">₹{Math.round(thali.totals.pricePaise / 100)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Subscription Conversion CTA */}
      <div className="bg-gradient-to-r from-[var(--sage)]/15 to-[var(--gold)]/15 text-ink p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center sm:text-left">
          <h4 className="text-xl font-black font-heading">Get your Personalized 7-Day Thali Plan</h4>
          <p className="text-xs text-sage-text font-medium">
            Adds all {plan.dailyThalis.reduce((n, d) => n + d.meals.length, 0)} meals to your cart — real menu dishes, priced and checked out the same way as everything else.
          </p>
        </div>

        <button
          type="button"
          onClick={checkoutPrecisionPlan}
          disabled={addingToCart}
          className="px-6 py-3 rounded-2xl bg-surface text-sage-text font-black text-xs uppercase tracking-wider shadow-lg hover:bg-sage-soft transition-all shrink-0 flex items-center gap-2 disabled:opacity-60"
        >
          <ShoppingBag className="w-4 h-4 text-sage-text" />
          <span>{addingToCart ? "Adding to cart…" : `Checkout 7-Day Plan (₹${Math.round(plan.totalPlanPricePaise / 100)})`}</span>
        </button>
      </div>
    </div>
  );
};
