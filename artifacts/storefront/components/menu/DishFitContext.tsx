"use client";
// "use client" justification: Context only resolves inside the client render
// tree. This file exists so DishCard (a genuine Server Component — see its
// own header) can still show the personalisation badge computed by
// PersonalizedMenu, without DishCard itself becoming a client module: the
// Provider and the tiny badge consumer are the only client code, DishCard's
// markup and data stay server-rendered.
import { createContext, useContext } from "react";
import { Text } from "@astryxdesign/core/Text";
import type { DishFit } from "@/lib/menuFit";

const DishFitContext = createContext<Map<number, DishFit> | undefined>(undefined);

export function DishFitProvider({
  fits,
  children,
}: {
  fits: Map<number, DishFit> | undefined;
  children: React.ReactNode;
}) {
  return <DishFitContext.Provider value={fits}>{children}</DishFitContext.Provider>;
}

/**
 * Personalisation annotation for one dish — "Good match for you" / an
 * allergen-conflict warning — or nothing when there is no ranked fit (no
 * meaningful preferences yet, or this dish is a neutral/moderate match).
 * Rendered by DishCard at a fixed position in its server-rendered markup;
 * this is the only piece of that markup whose content depends on
 * client-fetched preferences.
 */
export function DishFitBadge({ dishId }: { dishId: number }) {
  const fits = useContext(DishFitContext);
  const fit = fits?.get(dishId);
  if (!fit) return null;
  if (fit.band === "conflict" && fit.conflictLabel) {
    return (
      <Text type="supporting" weight="bold" className="text-[var(--danger)]">
        {fit.conflictLabel}
      </Text>
    );
  }
  if (fit.band === "high") {
    return (
      <Text type="supporting" weight="bold" className="text-sage-text">
        Good match for you
      </Text>
    );
  }
  return null;
}
