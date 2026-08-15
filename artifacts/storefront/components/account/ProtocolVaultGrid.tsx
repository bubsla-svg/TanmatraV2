"use client";
// Client: interactive protocol vault grid displaying bookmarked favorites,
// notes, and 1-click cart addition. Stitch brief route-13 "Protocol Vault":
// per-card image block, clinical-notes panel, monospace macro/tag chips, and a
// gold add-to-cart footer.
import { useMemo } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isAlaCarteEnabled, type DishData } from "@workspace/menu-catalog";
import { formatPaise } from "@/lib/format";
import { ApiError } from "@/lib/apiClient";
import { getMySavedMeals, removeMealFromVault, type SavedMeal } from "@/lib/savedMealsApi";
import { AddToCart } from "@/components/cart/AddToCart";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";
import { DishImage } from "@/components/menu/DishImage";

export function ProtocolVaultGrid({ dishes }: { dishes: DishData[] }) {
  const queryClient = useQueryClient();

  const vaultQuery = useQuery({
    queryKey: ["account", "vault"],
    queryFn: () => getMySavedMeals(),
  });

  // Finding #5: no optimistic removal — the row only disappears once the
  // server confirms the delete, so a failed delete can never leave a row
  // missing from the UI while it's still saved server-side.
  const removeMutation = useMutation({
    mutationFn: (slug: string) => removeMealFromVault(slug),
    onSuccess: (_res, slug) => {
      queryClient.setQueryData<SavedMeal[]>(["account", "vault"], (prev) =>
        (prev ?? []).filter((i) => i.dishSlug !== slug),
      );
    },
  });

  const dishMap = useMemo(() => {
    const map = new Map<string, DishData>();
    for (const d of dishes) map.set(d.slug, d);
    return map;
  }, [dishes]);

  if (vaultQuery.isPending) {
    return <div className="p-8 text-center text-xs font-semibold text-ink-muted">Opening your vault…</div>;
  }

  // Finding #4: three distinct branches — 401, other errors, and the genuine
  // empty case — instead of a load failure and "no items" looking identical.
  if (vaultQuery.isError) {
    if (vaultQuery.error instanceof ApiError && vaultQuery.error.status === 401) {
      return (
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-8 text-center">
          <p className="text-sm text-ink-muted">Sign in to access your personal Protocol Vault.</p>
          <PhoneAuth startExpanded onVerified={() => void vaultQuery.refetch()} />
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-8 text-center">
        <p className="text-sm font-semibold text-[var(--danger)]">
          {vaultQuery.error instanceof ApiError ? vaultQuery.error.message : "Couldn't load your Protocol Vault."}
        </p>
        <button
          type="button"
          onClick={() => void vaultQuery.refetch()}
          className="mx-auto rounded-full border border-line px-5 py-2 text-xs font-semibold text-gold-text transition-colors hover:border-line-strong"
        >
          Try again
        </button>
      </div>
    );
  }

  const items = vaultQuery.data;

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-8 text-center">
        <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">Protocol Vault Empty</span>
        <p className="text-sm font-medium text-ink">
          You have not bookmarked any clinical meal protocols to your personal vault yet.
        </p>
        <Button asChild shape="pill" size="fluid" className="mx-auto mt-2 px-6 py-2.5 text-xs font-semibold">
          <Link href="/menu">Explore Therapeutic Menu &rarr;</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      {items.map((saved) => {
        const dish = dishMap.get(saved.dishSlug);
        const removing = removeMutation.isPending && removeMutation.variables === saved.dishSlug;
        const removeFailed = removeMutation.isError && removeMutation.variables === saved.dishSlug;
        return (
          <article
            key={saved.id}
            className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-shadow duration-300 hover:shadow-lg"
          >
            <div className="flex items-center justify-between p-4">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sage/20 bg-sage-soft px-2.5 py-1 text-3xs font-semibold uppercase tracking-wider text-sage-text">
                <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
                Vault saved
              </span>
              <button
                type="button"
                onClick={() => removeMutation.mutate(saved.dishSlug)}
                disabled={removing}
                aria-busy={removing}
                aria-live="polite"
                className="inline-flex items-center gap-1 text-3xs font-semibold uppercase tracking-wider text-ink-muted transition-colors hover:text-[var(--danger)] disabled:opacity-50"
                title="Remove from Vault"
              >
                {removing ? "Removing…" : "Remove"}
                <X aria-hidden className="h-3.5 w-3.5" />
              </button>
            </div>

            {removeFailed && (
              <p role="alert" className="px-4 text-2xs font-medium text-[var(--danger)]">
                Couldn&rsquo;t remove this item. Try again.
              </p>
            )}

            {dish?.image && (
              <div className="px-4">
                <div className="relative aspect-video overflow-hidden rounded-xl border border-line bg-surface-raised">
                  <DishImage
                    src={dish.image}
                    // Same precedence the card's title uses two lines below,
                    // so the tile's letter and the name always agree.
                    name={saved.dishName || dish.name || saved.dishSlug}
                    className="h-full w-full"
                    imgClassName="transition-transform duration-700 group-hover:scale-105"
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
                  <span className="tabular rounded-full bg-surface-raised px-3 py-1 text-2xs text-ink-muted">
                    {dish.macros.protein}P · {dish.macros.carbs}C · {dish.macros.fat}F
                  </span>
                )}
                {saved.tags.map((t, idx) => (
                  <span
                    key={idx}
                    className="rounded-full bg-surface-raised px-3 py-1 text-2xs uppercase text-ink-muted"
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
