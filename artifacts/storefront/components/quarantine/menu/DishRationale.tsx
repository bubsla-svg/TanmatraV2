"use client";
// Client: the personalised "Why this dish" line for a signed-in customer, from
// POST /dish-rationales. The server grounds it in the dish's real
// macros/ingredients + the user's brief, forbids allergy-safety claims, and
// degrades to a plain macro summary when the model is unavailable — so whatever
// renders here is safe. Best-effort: signed out (401) / any error → renders
// nothing (kept minimal-diff, per audit #20), never blocking the drawer. A
// genuine in-flight fetch now reserves height with a skeleton instead of
// popping in with none — was a small CLS source on the drawer.
import { useQuery } from "@tanstack/react-query";
import { getDishRationales, type DishRationale as Rationale } from "@/lib/dishRationaleApi";

export function DishRationale({ dishId }: { dishId: number }) {
  const { data, isPending } = useQuery<Rationale | null>({
    queryKey: ["dish", "rationale", dishId],
    queryFn: () => getDishRationales([dishId]).then(({ rationales }) => rationales[0] ?? null),
  });

  if (isPending) {
    return <div className="mt-4 h-16 animate-pulse rounded-lg border border-line bg-surface" />;
  }

  if (!data || !data.rationale) return null;

  return (
    <div className="mt-4 rounded-lg border border-line bg-surface p-3">
      <p className="text-2xs font-semibold uppercase tracking-wider text-sage-text">Why this dish</p>
      <p className="mt-1 text-sm text-ink">{data.rationale}</p>
      {data.expanded && data.expanded !== data.rationale && (
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">{data.expanded}</p>
      )}
    </div>
  );
}
