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
      <div className="rounded-3xl border border-line bg-surface p-5 text-center">
        <p className="text-sm text-ink-muted">No exact therapeutic matches found without clinical adjustments.</p>
        <Link href="/rd" className="mt-3 inline-block font-semibold text-gold-text hover:underline text-xs uppercase tracking-wide">
          Consult a Dietitian &rarr;
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 mt-2">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-gold-text pl-1">
        Top 3 Therapeutic Meal Matches
      </h3>
      <div className="flex flex-col gap-4">
        {recs.map(({ dish, badge, rationale }) => (
          <div
            key={dish.id}
            className="flex flex-col overflow-hidden rounded-3xl border border-line bg-surface transition-colors hover:border-line-strong"
          >
            <div className="relative h-40 w-full bg-surface-raised">
              {/* eslint-disable-next-line @next/next/no-img-element -- unoptimized <img>, see next.config */}
              <img src={dish.image} alt="" loading="lazy" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
              <span className="absolute left-3 top-3 rounded-full bg-sage-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-sage-text backdrop-blur-md">
                {badge}
              </span>
            </div>
            <div className="flex flex-col gap-3 p-4">
              <span className="text-sm font-semibold text-ink leading-tight">{dish.name}</span>
              <p className="text-xs leading-relaxed text-ink-muted">{rationale}</p>
              <div className="flex items-center justify-between border-t border-line pt-3 mt-1">
                <span className="tabular text-sm font-semibold text-ink">{formatPaise(dish.price)}</span>
                <div className="w-fit">
                  <AddToCart dish={{ id: dish.id, slug: dish.slug, name: dish.name, price: dish.price }} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Link
        href="/plans"
        className="mt-2 flex w-full items-center justify-center rounded-full bg-gold py-3.5 text-sm font-semibold uppercase tracking-wide text-[var(--gold-ink)] shadow-sm hover:bg-gold/90 transition-all active:scale-[0.98]"
      >
        Activate Recurring Subscription
      </Link>
    </div>
  );
}
