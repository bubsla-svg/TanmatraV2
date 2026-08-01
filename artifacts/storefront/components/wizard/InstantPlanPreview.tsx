"use client";
// Client: live instant plan recommendations driven by survey state.
import { useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AddToCart } from "@/components/cart/AddToCart";
import { recommendMenu, type SmartRecommendation } from "@/lib/recommendations";
import { formatPaise } from "@/lib/format";
import type { DishData } from "@workspace/menu-catalog";
import { SafeImage } from "@/components/ui/SafeImage";

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
              <SafeImage src={dish.image} className="h-full w-full" />
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
      <Button asChild shape="pill" size="fluid" className="mt-2 flex w-full py-3.5 font-semibold uppercase tracking-wide shadow-sm">
        <Link href="/plans">Activate Recurring Subscription</Link>
      </Button>
    </div>
  );
}
