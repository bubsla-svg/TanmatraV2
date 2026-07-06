// Adapter: map the real static DishData catalog into the compact shape the v2
// screens render. Keeps the v2 components close to the prototype while binding
// to production menu data.
import { DISHES, getDishBySlug, getDishById } from "@/lib/menuData";

export { DISHES, getDishBySlug, getDishById };

export const F = (paise: number) => "₹" + Math.round(paise / 100).toLocaleString("en-IN");
export const ar = (k: number, p: number, c: number, f: number) =>
  `Nutrition: ${k} kilocalories, ${p} grams protein, ${c} grams carbs, ${f} grams fat`;

export interface DishView {
  slug: string;
  name: string;
  k: number; p: number; c: number; f: number; fiber: number;
  priceStr: string;
  image: string;
  vcls: string; vlabel: string;
  gcls: string; glabel: string;
  gi: string;
  tag: string;
  aria: string;
  isVeg: boolean;
  rdVerified: boolean;
  rdNote?: string;
  prepTime: string;
  description: string;
  longDescription: string;
  ingredients: string[];
  allergens: string[];
  sugar: string;
  pairingSlug?: string;
}

export function toView(d: any): DishView {
  const m = d.macros || {};
  const gi: string = d.glycaemicIndex || "medium";
  return {
    slug: d.slug,
    name: d.name,
    k: m.calories ?? 0, p: m.protein ?? 0, c: m.carbs ?? 0, f: m.fat ?? 0, fiber: m.fiber ?? 0,
    priceStr: F(d.price),
    image: d.image,
    vcls: d.isVeg ? "vd" : "vd nv",
    vlabel: d.isVeg ? "VEG" : "NON-VEG",
    gcls: gi === "low" ? "gi gi-low" : "gi gi-med",
    glabel: gi === "low" ? "GI LOW" : gi === "high" ? "GI HIGH" : "GI MED",
    gi,
    tag: prettyCategory(d.category),
    aria: ar(m.calories ?? 0, m.protein ?? 0, m.carbs ?? 0, m.fat ?? 0),
    isVeg: !!d.isVeg,
    rdVerified: !!d.rdVerified,
    rdNote: d.rdNote,
    prepTime: d.prepTime || "",
    description: d.description || "",
    longDescription: d.longDescription || "",
    ingredients: d.ingredients || [],
    allergens: d.allergens || [],
    sugar: d.sugarPerServing || "",
    pairingSlug: d.pairingSlug,
  };
}

function prettyCategory(c: string): string {
  if (!c) return "";
  return c.charAt(0).toUpperCase() + c.slice(1).replace(/-/g, " ");
}
