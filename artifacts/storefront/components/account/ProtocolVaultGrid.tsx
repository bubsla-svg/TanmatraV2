"use client";
// Client: interactive protocol vault grid displaying bookmarked favorites, notes, and 1-click cart addition.
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import type { DishData } from "@workspace/menu-catalog";
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
      <div className="rounded-2xl border border-line bg-surface p-8 text-center flex flex-col gap-3 shadow-sm">
        <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">Protocol Vault Empty</span>
        <p className="text-sm font-medium text-ink">
          {error ?? "You have not bookmarked any clinical meal protocols to your personal vault yet."}
        </p>
        <Link
          href="/menu"
          className="mt-2 mx-auto rounded-xl bg-gold px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-gold/90 transition-colors"
        >
          Explore Therapeutic Menu &rarr;
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((saved) => {
        const dish = dishMap.get(saved.dishSlug);
        return (
          <div
            key={saved.id}
            className="rounded-2xl border border-line bg-surface p-4 shadow-sm flex flex-col justify-between gap-4 transition-transform duration-200 hover:scale-[1.01]"
          >
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-sage-100 px-2.5 py-0.5 text-[11px] font-semibold text-sage-800 shrink-0">
                  Vault Saved &check;
                </span>
                <button
                  onClick={() => remove(saved.dishSlug)}
                  className="text-xs font-semibold text-ink-muted hover:text-ink transition-colors"
                  title="Remove from Vault"
                >
                  Remove &times;
                </button>
              </div>

              <Link href={`/dish/${saved.dishSlug}`} className="block font-semibold text-ink hover:text-gold-text">
                <h3 className="text-base font-semibold leading-snug">{saved.dishName || dish?.name || saved.dishSlug}</h3>
              </Link>

              {saved.notes && (
                <div className="rounded-xl border border-line bg-surface-2 p-3 text-xs text-ink-muted italic">
                  &ldquo;{saved.notes}&rdquo;
                </div>
              )}

              {saved.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {saved.tags.map((t, idx) => (
                    <span key={idx} className="rounded-md border border-line px-2 py-0.5 text-[10px] font-semibold text-ink">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-line pt-3 mt-1 flex items-center justify-between">
              {dish ? (
                <AddToCart dish={{ id: dish.id, slug: dish.slug, name: dish.name, price: dish.price ?? 35000 }} />
              ) : (
                <span className="text-xs text-ink-muted">Archived item</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
