"use client";
// Client: interactive protocol vault grid displaying bookmarked favorites,
// notes, and 1-click cart addition. Stitch brief route-13 "Protocol Vault":
// per-card image block, clinical-notes panel, monospace macro/tag chips, and a
// gold add-to-cart footer.
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { CheckCircle2, X } from "lucide-react";
import { isAlaCarteEnabled, type DishData } from "@workspace/menu-catalog";
import { formatPaise } from "@/lib/format";
import { getMySavedMeals, removeMealFromVault, type SavedMeal } from "@/lib/savedMealsApi";
import { AddToCart } from "@/components/cart/AddToCart";

export function ProtocolVaultGrid({ dishes }: { dishes: DishData[] }) {
  const [items, setItems] = useState<SavedMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMySavedMeals()
      .then((res) => {
        setItems(res);
        setLoading(false);
      })
      .catch(() => {
        setError("Please sign in to access your personal Protocol Vault.");
        setLoading(false);
      });
  }, []);

  const dishMap = useMemo(() => {
    const map = new Map<string, DishData>();
    for (const d of dishes) map.set(d.slug, d);
    return map;
  }, [dishes]);

  const remove = async (slug: string) => {
    try {
      await removeMealFromVault(slug);
      setItems((prev) => prev.filter((i) => i.dishSlug !== slug));
    } catch {
      // Offline fallback: optimistically remove from current view
      setItems((prev) => prev.filter((i) => i.dishSlug !== slug));
    }
  };

  if (loading) return <div className="p-8 text-center text-xs font-semibold text-ink-muted">Opening your vault…</div>;

  if (error || items.length === 0) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-8 text-center">
        <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">Protocol Vault Empty</span>
        <p className="text-sm font-medium text-ink">
          {error ?? "You have not bookmarked any clinical meal protocols to your personal vault yet."}
        </p>
        <Link
          href="/menu"
          className="mx-auto mt-2 rounded-full bg-gold px-6 py-2.5 text-xs font-semibold text-[var(--gold-ink)] transition-all hover:brightness-110"
        >
          Explore Therapeutic Menu &rarr;
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      {items.map((saved) => {
        const dish = dishMap.get(saved.dishSlug);
        return (
          <article
            key={saved.id}
            className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-shadow duration-300 hover:shadow-lg"
          >
            <div className="flex items-center justify-between p-4">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sage/20 bg-sage-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-sage-text">
                <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
                Vault saved
              </span>
              <button
                type="button"
                onClick={() => remove(saved.dishSlug)}
                className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted transition-colors hover:text-[var(--danger)]"
                title="Remove from Vault"
              >
                Remove
                <X aria-hidden className="h-3.5 w-3.5" />
              </button>
            </div>

            {dish?.image && (
              <div className="px-4">
                <div className="relative aspect-video overflow-hidden rounded-xl border border-line bg-surface-raised">
                  {/* eslint-disable-next-line @next/next/no-img-element -- plain
                      img in a fixed-ratio box for zero CLS, matching DishCard. */}
                  <img
                    src={dish.image}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-1 flex-col gap-4 p-6">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/dish/${saved.dishSlug}`} className="group/link min-w-0">
                  <h3 className="text-lg font-medium leading-snug text-ink transition-colors group-hover/link:text-gold-text">
                    {saved.dishName || dish?.name || saved.dishSlug}
                  </h3>
                </Link>
                {/* The price the server sent, verbatim — nothing derived here. */}
                {dish && (
                  <span className="tabular shrink-0 text-sm font-semibold text-gold-text">
                    {formatPaise(dish.price)}
                  </span>
                )}
              </div>

              {saved.notes && (
                <div className="rounded-xl border border-line bg-surface-raised p-3">
                  <p className="text-xs italic leading-snug text-ink-muted">&ldquo;{saved.notes}&rdquo;</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {dish && (
                  <span className="tabular rounded-full bg-surface-raised px-3 py-1 text-[11px] text-ink-muted">
                    {dish.macros.protein}P · {dish.macros.carbs}C · {dish.macros.fat}F
                  </span>
                )}
                {saved.tags.map((t, idx) => (
                  <span
                    key={idx}
                    className="rounded-full bg-surface-raised px-3 py-1 text-[11px] uppercase text-ink-muted"
                  >
                    {t}
                  </span>
                ))}
              </div>

              <div className="mt-auto flex items-center justify-between gap-4 border-t border-line pt-4">
                {dish && isAlaCarteEnabled(dish) ? (
                  <AddToCart dish={dish} />
                ) : (
                  <Link href={`/dish/${saved.dishSlug}`} className="text-xs font-semibold text-gold-text hover:underline">
                    View protocol &rarr;
                  </Link>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
