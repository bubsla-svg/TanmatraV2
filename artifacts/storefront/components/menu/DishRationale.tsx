"use client";
// Client: the personalised "Why this dish" line for a signed-in customer, from
// POST /dish-rationales. The server grounds it in the dish's real
// macros/ingredients + the user's brief, forbids allergy-safety claims, and
// degrades to a plain macro summary when the model is unavailable — so whatever
// renders here is safe. Best-effort: signed out (401) / any error / loading →
// renders nothing, never blocking the drawer.
import { useEffect, useState } from "react";
import { getDishRationales, type DishRationale as Rationale } from "@/lib/dishRationaleApi";

export function DishRationale({ dishId }: { dishId: number }) {
  const [r, setR] = useState<Rationale | null>(null);

  useEffect(() => {
    let live = true;
    getDishRationales([dishId])
      .then(({ rationales }) => {
        if (live) setR(rationales[0] ?? null);
      })
      .catch(() => {
        // Signed out / offline — leave the section out entirely.
      });
    return () => {
      live = false;
    };
  }, [dishId]);

  if (!r || !r.rationale) return null;

  return (
    <div className="mt-4 rounded-lg border border-line bg-surface p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-sage-text">Why this dish</p>
      <p className="mt-1 text-sm text-ink">{r.rationale}</p>
      {r.expanded && r.expanded !== r.rationale && (
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">{r.expanded}</p>
      )}
    </div>
  );
}
