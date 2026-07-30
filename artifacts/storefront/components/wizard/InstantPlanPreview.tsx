"use client";
// Client: live instant plan recommendations driven by survey state.
import { useMemo } from "react";
import Link from "next/link";
import { AddToCart } from "@/components/cart/AddToCart";
import { recommendMenu, type SmartRecommendation } from "@/lib/recommendations";
import { formatPaise } from "@/lib/format";
import type { DishData } from "@workspace/menu-catalog";

interface InstantPlanPreviewProps {
  dishes: DishData[];
  goal: string;
  allergens: string[];
  dietaryStyle: string;
  medicalConditions: string[];
}

export function InstantPlanPreview({
  dishes,
  goal,
  allergens,
  dietaryStyle,
  medicalConditions,
}: InstantPlanPreviewProps) {
  const recs: SmartRecommendation[] = useMemo(() => {
    return recommendMenu(
      dishes,
      {
        goal: goal as any,
        allergens,
        dietaryStyle: dietaryStyle as any,
        medicalConditions,
      },
      true,
    ).slice(0, 3);
  }, [dishes, goal, allergens, dietaryStyle, medicalConditions]);

  if (recs.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-5 text-center">
        <p className="text-sm text-ink-muted">No exact therapeutic matches found without clinical adjustments.</p>
        <Link href="/rd" className="mt-3 inline-block font-semibold text-gold-text hover:underline text-xs uppercase tracking-wide">
          Consult a Dietitian &rarr;
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 mt-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gold-text">
        Top 3 Therapeutic Meal Matches
      </h3>
      <div className="flex flex-col gap-3">
        {recs.map(({ dish, badge, rationale }) => (
          <div
            key={dish.id}
            className="rounded-2xl border border-line bg-surface p-4 shadow-sm flex flex-col gap-3 transition-transform duration-200 hover:scale-[1.01]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-ink">{dish.name}</span>
              <span className="rounded-full bg-sage-soft px-2.5 py-0.5 text-xs font-medium text-sage-text shrink-0">
                {badge}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-ink-muted">{rationale}</p>
            <div className="flex items-center justify-between border-t border-line pt-2 mt-1 text-xs">
              <span className="font-semibold text-ink">{formatPaise(dish.price)}</span>
              <div className="w-fit">
                <AddToCart dish={{ id: dish.id, slug: dish.slug, name: dish.name, price: dish.price }} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <Link
        href="/plans"
        className="mt-2 flex w-full items-center justify-center rounded-2xl bg-gold py-3.5 text-sm font-semibold text-[var(--gold-ink)] shadow-sm hover:bg-gold/90 transition-colors"
      >
        Activate Recurring Subscription &rarr;
      </Link>
    </div>
  );
}
