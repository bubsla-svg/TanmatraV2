import { useState, useMemo, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { F } from "./data";
import { hapticLight, hapticWarning, hapticError } from "@/lib/haptics";
import { useBundles, groupOrdersApi } from "@/lib/queries";
import { macrosAreProvisional } from "@workspace/menu-catalog";
import {
  CATEGORY_LABELS,
  getDishById,
  useMenuCatalog,
  useRankedMenu,
  type RankedMenuItem,
  type DishCategory,
  type DishKitchen,
  type DishData,
} from "@/lib/menuData";
import type { UserPreferences } from "@/lib/preferencesApi";
import type { DishMatchResult } from "@/lib/preferencesMatch";
import {
  EXCLUDABLE_ALLERGENS,
  LIFESTYLE_LABELS,
  LIFESTYLE_TAGS,
  dishFailsAllergenExclusion,
  matchesLifestyle,
  matchesDietaryFilter,
  isSecondaryVariant,
  type Lifestyle,
} from "@/lib/dishEnrichment";
import {
  DIET_ORDER_BY_ID,
  LIFESTYLE_EHR_LABEL,
  dishMatchesDietOrder,
  useClinicalMode,
  clinicalModeStore,
} from "@/lib/clinicalDiet";
import { PROTOCOLS, PROTOCOL_LABELS, PROTOCOL_TAGLINES, isProtocol, matchesProtocol, type Protocol } from "@/lib/protocols";
import { useCart, useCartDrawer, useCartStore } from "@/lib/cartContext";
import StickyBottomBar from "@/components/layout/StickyBottomBar";
import { usePreferences } from "@/lib/preferencesContext";
import { useOrders } from "@/lib/ordersContext";
import { addressesApi } from "@/lib/userAddressesApi";
import { usePremiumStatus, usePremiumSlugs } from "@/lib/usePremium";
import { track } from "@/lib/analytics";
import { groupCatalogDishes, type ConsolidatedDish } from "@/lib/menuVariants";
import { localDishSrcset, getLocalDishFallback } from "@/lib/imgSrcset";
import { onDishImageError } from "@/lib/imgFallback";
import { evaluateDishForPreferences, rankDishesForPreferences } from "@/lib/preferencesMatch";
import { DELIVERY_ETA_TEXT } from "@/lib/deliveryPromise";
import { toast } from "sonner";

/* Full-parity re-port of the System-A Menu (git 2507084, 1489 lines) into the
 * v2 (.tnm2) design language — same hooks / handlers / filter logic, v2 UI. */

const KITCHEN_TABS: Array<"all" | DishKitchen> = ["all", "continental", "indian", "asian", "mediterranean"];
const CATEGORY_TABS: Array<"all" | DishCategory> = ["all", "beverages", "breakfast", "salads", "soups", "pasta", "wraps", "bowls", "snacks", "mains"];
const LIFESTYLE_TABS: Array<{ value: Lifestyle; label: string }> = [
  { value: "all", label: "All" },
  { value: "heart-healthy", label: LIFESTYLE_LABELS["heart-healthy"] },
  { value: "fitness-gains", label: LIFESTYLE_LABELS["fitness-gains"] },
  { value: "diabetes-management", label: LIFESTYLE_LABELS["diabetes-management"] },
  { value: "junior-explorers", label: LIFESTYLE_LABELS["junior-explorers"] },
  { value: "silver-vitality", label: LIFESTYLE_LABELS["silver-vitality"] },
];
type DietFilter = "all" | "veg" | "nonveg";
const QUICK_FILTERS = [
  { value: "high-protein", label: "High-Protein" },
  { value: "veg", label: "Veg" },
  // Backed by real catalog data (glycaemicIndex on every dish).
  { value: "low-gi", label: "Low GI" },
  // "(verified)" because the predicate only passes dishes with verified
  // (non-provisional) macros — a handful of dishes today, honestly labelled.
  { value: "keto", label: "Keto (verified)" },
  { value: "vegan", label: "Vegan" },
  { value: "gluten-free", label: "Gluten-Free" },
  { value: "jain", label: "Jain" },
  { value: "vata", label: "Vata Dosha" },
  { value: "pitta", label: "Pitta Dosha" },
  { value: "kapha", label: "Kapha Dosha" },
];
type SortOption = "recommended" | "price-asc" | "price-desc" | "protein" | "calories";
const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: "recommended", label: "Recommended" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "protein", label: "Protein (verified first)" },
  { value: "calories", label: "Calories (verified first)" },
];
const PAGE_SIZE = 24;

/* ─────────────────────────────────────────────────────────────────────────
 * Phase 2 — Ambient Personalization Grid
 *
 * A REAL "Biometric Match Score" derived purely from `evaluateDishForPreferences`.
 * No randomness: the score is a deterministic function of the preference-fit
 * signals (allergen/diet block, disliked ingredients, cuisine fit, and the
 * positive goal reasons the evaluator already surfaced).
 *
 * Honesty guardrails:
 *  - Blocked dishes never get a flattering number — they read "Off-plan".
 *  - When a dish's macros are PROVISIONAL (macrosAreProvisional), the score is
 *    built ONLY from non-macro signals (goal/cuisine/diet/allergen fit) so it
 *    never implies macro precision we don't actually have. The reason phrase
 *    stays general ("for your goal"), never "macro-calibrated".
 * ───────────────────────────────────────────────────────────────────────── */

/** Reasons/warnings whose text is derived from macro numbers (kcal/protein/carbs). */
const MACRO_TEXT_RE = /kcal|calorie|carb|protein|sugar|fat\b/i;

type MatchTier = "hi" | "mid" | "low";
export type MatchScore =
  | { kind: "none" }
  | { kind: "blocked" }
  | { kind: "scored"; score: number; tier: MatchTier; phrase: string | null; differentiated: boolean };

/** A short, general reason phrase tied to real preferences — never macro-precise. */
function goalPhrase(prefs: UserPreferences | null): string | null {
  if (!prefs) return null;
  const conds = (prefs.medicalConditions ?? []).map((c) => c.toLowerCase());
  if (conds.includes("diabetes")) return "for blood-sugar stability";
  if (conds.includes("hypertension") || conds.includes("high_blood_pressure") || conds.includes("high blood pressure"))
    return "for blood-pressure balance";
  switch (prefs.goal) {
    case "lose_weight": return "for your weight goal";
    case "gain_muscle": return "for muscle gain";
    case "maintain": return "to keep you balanced";
    case "general_wellness": return "for balanced wellness";
    default: return null;
  }
}

/**
 * Map a real DishMatchResult to a 0-100-ish match score.
 * Pure + deterministic. `provisional` drops all macro-derived signals so the
 * number can't imply precision the catalog hasn't verified yet.
 */
export function computeMatchScore(
  match: DishMatchResult | undefined,
  prefs: UserPreferences | null,
  provisional: boolean,
): MatchScore {
  if (!prefs) return { kind: "none" };
  if (!match || match.blocked) return { kind: "blocked" };

  // Positive fit — split the evaluator's reasons into macro vs non-macro.
  const reasons: string[] = match.reasons ?? [];
  const nonMacroReasons = reasons.filter((r: string) => !MACRO_TEXT_RE.test(r)).length;
  const macroReasons = reasons.length - nonMacroReasons;

  // Warnings for a non-blocked dish are either the single "dislikes" summary
  // or macro cautions (heavy kcal, light protein, keto carb cap).
  const warnings = match.warnings ?? [];
  const dislikeHits = match.matchedDislikes?.length ?? 0;
  const dislikeWarnings = dislikeHits > 0 ? 1 : 0;
  const macroWarnings = Math.max(0, warnings.length - dislikeWarnings);

  let score = 76;
  score += nonMacroReasons * 10;
  score -= dislikeHits * 10;
  if (!match.cuisineMatch) score -= 8; // cuisines set but this dish isn't on the list
  if (!provisional) {
    score += macroReasons * 10;
    score -= macroWarnings * 11;
  }

  // Whether ANY real signal moved the score off the 76 seed. For a sparse
  // profile (e.g. general_wellness, no cuisines/conditions) nothing fires and
  // every dish stays at a flat 76 — showing a precise "76% match" there implies
  // a precision the profile can't support (A4.1 / A8). In that case we suppress
  // the number and fall back to the categorical tier instead.
  const differentiated =
    nonMacroReasons > 0 ||
    dislikeHits > 0 ||
    !match.cuisineMatch ||
    (!provisional && (macroReasons > 0 || macroWarnings > 0));

  score = Math.max(46, Math.min(99, Math.round(score)));
  const tier: MatchTier = score >= 82 ? "hi" : score >= 64 ? "mid" : "low";
  const hasFit = reasons.length > 0 || score >= 78;
  const phrase = hasFit ? goalPhrase(prefs) : null;
  return { kind: "scored", score, tier, phrase, differentiated };
}

/** Static, honest glucose-curve placeholder — NOT live data. Purely decorative. */
const SPARK_PATH =
  "M0 30 L14 26 L28 31 L42 20 L56 24 L70 14 L84 22 L98 12 L112 19 L126 10 L140 17 L154 9 L168 15 L182 8 L200 13";

export default function V2Menu() {
  const { isPremium } = usePremiumStatus();
  const premiumSlugs = usePremiumSlugs();
  const navigate = useNavigate();

  useEffect(() => { track("view_menu"); }, []);

  // ── One-time initial-state hydration from URL params ──────────────────────
  // Home's trust-header search, category badges, veg toggle and "Healthy Mode"
  // deep-link into the menu; read those params on load and seed the existing
  // internal filter state. All existing menu behaviour is unchanged after this.
  const initialParams = useMemo(
    () => new URLSearchParams(typeof window !== "undefined" ? window.location.search : ""),
    [],
  );
  const initialQuery = initialParams.get("q")?.trim() ?? "";
  const dietParam = initialParams.get("diet");
  const initialDiet: DietFilter = dietParam === "veg" || dietParam === "nonveg" ? dietParam : "all";
  const categoryParam = initialParams.get("category");
  const initialCategory: "all" | DishCategory =
    categoryParam && (CATEGORY_TABS as string[]).includes(categoryParam)
      ? (categoryParam as DishCategory)
      : "all";
  const quickParam = initialParams.get("quick");
  const initialQuick: string[] =
    quickParam && QUICK_FILTERS.some((q) => q.value === quickParam) ? [quickParam] : [];
  const initialHealthy = initialParams.get("healthy") === "1";

  const [kitchen, setKitchen] = useState<"all" | DishKitchen>("all");
  const [category, setCategory] = useState<"all" | DishCategory>(initialCategory);
  const [diet, setDiet] = useState<DietFilter>(initialDiet);
  const [lifestyle, setLifestyle] = useState<Lifestyle>("all");
  const [quickFilters, setQuickFilters] = useState<string[]>(initialQuick);
  // Allergen EXCLUSION toggles (More filters). Unknown ≠ safe: excluding an
  // allergen also hides dishes whose allergen data is empty/unverified.
  const [excludedAllergens, setExcludedAllergens] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("recommended");
  const [showFilters, setShowFilters] = useState(false);
  const [showSearch, setShowSearch] = useState(initialQuery.length > 0);
  const [query, setQuery] = useState(initialQuery);
  // Healthy Mode: a profile/goal filter (NOT wearable data). It applies the
  // existing preference-based ranking + hard-hides off-plan dishes.
  const [healthyMode, setHealthyMode] = useState(initialHealthy);
  const [hideBlocked, setHideBlocked] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [customizingDish, setCustomizingDish] = useState<ConsolidatedDish | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  const { addItem, addBundleSlug } = useCart();
  const { open: openCart } = useCartDrawer();
  const cartBadgeCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const { preferences, unauthorized } = usePreferences();
  const isAssessed = preferences !== null && preferences.quizCompletedAt !== null;
  const [hasSavedAddress, setHasSavedAddress] = useState(false);

  useEffect(() => {
    // /addresses is auth-gated — only query it for a signed-in visitor. A
    // guest can have local preferences but no account, so gate on !unauthorized
    // to avoid a guaranteed 401 (which WebKit surfaces as a page error).
    if (preferences && !unauthorized) {
      addressesApi.list().then((r: any) => setHasSavedAddress(r.addresses.length > 0)).catch(() => setHasSavedAddress(false));
    } else setHasSavedAddress(false);
  }, [preferences, unauthorized]);

  const [searchParams, setSearchParams] = useSearchParams();
  const groupCode = searchParams.get("group");
  const protocolParam = searchParams.get("protocol");
  const activeProtocol: Protocol | null = isProtocol(protocolParam) ? protocolParam : null;

  const { data: bundles } = useBundles();
  const { dishes: catalogDishes } = useMenuCatalog();
  const { data: rankedItems, isLoading: rankedLoading } = useRankedMenu(preferences?.userId ?? null);
  const rankedMap = useMemo(() => {
    const map = new Map<number, RankedMenuItem>();
    if (rankedItems) {
      rankedItems.forEach((item) => map.set(item.dish_id, item));
    }
    return map;
  }, [rankedItems]);
  const { enabled: clinicalMode, dietOrderId } = useClinicalMode();
  const dietOrder = DIET_ORDER_BY_ID.get(dietOrderId);
  const { orders } = useOrders();
  const hasOrderHistory = orders.length > 0;

  const repeatMeals = useMemo(() => {
    if (!preferences && orders.length === 0) return [];
    const seen = new Set<number>();
    const list: DishData[] = [];
    orders.forEach((o: any) => o.items.forEach((item: any) => {
      if (!seen.has(item.dishId)) {
        seen.add(item.dishId);
        const dish = catalogDishes.find((d: any) => d.id === item.dishId);
        if (dish && dish.isAvailable && !isSecondaryVariant(dish.slug)) list.push(dish);
      }
    }));
    if (list.length < 6 && preferences) {
      catalogDishes.forEach((d: any) => {
        if (!seen.has(d.id) && d.isAvailable && !isSecondaryVariant(d.slug) && !evaluateDishForPreferences(d, preferences).blocked) {
          seen.add(d.id); list.push(d);
        }
      });
    }
    return list.slice(0, 8);
  }, [orders, preferences, catalogDishes]);

  const handleQuickAdd = (item: DishData) => {
    if (!item.isAvailable) return;
    if (groupCode) {
      groupOrdersApi.addItem(groupCode, { dishId: item.id, quantity: 1, customizations: [] })
        .then(() => { hapticLight(); toast.success(`Added ${item.name} to group ${groupCode}`); })
        .catch(() => { hapticError(); toast.error("Could not add to group order"); });
      return;
    }
    if (premiumSlugs.has(item.slug) && !isPremium) {
      hapticWarning();
      toast.error(`${item.name} is a Premium-only dish`, {
        description: "Join Tanmatra Premium to unlock chef-table dishes.",
        action: { label: "See Premium", onClick: () => navigate("/premium") },
      });
      return;
    }
    addItem({
      dishId: item.id, slug: item.slug, name: item.name, image: item.image,
      basePrice: item.price, unitPrice: item.price, quantity: 1,
      kitchen: item.kitchen, isVeg: item.isVeg, rdVerified: item.rdVerified,
      macros: item.macros, customizations: [],
    });
    hapticLight();
    // No auto-open drawer — keep the browse loop uninterrupted (Uber-Eats
    // pattern). The persistent StickyBottomBar + toast are the feedback.
    toast.success(`Added ${item.name} to your order`, { description: "Tap the cart to review and check out." });
  };

  const handleQuickAddClick = (parent: ConsolidatedDish) => {
    const original = catalogDishes.find((d: any) => d.id === parent.id);
    const match = original ? evaluateDishForPreferences(original, preferences) : null;
    const isBlocked = match?.blocked;

    if (parent.optionGroups.length > 0 || isBlocked) {
      setCustomizingDish(parent);
    } else {
      if (original) handleQuickAdd(original);
    }
  };

  const handleExpressBuy = (item: DishData) => {
    if (!item.isAvailable) return;
    addItem({
      dishId: item.id, slug: item.slug, name: item.name, image: item.image,
      basePrice: item.price, unitPrice: item.price, quantity: 1,
      kitchen: item.kitchen, isVeg: item.isVeg, rdVerified: item.rdVerified,
      macros: item.macros, customizations: [],
    });
    hapticLight();
    navigate("/checkout");
  };

  useEffect(() => {
    if (customizingDish) {
      const init: Record<string, string> = {};
      customizingDish.optionGroups.forEach((g) => { if (g.options.length) init[g.name] = g.options[0].name; });
      setSelectedOptions(init);
    }
  }, [customizingDish]);

  const activeVariant = useMemo(() => {
    if (!customizingDish) return null;
    const names = Object.values(selectedOptions);
    return customizingDish.variants.find((v) => v.optionNames.every((n) => names.includes(n))) || customizingDish.variants[0];
  }, [customizingDish, selectedOptions]);

  const handleAddBundle = (bundle: any) => {
    if (groupCode) { hapticWarning(); toast.error("Bundles can only be added to your personal cart"); return; }
    const before = new Set(useCartStore.getState().items.map((i: any) => i.lineId));
    let added = 0;
    for (const did of bundle.dishIds) {
      const dish = getDishById(did);
      if (!dish || !dish.isAvailable) continue;
      const ratio = bundle.pricePaise / Math.max(1, bundle.originalPricePaise);
      addItem({
        dishId: dish.id, slug: dish.slug, name: dish.name, image: dish.image,
        basePrice: dish.price, unitPrice: Math.round(dish.price * ratio), quantity: 1,
        kitchen: dish.kitchen, isVeg: dish.isVeg, rdVerified: dish.rdVerified,
        macros: dish.macros, customizations: [`Bundle: ${bundle.name}`],
      });
      added++;
    }
    if (added === 0) { hapticWarning(); toast.error("This bundle is currently unavailable"); return; }
    const newIds = useCartStore.getState().items.filter((i: any) => !before.has(i.lineId)).map((i: any) => i.lineId);
    addBundleSlug(bundle.slug);
    hapticLight();
    openCart();
    toast.success(`${bundle.name} added to your order`, {
      description: `${added} item${added === 1 ? "" : "s"} for ${F(bundle.pricePaise)}`,
      action: { label: "Undo", onClick: () => newIds.forEach((lid: string) => useCartStore.getState().removeItem(lid)) },
    });
  };

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [kitchen, category, diet, lifestyle, query, activeProtocol, quickFilters, excludedAllergens, sortBy]);

  const quickFilterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const base = catalogDishes.filter((d: any) => {
      if (!d.isAvailable) return false;
      if (kitchen !== "all" && d.kitchen !== kitchen) return false;
      if (category !== "all" && d.category !== category) return false;
      if (diet === "veg" && !d.isVeg) return false;
      if (diet === "nonveg" && d.isVeg) return false;
      if (!matchesLifestyle(d, lifestyle)) return false;
      if (activeProtocol && !matchesProtocol(d, activeProtocol)) return false;
      if (clinicalMode && dishMatchesDietOrder(d, dietOrderId) !== null) return false;
      if (dishFailsAllergenExclusion(d, excludedAllergens)) return false;
      const q = query.toLowerCase();
      if (query && !d.name.toLowerCase().includes(q) && !d.description.toLowerCase().includes(q)) return false;
      return true;
    });
    for (const qf of QUICK_FILTERS) counts[qf.value] = base.filter((d: any) => matchesDietaryFilter(d, qf.value)).length;
    return counts;
  }, [catalogDishes, kitchen, category, diet, lifestyle, activeProtocol, clinicalMode, dietOrderId, query, excludedAllergens]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = catalogDishes.filter((d: any) => {
      if (!d.isAvailable) return false;
      if (kitchen !== "all" && d.kitchen !== kitchen) return false;
      if (category !== "all" && d.category !== category) return false;
      if (diet === "veg" && !d.isVeg) return false;
      if (diet === "nonveg" && d.isVeg) return false;
      if (!matchesLifestyle(d, lifestyle)) return false;
      if (activeProtocol && !matchesProtocol(d, activeProtocol)) return false;
      if (clinicalMode && dishMatchesDietOrder(d, dietOrderId) !== null) return false;
      if (dishFailsAllergenExclusion(d, excludedAllergens)) return false;
      if (q && !d.name.toLowerCase().includes(q) && !d.description.toLowerCase().includes(q)) return false;
      if (quickFilters.length > 0) {
        if (quickFilters.includes("low-gi") && !matchesDietaryFilter(d, "low-gi")) return false;
        const nut = quickFilters.filter((f) => ["high-protein", "keto"].includes(f));
        const dt = quickFilters.filter((f) => ["veg", "vegan", "gluten-free", "jain"].includes(f));
        const dosha = quickFilters.filter((f) => ["vata", "pitta", "kapha"].includes(f));
        if (nut.length && !nut.some((f) => matchesDietaryFilter(d, f))) return false;
        if (dt.length && !dt.some((f) => matchesDietaryFilter(d, f))) return false;
        if (dosha.length && !dosha.some((f) => matchesDietaryFilter(d, f))) return false;
      }
      return true;
    });

    const isAssessed = preferences && preferences.quizCompletedAt !== null;
    let mapped: Array<{
      dish: DishData;
      match: DishMatchResult;
      fit_band: "high" | "moderate" | "neutral" | "conflict";
      rank: number;
      social_proof: string | null;
    }> = [];

    if (isAssessed && rankedItems && rankedItems.length > 0) {
      mapped = base.map((dish) => {
        const match = evaluateDishForPreferences(dish, preferences);
        const rInfo = rankedMap.get(dish.id);
        return {
          dish,
          match,
          fit_band: rInfo?.fit_band ?? "neutral",
          rank: rInfo?.rank ?? 9999,
          social_proof: rInfo?.social_proof ?? null,
        };
      });
    } else {
      const clientRanked = rankDishesForPreferences(base, preferences);
      mapped = clientRanked.map((cr) => ({
        ...cr,
        fit_band: cr.match.blocked ? "conflict" : "neutral",
        rank: 9999,
        social_proof: null,
      }));
    }

    const filteredRanked = hideBlocked || healthyMode
      ? mapped.filter((r) => r.fit_band !== "conflict")
      : mapped;

    return [...filteredRanked].sort((a, b) => a.rank - b.rank);
  }, [kitchen, category, diet, lifestyle, query, preferences, hideBlocked, healthyMode, catalogDishes, activeProtocol, clinicalMode, dietOrderId, quickFilters, excludedAllergens, rankedItems, rankedMap]);

  const consolidatedDishes = useMemo(() => {
    const grouped = groupCatalogDishes(filtered.map((f: any) => f.dish));
    const entries = grouped.map((parent) => {
      const rep = filtered.find((f: any) => f.dish.id === parent.id)!;
      return {
        parent,
        dish: rep.dish as DishData,
        match: rep.match,
        fit_band: rep.fit_band,
        social_proof: rep.social_proof,
        hasVariants: parent.optionGroups.length > 0,
      };
    });
    if (sortBy === "recommended") return entries;
    if (sortBy === "price-asc" || sortBy === "price-desc") {
      const dir = sortBy === "price-asc" ? 1 : -1;
      return [...entries].sort((a, b) => dir * (a.parent.variants[0].price - b.parent.variants[0].price));
    }
    const verified = entries.filter((e) => !macrosAreProvisional(e.dish));
    const provisional = entries.filter((e) => macrosAreProvisional(e.dish));
    if (sortBy === "protein") verified.sort((a, b) => b.dish.macros.protein - a.dish.macros.protein);
    else verified.sort((a, b) => a.dish.macros.calories - b.dish.macros.calories);
    return [...verified, ...provisional];
  }, [filtered, sortBy]);

  const blockedCount = useMemo(
    () => (!preferences ? 0 : catalogDishes.filter((d: any) => evaluateDishForPreferences(d, preferences).blocked).length),
    [preferences, catalogDishes],
  );

  const lifestyleTag = (() => {
    if (lifestyle === "all") return null;
    const consumer = LIFESTYLE_TAGS[lifestyle as Exclude<Lifestyle, "all">];
    if (!clinicalMode) return consumer;
    return LIFESTYLE_EHR_LABEL[lifestyle as string] ?? consumer;
  })();

  const activeFilterChips: Array<{ id: string; label: string; onClear: () => void }> = [];
  if (kitchen !== "all") activeFilterChips.push({ id: "k", label: kitchen[0].toUpperCase() + kitchen.slice(1), onClear: () => setKitchen("all") });
  if (category !== "all") activeFilterChips.push({ id: "c", label: CATEGORY_LABELS[category], onClear: () => setCategory("all") });
  if (diet !== "all") activeFilterChips.push({ id: "d", label: diet === "veg" ? "Veg" : "Non-Veg", onClear: () => setDiet("all") });
  if (lifestyle !== "all") activeFilterChips.push({ id: "l", label: clinicalMode ? LIFESTYLE_EHR_LABEL[lifestyle] ?? LIFESTYLE_LABELS[lifestyle] : LIFESTYLE_LABELS[lifestyle], onClear: () => setLifestyle("all") });
  if (activeProtocol) activeFilterChips.push({ id: "p", label: PROTOCOL_LABELS[activeProtocol], onClear: () => clearProtocol() });
  if (query.trim()) activeFilterChips.push({ id: "q", label: `"${query.trim()}"`, onClear: () => setQuery("") });
  quickFilters.forEach((v) => { const i = QUICK_FILTERS.find((q) => q.value === v); if (i) activeFilterChips.push({ id: `qf-${v}`, label: i.label, onClear: () => setQuickFilters((p) => p.filter((x) => x !== v)) }); });
  excludedAllergens.forEach((v) => { const a = EXCLUDABLE_ALLERGENS.find((e) => e.value === v); if (a) activeFilterChips.push({ id: `xa-${v}`, label: `No ${a.label.toLowerCase()}`, onClear: () => setExcludedAllergens((p) => p.filter((x) => x !== v)) }); });

  function clearProtocol() {
    const next = new URLSearchParams(searchParams);
    next.delete("protocol");
    setSearchParams(next, { replace: true });
  }
  function setProtocol(p: string) {
    const next = new URLSearchParams(searchParams);
    if (p === "all") next.delete("protocol"); else next.set("protocol", p);
    setSearchParams(next, { replace: true });
  }
  function resetAll() {
    setKitchen("all"); setCategory("all"); setDiet("all"); setLifestyle("all"); setQuery(""); setQuickFilters([]); setExcludedAllergens([]); setHealthyMode(false);
    if (activeProtocol) clearProtocol();
  }

  const secondaryActive = [lifestyle, diet, category, kitchen].filter((v) => v !== "all").length + excludedAllergens.length;

  return (
    <div className="tnm2 nn min-h-dvh bg-[var(--tnm-surface-ink)] text-white antialiased">
      <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100dvh" }}>
        {/* Sticky header cluster — app bar + search + filter rails stay pinned
            so re-filtering never means scrolling back to the top (Uber-Eats). */}
        <div className="menu-stickytop">
        {/* App bar */}
        <div className="appbar">
          <Link className="iconbtn" to="/" aria-label="Home"><i className="ph-bold ph-arrow-left" /></Link>
          <h1 className="abt">{activeProtocol ? `${PROTOCOL_LABELS[activeProtocol]} Program` : "Menu"}</h1>
          <button className="iconbtn" onClick={() => setShowSearch((s) => !s)} aria-label="Search"><i className="ph-bold ph-magnifying-glass" /></button>
          <button
            className="iconbtn"
            style={{ position: "relative" }}
            onClick={openCart}
            aria-label={`Cart, ${cartBadgeCount} item${cartBadgeCount === 1 ? "" : "s"}`}
          >
            <i className="ph-bold ph-shopping-bag" />
            {cartBadgeCount > 0 && (
              <span
                className="tnm-data"
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  minWidth: 16,
                  height: 16,
                  padding: "0 4px",
                  borderRadius: 999,
                  background: "var(--saf)",
                  color: "var(--onsaf)",
                  fontSize: 10,
                  fontWeight: 700,
                  lineHeight: "16px",
                  textAlign: "center",
                }}
              >
                {cartBadgeCount}
              </span>
            )}
          </button>
        </div>

        {showSearch && (
          <div className="padx mb10">
            <div className="inp">
              <i className="ph-bold ph-magnifying-glass" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search dishes…" autoFocus />
              {query && <button onClick={() => setQuery("")} aria-label="Clear"><i className="ph-bold ph-x" style={{ color: "var(--fnt)" }} /></button>}
            </div>
          </div>
        )}

        {/* Protocol chips */}
        <div className="chiprow" role="group" aria-label="Filter by program">
          {(["all", ...PROTOCOLS] as const).map((p) => {
            const active = p === "all" ? !activeProtocol : activeProtocol === p;
            return (
              <button key={p} className={active ? "chip on" : "chip"} onClick={() => setProtocol(p)} aria-pressed={active}>
                {p === "all" ? "All programs" : PROTOCOL_LABELS[p]}
              </button>
            );
          })}
        </div>

        {/* Quick filters */}
        <div className="chiprow" role="group" aria-label="Quick filters">
          {QUICK_FILTERS.map((qf) => {
            const active = quickFilters.includes(qf.value);
            const count = quickFilterCounts[qf.value] ?? 0;
            const disabled = count === 0 && !active;
            return (
              <button
                key={qf.value}
                className={active ? "chip on" : "chip"}
                disabled={disabled}
                style={disabled ? { opacity: 0.4, textDecoration: "line-through" } : undefined}
                onClick={() => setQuickFilters((prev) => (active ? prev.filter((v) => v !== qf.value) : [...prev, qf.value]))}
              >
                {active && <i className="ph-bold ph-check" />}{qf.label}
                <span className="mono fntc" style={{ fontSize: 9 }}>({count})</span>
              </button>
            );
          })}
        </div>

        </div>{/* /menu-stickytop */}

        <div className="content padx" style={{ paddingTop: 4, paddingBottom: 96 }}>
          {/* Clinical-mode diet-order banner */}
          {clinicalMode && dietOrder && (
            <div className="banner mb10 fx ac gap8" style={{ padding: "10px 12px" }}>
              <span className="lab" style={{ color: "var(--safb)" }}>{dietOrder.short}</span>
              <span className="fine f1">{dietOrder.description}</span>
              <button onClick={() => clinicalModeStore.disable()} className="fine" aria-label="Exit clinical mode"><i className="ph-bold ph-x" /> Exit</button>
            </div>
          )}

          {/* Healthy Mode — goal/profile filter (NOT wearable data) */}
          {healthyMode && (
            <div className="banner mb10 fx ac gap8">
              <i className="ph-fill ph-heartbeat" style={{ color: "var(--safb)" }} />
              <span className="fine f1">
                <b style={{ color: "var(--tx)" }}>Healthy Mode</b> — ranked for your {preferences ? "profile & goal" : "goals"} and off-plan dishes hidden.
                {!preferences && <> <Link to="/preferences" style={{ color: "var(--safb)" }}>Set your goal →</Link></>}
              </span>
              <button className="fine" style={{ color: "var(--safb)" }} onClick={() => setHealthyMode(false)} aria-label="Turn off Healthy Mode">Turn off</button>
            </div>
          )}

          {/* Delivery promise */}
          <div className="note mb10" style={{ background: "var(--safd)", borderColor: "var(--saf)", color: "var(--safb)" }}>
            <i className="ph-fill ph-lightning" />
            <span>Delivered fresh to your doorstep in <b>{DELIVERY_ETA_TEXT}</b></span>
          </div>

          {/* Protocol tagline */}
          {activeProtocol && (
            <div className="banner mb10 fx ac gap8">
              <i className="ph-fill ph-sparkle" style={{ color: "var(--safb)" }} />
              <span className="fine f1">{PROTOCOL_TAGLINES[activeProtocol]}</span>
              <button className="fine" style={{ color: "var(--safb)" }} onClick={clearProtocol}>Clear</button>
            </div>
          )}

          {/* Group order banner */}
          {groupCode && (
            <div className="card mb10 fx ac gap8" style={{ padding: 12 }}>
              <i className="ph-bold ph-users" style={{ color: "var(--safb)" }} />
              <span className="fine f1">Adding to group <span className="mono" style={{ color: "var(--safb)" }}>{groupCode}</span> — items go to the shared order.</span>
              <Link to={`/group/${groupCode}`} className="fine" style={{ color: "var(--safb)" }}>View →</Link>
            </div>
          )}

          {/* Re-order / picked-for-you carousel */}
          {repeatMeals.length > 0 && !groupCode && (
            <div className="mb14">
              <div className="fx ac jb mb10">
                <span className="sh"><i className="ph-fill ph-lightning" style={{ color: "var(--safb)" }} /> {hasOrderHistory ? "Your usual meals" : "Matched to your goals"}</span>
                <span className="lab">tap + to add</span>
              </div>
              <div className="hrail" style={{ marginLeft: -16, marginRight: -16 }}>
                {repeatMeals.map((dish) => (
                  <div key={dish.id} className="hcard">
                    <Link to={`/dish/${dish.slug}`}>
                      <div className="himg plc" style={{ position: "relative", overflow: "hidden" }}>
                        <picture>
                          <source srcSet={localDishSrcset(dish.image, "avif")} type="image/avif" />
                          <source srcSet={localDishSrcset(dish.image, "webp")} type="image/webp" />
                          <img
                            src={getLocalDishFallback(dish.image, 200)}
                            srcSet={localDishSrcset(dish.image, "jpg")}
                            sizes="152px"
                            width="152"
                            height="88"
                            loading="lazy"
                            decoding="async"
                            alt={dish.name}
                            onError={onDishImageError}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        </picture>
                      </div>
                    </Link>
                    <div className="hbody">
                      <div className="fx ac g6 mb4">
                        <span className="vtag"><span className={dish.isVeg ? "vd" : "vd nv"} />{dish.isVeg ? "VEG" : "NON-VEG"}</span>
                      </div>
                      <Link to={`/dish/${dish.slug}`} className="small clamp1" style={{ fontWeight: 600, display: "block" }}>{dish.name}</Link>
                      <div className="mono" style={{ fontSize: 10, color: "var(--fnt)" }}>
                        {macrosAreProvisional(dish) ? "macros being verified" : `${dish.macrosEstimated ? "~" : ""}${dish.macros.calories} kcal · ${dish.macros.protein}g P${dish.macrosEstimated ? " · est" : ""}`}
                      </div>
                      <div className="fx ac jb mt6">
                        <span className="price" style={{ fontSize: 13, color: "var(--safb)" }}>{F(dish.price)}</span>
                        <button className="qbtn" onClick={() => handleQuickAdd(dish)} aria-label={`Add ${dish.name}`}><i className="ph-bold ph-plus" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* RD-curated combos. useBundles has no placeholder, so on first paint
              `bundles` is undefined and the whole block used to pop in AFTER the
              grid had painted — translating the dish grid downward (the dominant
              /menu CLS source). Reserve the block's height with a skeleton while
              it loads so the grid lands in its final position on first paint. */}
          {!groupCode && bundles === undefined && (
            <div className="mb14" aria-hidden="true">
              <div className="sh mb10"><i className="ph-bold ph-package" style={{ color: "var(--safb)" }} /> RD-curated combos</div>
              {[0, 1].map((i) => (
                <div key={i} className="card mb10" style={{ minHeight: 96 }}>
                  <div className="bg-white/[0.06]" style={{ height: 16, width: "55%", borderRadius: 6 }} />
                  <div className="mt10 bg-white/5" style={{ height: 13, width: "38%", borderRadius: 6 }} />
                  <div className="mt10 bg-white/[0.04]" style={{ height: 24, width: "100%", borderRadius: 6 }} />
                </div>
              ))}
            </div>
          )}
          {bundles && bundles.length > 0 && !groupCode && (
            <div className="mb14">
              <div className="sh mb10"><i className="ph-bold ph-package" style={{ color: "var(--safb)" }} /> RD-curated combos</div>
              {bundles.map((b: any) => {
                const savings = b.originalPricePaise - b.pricePaise;
                const included = b.dishIds.map((id: number) => getDishById(id)).filter(Boolean) as DishData[];
                return (
                  <div key={b.id} className="card mb10">
                    <div className="fx ac jb">
                      <div className="f1" style={{ minWidth: 0 }}>
                        <div className="tt" style={{ fontSize: 15 }}>{b.name}</div>
                        <div className="fine mt2 clamp1">{included.map((d) => d.name).join(" · ")}</div>
                      </div>
                      {b.badge && <span className="pill" style={{ background: "var(--safd)", color: "var(--safb)" }}>{b.badge}</span>}
                    </div>
                    <div className="fx ac jb mt10">
                      <div className="fx ac gap8">
                        <span className="price" style={{ fontSize: 17, color: "var(--safb)" }}>{F(b.pricePaise)}</span>
                        <span className="mono fntc strike" style={{ fontSize: 12 }}>{F(b.originalPricePaise)}</span>
                        <span className="pill sg" style={{ fontSize: 10 }}>Save {F(savings)}</span>
                      </div>
                      <button className="btn btn-s" style={{ height: 38 }} onClick={() => handleAddBundle(b)}><i className="ph-bold ph-plus-circle" /> Add combo</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Secondary filters (collapsible) */}
          <button className="opt mb10" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} style={{ marginBottom: 10 }}>
            <i className="ph-bold ph-sliders-horizontal" />
            <span className="f1">More filters {secondaryActive > 0 && <span className="pill" style={{ marginLeft: 6 }}>{secondaryActive}</span>}</span>
            <i className={showFilters ? "ph-bold ph-caret-up" : "ph-bold ph-caret-down"} />
          </button>

          {showFilters && (
            <div className="mb10">
              <FilterRail label={clinicalMode ? "Therapeutic diet" : "Lifestyle"}>
                {LIFESTYLE_TABS.map(({ value, label }) => {
                  const l = clinicalMode && value !== "all" ? LIFESTYLE_EHR_LABEL[value] ?? label : label;
                  return <button key={value} className={lifestyle === value ? "chip on" : "chip"} onClick={() => setLifestyle(value)}>{l}</button>;
                })}
              </FilterRail>
              <FilterRail label="Diet">
                {(["all", "veg", "nonveg"] as DietFilter[]).map((opt) => (
                  <button key={opt} className={diet === opt ? "chip on" : "chip"} onClick={() => setDiet(opt)}>
                    {opt !== "all" && <span className={opt === "veg" ? "vd" : "vd nv"} />}{opt === "all" ? "All" : opt === "veg" ? "Veg" : "Non-Veg"}
                  </button>
                ))}
              </FilterRail>
              <FilterRail label="Category">
                {CATEGORY_TABS.map((c) => (
                  <button key={c} className={category === c ? "chip on" : "chip"} onClick={() => setCategory(c)}>{c === "all" ? "All" : CATEGORY_LABELS[c]}</button>
                ))}
              </FilterRail>
              <FilterRail label="Kitchen">
                {KITCHEN_TABS.map((k) => (
                  <button key={k} className={kitchen === k ? "chip on" : "chip"} onClick={() => setKitchen(k)}>{k === "all" ? "All" : k[0].toUpperCase() + k.slice(1)}</button>
                ))}
              </FilterRail>
              <FilterRail label="Avoid allergens">
                {EXCLUDABLE_ALLERGENS.map((a) => {
                  const on = excludedAllergens.includes(a.value);
                  return (
                    <button
                      key={a.value}
                      className={on ? "chip on" : "chip"}
                      aria-pressed={on}
                      onClick={() => setExcludedAllergens((p) => (on ? p.filter((v) => v !== a.value) : [...p, a.value]))}
                    >
                      {on && <i className="ph-bold ph-prohibit" />}No {a.label.toLowerCase()}
                    </button>
                  );
                })}
              </FilterRail>
              <div className="fine mb6" style={{ color: "var(--fnt)" }}>Excludes dishes with unverified allergen data</div>
            </div>
          )}

          {/* Dosha / Jain guarantee notes */}
          {quickFilters.some((f) => ["vata", "pitta", "kapha"].includes(f)) && (
            <div className="note mb10" style={{ background: "var(--s2)", borderColor: "var(--ln2)", color: "var(--mut)" }}>
              <i className="ph-bold ph-info" /><span><b style={{ color: "var(--tx)" }}>Ayurvedic tip:</b> Doshas are traditional body types — if your doctor advised a standard heart/diabetic plan, focus on High-Protein or Low GI instead.</span>
            </div>
          )}
          {quickFilters.includes("jain") && (
            <div className="note mb10"><i className="ph-bold ph-info" /><span><b>Jain-style picks:</b> filtered by ingredient keywords — please confirm root-vegetable-free preparation with us on WhatsApp before ordering for strict Jain requirements.</span></div>
          )}

          {/* Preferences banner */}
          {preferences && (
            <div className="banner mb10 fx ac gap8" style={{ flexWrap: "wrap" }}>
              <i className="ph-fill ph-sparkle" style={{ color: "var(--safb)" }} />
              <span className="fine">Personalized for your <span style={{ color: "var(--safb)", textTransform: "capitalize" }}>{preferences.dietaryStyle}</span> profile
                {blockedCount > 0 && <> · <button className="fine" style={{ color: "var(--safb)", textDecoration: "underline" }} onClick={() => setHideBlocked((v) => !v)}>{hideBlocked ? `${blockedCount} hidden — show` : "hide conflicts"}</button></>}
              </span>
              <Link to="/preferences" className="fine" style={{ marginLeft: "auto", color: "var(--safb)" }}><i className="ph-bold ph-sliders-horizontal" /> Edit</Link>
            </div>
          )}

          {/* Active filter chips */}
          {activeFilterChips.length > 0 && (
            <div className="fx ac g6 wrap mb10">
              {activeFilterChips.map((c) => (
                <button key={c.id} className="chip on" onClick={c.onClear} style={{ height: 30 }}>{c.label} <i className="ph-bold ph-x" style={{ fontSize: 12 }} /></button>
              ))}
              <button className="fine" style={{ color: "var(--safb)" }} onClick={resetAll}>Clear all</button>
            </div>
          )}

          <div className="fx ac jb mb10">
            <div className="lab">{consolidatedDishes.length} {consolidatedDishes.length === 1 ? "dish" : "dishes"}</div>
            <label className="fx ac g6">
              <span className="lab" style={{ padding: 0 }}>Sort</span>
              <select
                className="chip"
                aria-label="Sort dishes"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                style={{ height: 30, paddingRight: 10, appearance: "auto" as any }}
              >
                {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          </div>

          {/* Empty state — reserves a fixed block instead of collapsing to
              its content height, so clearing a filter (which re-mounts the
              populated grid in this same slot) can't shift anything above
              or below it. */}
          {consolidatedDishes.length === 0 ? (
            <div className="tc" style={{ padding: "40px 20px", minHeight: 320 }}>
              <i className="ph-bold ph-warning" style={{ fontSize: 32, color: "var(--saf)" }} />
              <div className="tt mt10">No dishes match your filters</div>
              <div className="fine mt6">Try loosening a filter or clearing the search.</div>
              <button className="btn btn-g mt20" onClick={resetAll}>Reset filters</button>
            </div>
          ) : (
            <>
              {/* Onboarding Quiz banner for unassessed users */}
              {!isAssessed && (
                <div className="bg-[var(--tnm-surface-ink-2)] border border-white/[0.06] rounded-xl p-4 mb-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-xs leading-normal text-white/90">
                      Answer 5 questions (about 60 seconds) to rank this menu for you.
                    </div>
                  </div>
                  <Link
                    to="/preferences"
                    className="btn btn-p shrink-0"
                    style={{ padding: "6px 12px", height: "auto", fontSize: 11 }}
                  >
                    Start Quiz
                  </Link>
                </div>
              )}

              {category !== "all" ? (
                // Flat grid when filtering by category
                <div className="prodgrid onecol">
                  {consolidatedDishes.slice(0, visibleCount).map(({ parent, dish: rep, match, fit_band, social_proof, hasVariants }, cardIndex) => {
                    const price = parent.variants[0].price;
                    const scoreInfo = computeMatchScore(match, preferences, macrosAreProvisional(rep));
                    return (
                      <DishCard
                        key={parent.id}
                        dish={rep}
                        name={parent.name}
                        price={price}
                        match={match}
                        scoreInfo={scoreInfo}
                        hasVariants={hasVariants}
                        isPremiumOnly={premiumSlugs.has(parent.slug)}
                        isPremium={isPremium}
                        lifestyleTag={lifestyleTag}
                        showWearableTeaser={cardIndex === 0}
                        canExpress={hasSavedAddress && !hasVariants}
                        fit_band={fit_band}
                        social_proof={social_proof}
                        onAdd={() => handleQuickAddClick(parent)}
                        onExpress={() => handleExpressBuy(rep)}
                        onPremiumGate={() => navigate("/premium")}
                      />
                    );
                  })}
                </div>
              ) : (
                // Sectioned rendering when category is "all"
                (() => {
                  const goalMatched = isAssessed
                    ? consolidatedDishes.filter((e) => e.fit_band === "high").slice(0, 8)
                    : [];
                  const goalMatchedIds = new Set(goalMatched.map((e) => e.dish.id));
                  const rest = consolidatedDishes.filter((e) => !goalMatchedIds.has(e.dish.id));

                  let remainingLimit = visibleCount;

                  return (
                    <div className="flex flex-col gap-6">
                      {/* Section 1: Goal Match */}
                      {goalMatched.length > 0 && (
                        <div>
                          <h2 className="sh mb10 fx ac gap6 text-[var(--tnm-action)] uppercase tracking-[0.06em] text-[11px] font-semibold">
                            <i className="ph-fill ph-sparkle text-[var(--tnm-action)] text-xs" />
                            Matched to your goal
                          </h2>
                          <div className="prodgrid onecol">
                            {goalMatched.map(({ parent, dish: rep, match, fit_band, social_proof, hasVariants }, idx) => {
                              const price = parent.variants[0].price;
                              const scoreInfo = computeMatchScore(match, preferences, macrosAreProvisional(rep));
                              return (
                                <DishCard
                                  key={parent.id}
                                  dish={rep}
                                  name={parent.name}
                                  price={price}
                                  match={match}
                                  scoreInfo={scoreInfo}
                                  hasVariants={hasVariants}
                                  isPremiumOnly={premiumSlugs.has(parent.slug)}
                                  isPremium={isPremium}
                                  lifestyleTag={lifestyleTag}
                                  showWearableTeaser={idx === 0}
                                  canExpress={hasSavedAddress && !hasVariants}
                                  fit_band={fit_band}
                                  social_proof={social_proof}
                                  onAdd={() => handleQuickAddClick(parent)}
                                  onExpress={() => handleExpressBuy(rep)}
                                  onPremiumGate={() => navigate("/premium")}
                                />
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Section 2: Categories in RD-curated order */}
                      {CATEGORY_TABS.map((cat) => {
                        if (cat === "all") return null;
                        const catDishes = rest.filter((e) => e.dish.category === cat);
                        if (catDishes.length === 0 || remainingLimit <= 0) return null;

                        const renderList = catDishes.slice(0, remainingLimit);
                        remainingLimit -= renderList.length;

                        return (
                          <div key={cat}>
                            <h2 className="sh mb10 uppercase tracking-[0.06em] text-[11px] font-semibold text-white/50" style={{ textTransform: "uppercase" }}>
                              {CATEGORY_LABELS[cat]}
                            </h2>
                            <div className="prodgrid onecol">
                              {renderList.map(({ parent, dish: rep, match, fit_band, social_proof, hasVariants }) => {
                                const price = parent.variants[0].price;
                                const scoreInfo = computeMatchScore(match, preferences, macrosAreProvisional(rep));
                                return (
                                  <DishCard
                                    key={parent.id}
                                    dish={rep}
                                    name={parent.name}
                                    price={price}
                                    match={match}
                                    scoreInfo={scoreInfo}
                                    hasVariants={hasVariants}
                                    isPremiumOnly={premiumSlugs.has(parent.slug)}
                                    isPremium={isPremium}
                                    lifestyleTag={lifestyleTag}
                                    showWearableTeaser={false}
                                    canExpress={hasSavedAddress && !hasVariants}
                                    fit_band={fit_band}
                                    social_proof={social_proof}
                                    onAdd={() => handleQuickAddClick(parent)}
                                    onExpress={() => handleExpressBuy(rep)}
                                    onPremiumGate={() => navigate("/premium")}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}

              {visibleCount < consolidatedDishes.length && (
                <button className="btn btn-g btn-blk mt10" onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}>
                  Load {Math.min(PAGE_SIZE, consolidatedDishes.length - visibleCount)} more
                  <span className="mono fntc" style={{ marginLeft: 6, fontSize: 11 }}>({visibleCount}/{consolidatedDishes.length})</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Customization sheet */}
      {customizingDish && activeVariant && (
        <div className="bg-[color-mix(in_srgb,var(--tnm-surface-ink)_95%,transparent)] backdrop-blur-md" style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setCustomizingDish(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, width: "100%", background: "var(--tnm-surface-ink-2)", borderRadius: "var(--radius-sheet) var(--radius-sheet) 0 0", borderTop: "1px solid white/[0.08]", padding: 16, paddingBottom: "calc(16px + var(--safe-bottom))", maxHeight: "min(85vh, 85dvh)", overflowY: "auto" }}>
            <div style={{ margin: "0 auto 10px", height: 6, width: 40, borderRadius: 999, background: "var(--ln2)" }} aria-hidden="true" />
            <div className="fx ac jb mb10">
              <div className="h2" style={{ fontSize: 18 }}>Customise {customizingDish.name}</div>
              <button className="iconbtn" onClick={() => setCustomizingDish(null)} aria-label="Close"><i className="ph-bold ph-x" /></button>
            </div>
            <div className="fine mb10">{customizingDish.description}</div>

            {customizingDish.optionGroups.map((group) => (
              <div key={group.name} className="mb14">
                <div className="lab mb6">{group.name}</div>
                {group.options.map((option) => {
                  const sel = selectedOptions[group.name] === option.name;
                  const optDish = catalogDishes.find((d: any) => d.id === option.dishId);
                  const diff = optDish ? optDish.price - customizingDish.variants[0].price : 0;
                  return (
                    <button key={option.name} className={sel ? "opt on" : "opt"} onClick={() => setSelectedOptions((p) => ({ ...p, [group.name]: option.name }))}>
                      <i className={sel ? "ph-fill ph-radio-button" : "ph-bold ph-circle"} />
                      <span className="f1">{option.name}</span>
                      {diff > 0 && <span className="mono" style={{ fontSize: 13, color: "var(--sage)" }}>+{F(diff)}</span>}
                    </button>
                  );
                })}
              </div>
            ))}

            <div className="card mb14">
              <div className="fx ac jb"><span className="fine">Calibrated price</span><span className="price" style={{ fontSize: 18, color: "var(--safb)" }}>{F(activeVariant.price)}</span></div>
              {/* Same honesty rule as the card ribbon / PDP: provisional macro
                  blocks are shown as "being verified", never as real numbers. */}
              {macrosAreProvisional(activeVariant) ? (
                <div className="ribbon cmp mt10" role="group" aria-label="Macros being verified">
                  <div className="rc">
                    <span className="rl">NUTRITION</span>
                    <span className="mono" style={{ fontSize: 10, color: "var(--fnt)", lineHeight: "16px" }}>macros being verified</span>
                  </div>
                </div>
              ) : (
                <div className="ribbon cmp mt10">
                  <div className="rc"><span className="rl">KCAL</span><span className="rv sf">{activeVariant.macros.calories}</span></div>
                  <div className="rc"><span className="rl">P</span><span className="rv">{activeVariant.macros.protein}<i className="ru">g</i></span></div>
                  <div className="rc"><span className="rl">C</span><span className="rv">{activeVariant.macros.carbs}<i className="ru">g</i></span></div>
                  <div className="rc"><span className="rl">F</span><span className="rv">{activeVariant.macros.fat}<i className="ru">g</i></span></div>
                </div>
              )}
            </div>

            {/* Structured safety conflict/warning explanations */}
            {(() => {
              const original = catalogDishes.find((d: any) => d.id === activeVariant.id);
              const m = original ? evaluateDishForPreferences(original, preferences) : null;
              if (m?.blocked) {
                return (
                  <div className="mb14 p10 border rounded-lg fx ac gap8 bg-[color-mix(in_srgb,var(--color-nn-error)_10%,transparent)] border-[color-mix(in_srgb,var(--color-nn-error)_20%,transparent)] text-[var(--color-nn-error)] text-xs">
                    <i className="ph-fill ph-warning-circle text-base" />
                    <div>
                      <span className="font-semibold block">Safety Conflict</span>
                      Not recommended: Contains <b>{m.matchedAllergens.join(", ") || "conflict ingredients"}</b>.
                    </div>
                  </div>
                );
              }
              if (m && m.warnings.length > 0) {
                return (
                  <div className="mb14 p10 border rounded-lg fx ac gap8 bg-[color-mix(in_srgb,var(--tnm-action)_8%,transparent)] border-[color-mix(in_srgb,var(--tnm-action)_20%,transparent)] text-[var(--tnm-action)] text-xs">
                    <i className="ph-fill ph-warning text-base" />
                    <div>
                      <span className="font-semibold block">Plan Warning</span>
                      {m.warnings[0]}
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            <div className="fx ac gap12">
              <button className="btn btn-g f1" onClick={() => setCustomizingDish(null)}>Cancel</button>
              <button
                className="btn btn-p f1"
                disabled={(() => {
                  const original = catalogDishes.find((d: any) => d.id === activeVariant.id);
                  const m = original ? evaluateDishForPreferences(original, preferences) : null;
                  return m?.blocked;
                })()}
                style={(() => {
                  const original = catalogDishes.find((d: any) => d.id === activeVariant.id);
                  const m = original ? evaluateDishForPreferences(original, preferences) : null;
                  return m?.blocked ? { opacity: 0.5, cursor: "not-allowed" } : undefined;
                })()}
                onClick={() => {
                  const original = catalogDishes.find((d: any) => d.id === activeVariant.id);
                  if (!original) return;
                  if (premiumSlugs.has(original.slug) && !isPremium) {
                    hapticWarning();
                    toast.error(`${original.name} is a Premium-only dish`, { description: "Join Tanmatra Premium to unlock chef-table dishes.", action: { label: "See Premium", onClick: () => navigate("/premium") } });
                    return;
                  }
                  addItem({
                    dishId: original.id, slug: original.slug, name: original.name, image: original.image,
                    basePrice: original.price, unitPrice: original.price, quantity: 1,
                    kitchen: original.kitchen, isVeg: original.isVeg, rdVerified: original.rdVerified,
                    macros: original.macros, customizations: [],
                  });
                  hapticLight();
                  setCustomizingDish(null);
                  openCart();
                  toast.success(`Added ${original.name} to your order`);
                }}
              >
                {(() => {
                  const original = catalogDishes.find((d: any) => d.id === activeVariant.id);
                  const m = original ? evaluateDishForPreferences(original, preferences) : null;
                  if (m?.blocked) return "Blocked by safety plan";
                  return premiumSlugs.has(activeVariant.slug) && !isPremium ? "Upgrade to Premium" : "Add to order";
                })()}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent cart bar — Uber-Eats "View cart" parity; empty cart renders nothing. */}
      <StickyBottomBar context="homepage" />
    </div>
  );
}

function FilterRail({ label, children }: { label: string; children: any }) {
  return (
    <div className="mb6">
      <div className="lab" style={{ padding: "0 0 6px" }}>{label}</div>
      <div className="fx ac g6 wrap">{children}</div>
    </div>
  );
}

function DishCard({
  dish,
  name,
  price,
  match,
  scoreInfo,
  hasVariants,
  isPremiumOnly,
  isPremium,
  lifestyleTag,
  showWearableTeaser,
  canExpress,
  fit_band,
  social_proof,
  onAdd,
  onExpress,
  onPremiumGate
}: any) {
  const { preferences } = usePreferences();
  const isAssessed = preferences !== null && preferences.quizCompletedAt !== null;
  // In-place quantity stepper: the cart line for this dish added without
  // customizations (a plain menu quick-add), if any. Selecting primitives keeps
  // each card from re-rendering unless its own line changes.
  const cartLineId = useCartStore((s: any) => {
    const line = s.items.find(
      (i: any) => i.dishId === dish.id && (!i.customizations || i.customizations.length === 0),
    );
    return line ? line.lineId : null;
  });
  const cartQty = useCartStore((s: any) => {
    const line = s.items.find(
      (i: any) => i.dishId === dish.id && (!i.customizations || i.customizations.length === 0),
    );
    return line ? line.quantity : 0;
  });
  const stepQty = useCartStore((s: any) => s.updateQty);
  const stepRemove = useCartStore((s: any) => s.removeItem);
  const isVeg = !!dish.isVeg;
  const gi = dish.glycaemicIndex || "medium";
  const giCls = gi === "low" ? "gi gi-low" : "gi gi-med";
  const giLabel = gi === "low" ? "GI LOW" : gi === "high" ? "GI HIGH" : "GI MED";
  const blocked = match?.blocked;
  const warned = match?.warnings?.length > 0;
  const provisional = macrosAreProvisional(dish);
  const info: MatchScore = scoreInfo ?? { kind: "none" };
  // Show the in-place stepper once a plain (non-variant) line is in the cart.
  const showStepper = cartQty > 0 && !hasVariants && !blocked && !(isPremiumOnly && !isPremium);

  const handleLinkClick = (e: React.MouseEvent) => {
    if (blocked) {
      e.preventDefault();
      onAdd();
    }
  };

  return (
    <div className="dcard" style={blocked ? { opacity: 0.6 } : undefined}>
      <div className="fx gap12">
        <div className="f1" style={{ minWidth: 0 }}>
          <div className="fx ac g6 wrap mb6">
            <span className="vtag"><span className={isVeg ? "vd" : "vd nv"} />{isVeg ? "VEG" : "NON-VEG"}</span>
            <span className={giCls}>{giLabel}</span>
            {lifestyleTag && <span className="pill" style={{ fontSize: 9 }}>{lifestyleTag}</span>}
            {isAssessed && fit_band === "high" && (
              <span className="pill sg flex items-center gap-1 bg-[var(--sage)]/10 text-[var(--sage)] border border-[var(--sage)]/30 text-[9px] font-bold uppercase tracking-wider">
                <i className="ph-fill ph-sparkle text-[9px]" /> Strong goal match
              </span>
            )}
          </div>
          <Link
            to={`/dish/${dish.slug}`}
            onClick={handleLinkClick}
            className="dtitle line-clamp-2"
            style={{ display: "block", fontSize: 15, fontWeight: 600, lineHeight: "1.25", height: "auto", maxHeight: "2.5em" }}
          >
            {name}
          </Link>

          {/* New macro/price tabular-monospace data line (Rule 3.2) */}
          <div className="fine tnm-data font-mono flex items-center gap-1.5 mt-2 text-[12px] text-white/50 flex-wrap">
            {!provisional ? (
              <>
                <span className="nowrap">{dish.macros.calories} kcal</span>
                <span>·</span>
                <span className="nowrap">{dish.macros.protein}g P</span>
                <span>·</span>
              </>
            ) : (
              <>
                <span className="font-sans text-[10px] text-white/45 uppercase tracking-normal">Macros pending</span>
                <span>·</span>
              </>
            )}
            <span className="price text-[var(--tnm-action)] font-semibold">{F(price)}</span>
            {hasVariants && <span className="font-sans text-[10px] text-white/45"> · options</span>}
            {social_proof && (
              <span className="text-[10px] text-[var(--tnm-action)]/90 font-sans ml-auto nowrap">
                {social_proof}
              </span>
            )}
          </div>

          {isPremiumOnly && <div className="pill mt6" style={{ background: "var(--safd)", color: "var(--safb)", width: "fit-content" }}><i className="ph-fill ph-crown" />Premium</div>}
          {blocked && (
            <div className="fine mt6 text-[var(--color-nn-error)] font-semibold flex items-center gap-1">
              <i className="ph-bold ph-warning-circle" /> Contains {match?.matchedAllergens?.join(", ") || "conflict ingredients"}
            </div>
          )}
          {warned && !blocked && <div className="fine mt6" style={{ color: "var(--dgr)" }}><i className="ph-bold ph-warning" /> {match.warnings[0]}</div>}
        </div>
        <Link
          to={`/dish/${dish.slug}`}
          onClick={handleLinkClick}
          className="dimg aspect-square rounded-xl"
          aria-label={name}
          style={{ width: 92, height: 92, flex: "none", position: "relative" }}
        >
          <picture>
            <source srcSet={localDishSrcset(dish.image, "avif")} type="image/avif" />
            <source srcSet={localDishSrcset(dish.image, "webp")} type="image/webp" />
            <img
              src={getLocalDishFallback(dish.image, 400)}
              srcSet={localDishSrcset(dish.image, "jpg")}
              sizes="92px"
              width="92"
              height="92"
              loading="lazy"
              decoding="async"
              alt={name}
              onError={onDishImageError}
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
            />
          </picture>
          {info.kind === "scored" && info.differentiated && (
            <span className={`mscore ${info.tier}`} aria-label={`Biometric match ${info.score} percent`}>
              {info.score}% match
            </span>
          )}
          {info.kind === "blocked" && (
            <span className="mscore off" aria-label="Off your plan"><i className="ph-bold ph-prohibit" />Off-plan</span>
          )}
          {showStepper ? (
            <div
              className="stepb"
              role="group"
              aria-label={`${name}, ${cartQty} in cart`}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            >
              <button
                type="button"
                aria-label={cartQty <= 1 ? `Remove ${name}` : `Decrease ${name}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!cartLineId) return;
                  if (cartQty <= 1) stepRemove(cartLineId);
                  else stepQty(cartLineId, -1);
                }}
              >
                <i className="ph-bold ph-minus" aria-hidden />
              </button>
              <span className="mono" aria-hidden>{cartQty}</span>
              <button
                type="button"
                aria-label={`Add another ${name}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (cartLineId) stepQty(cartLineId, 1);
                }}
              >
                <i className="ph-bold ph-plus" aria-hidden />
              </button>
            </div>
          ) : (
            <button
              className="addb"
              disabled={blocked}
              style={blocked ? { opacity: 0.5, cursor: "not-allowed", pointerEvents: "auto" } : undefined}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (blocked) return;
                if (isPremiumOnly && !isPremium) { onPremiumGate(); return; }
                onAdd();
              }}
              aria-label={blocked ? "Blocked" : `Add ${name}`}
            >
              {blocked ? "BLOCKED" : hasVariants ? "CUSTOMISE" : "ADD"}
            </button>
          )}
        </Link>
      </div>
      {/* Macro ribbon — same honesty rule as the PDP: provisional (placeholder)
          macro blocks are never shown as real numbers. Container + row heights
          match the numeric ribbon, so swapping states causes no CLS. */}
      {provisional ? (
        <div className="ribbon cmp mt10" role="group" aria-label="Macros being verified">
          <div className="rc">
            <span className="rl">NUTRITION</span>
            <span className="mono" style={{ fontSize: 10, color: "var(--fnt)", lineHeight: "16px" }}>macros being verified</span>
          </div>
        </div>
      ) : (
        <div className="ribbon cmp mt10" role="group" aria-label={`${dish.macros.calories} kcal, ${dish.macros.protein}g protein${dish.macrosEstimated ? " (estimated from ingredients)" : ""}`}>
          <div className="rc"><span className="rl">{dish.macrosEstimated ? "KCAL·EST" : "KCAL"}</span><span className="rv sf">{dish.macros.calories}</span></div>
          <div className="rc"><span className="rl">PROTEIN</span><span className="rv">{dish.macros.protein}<i className="ru">g</i></span></div>
          <div className="rc"><span className="rl">CARBS</span><span className="rv">{dish.macros.carbs}<i className="ru">g</i></span></div>
          <div className="rc"><span className="rl">FAT</span><span className="rv">{dish.macros.fat}<i className="ru">g</i></span></div>
        </div>
      )}

      {/* Personalization line — rendered only when there is something to say
          (a score phrase, a personalize hint, or an off-plan note); the empty
          reserved row is collapsed on all other cards. */}
      {(info.kind === "none" || info.kind === "blocked" || (info.kind === "scored" && info.phrase)) && (
        <div className="preason">
          {info.kind === "none" && (
            <Link to="/preferences" className="preason-cta" aria-label="Personalize to unlock your biometric match score">
              <i className="ph-bold ph-sparkle" />Personalize to see your match score
            </Link>
          )}
          {info.kind === "blocked" && (
            <span className="preason-off"><i className="ph-bold ph-info" />Not recommended for your profile</span>
          )}
          {info.kind === "scored" && info.phrase && (
            <span><i className="ph-fill ph-seal-check" />Great match {info.phrase}</span>
          )}
        </div>
      )}

      {/* Aspirational LOCKED wearable teaser — a stylized placeholder, clearly
          locked. Never real live data. Shown once per page render (first card
          only, static per card) → zero CLS. */}
      {showWearableTeaser && (
        <Link to="/wellness" className="wteaser" aria-label="Connect your wearable to map your live data stream to this meal">
          <span className="spark" aria-hidden="true">
            <svg viewBox="0 0 200 44" preserveAspectRatio="none">
              <path className="sparkline" d={SPARK_PATH} fill="none" stroke="var(--safb)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="wlock" aria-hidden="true"><i className="ph-fill ph-lock-simple" /></span>
          <span className="wtxt">
            <span className="wlab"><i className="ph-bold ph-pulse" />Live glucose forecast · Locked</span>
            <span className="wcta">Connect your wearable to map your live data stream to this meal.</span>
          </span>
          <i className="ph-bold ph-caret-right wcar" aria-hidden="true" />
        </Link>
      )}

      {canExpress && (
        <button className="fine mt6" style={{ color: "var(--safb)" }} onClick={onExpress}>Buy now — express checkout →</button>
      )}
    </div>
  );
}
