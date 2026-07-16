import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { track } from "@/lib/analytics";
import { getDishBySlug, F } from "./data";
import { useMenuCatalog, macrosAreProvisional, getAllergenDisclosure, type DishData } from "@/lib/menuData";
import { useCart, useCartDrawer } from "@/lib/cartContext";
import { usePreferences } from "@/lib/preferencesContext";
import { usePremiumStatus, usePremiumSlugs } from "@/lib/usePremium";
import { useClinicalMode, clinicalCategoryLabel } from "@/lib/clinicalDiet";
import { evaluateDishForPreferences, findSmartSwap } from "@/lib/preferencesMatch";
import {
  getCustomizationsForDish,
  getKitchenNoteForDish,
  getRdNoteForDish,
  getUpsellsForDish,
  stripIngredientAmount,
  getDishVariants,
  matchesDosha,
  getTasteDescriptionForDish,
  getServingInstructionForDish,
  getOptionMacroModifier,
} from "@/lib/dishEnrichment";
import { buildNutritionLabel } from "@/lib/nutritionLabel";
import { getChefForDish } from "@/lib/teamData";
import { RD_PLANS } from "@/lib/rdPlans";
import CoachAgentWidget from "@/components/ai/CoachAgent";
import MedicalDisclaimer from "@/components/v2/MedicalDisclaimer";
import DishReviews from "@/components/dish/DishReviews";
import { API_BASE } from "@/lib/apiBase";
import { localDishSrcset, getLocalDishFallback } from "@/lib/imgSrcset";
import { onDishImageError, FALLBACK_DISH_IMAGE } from "@/lib/imgFallback";
import StickyBottomBar from "@/components/layout/StickyBottomBar";
import { Check, ShieldCheck, Heart, WarningCircle, CaretRight, Question, X, Warning, Plus, Calculator } from "@phosphor-icons/react";

const GOAL_LABEL: Record<string, string> = {
  lose_weight: "weight-loss",
  gain_muscle: "muscle-gain",
  maintain: "maintenance",
  general_wellness: "general-wellness",
};

const PLAN_DISH_SLUGS: Set<string> = new Set(
  RD_PLANS.flatMap((p) => p.week.flatMap((d) => [d.breakfastSlug, d.lunchSlug, d.dinnerSlug])),
);

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * Allergen-safety value line. A single source of truth so the three PDP
 * placements never disagree — and, critically, so unverified allergen data is
 * never rendered as an affirmative "no allergens" claim. An empty list only
 * reads as "No declared allergens" when it is a reviewed disclosure; when the
 * data is unchecked the line turns into an alert-coloured "under review".
 */
function AllergenSummaryValue({ meal, className = "" }: { meal: any; className?: string }) {
  const disclosure = getAllergenDisclosure(meal ?? { allergens: [] });
  if (disclosure.state === "unchecked") {
    return (
      <span className={`${className} text-[var(--tnm-alert)] font-semibold`}>
        Under review — not confirmed allergen-safe
      </span>
    );
  }
  const text = disclosure.allergens.length
    ? disclosure.allergens.map((a: string) => capitalize(a)).join(", ")
    : disclosure.state === "derived"
      ? "No common allergens detected"
      : "No declared allergens";
  return (
    <span className={className}>
      {text}
      {disclosure.state === "derived" ? (
        <span className="opacity-60"> · auto-detected from ingredients</span>
      ) : null}
    </span>
  );
}

function buildNarrative(dish: any, prefs: any): string {
  const goalLabel = prefs.goal ? GOAL_LABEL[prefs.goal] ?? prefs.goal : null;
  const parts: string[] = [];
  if (goalLabel) {
    if (prefs.goal === "lose_weight" && dish.macros.calories <= 450)
      parts.push(`At ${dish.macros.calories} kcal this fits comfortably inside a ${goalLabel} day.`);
    else if (prefs.goal === "gain_muscle" && dish.macros.protein >= 22)
      parts.push(`${dish.macros.protein}g of protein lands this in your muscle-gain zone.`);
    else if (prefs.goal === "general_wellness" && dish.macros.fiber >= 5)
      parts.push(`${dish.macros.fiber}g fibre and a clean ingredient list make this a steady general-wellness pick.`);
    else if (prefs.goal === "maintain" && dish.glycaemicIndex === "low")
      parts.push(`Low glycaemic index keeps blood sugar steady — good for a maintenance day.`);
    else parts.push(`Picked for your ${goalLabel} profile based on its macro split.`);
  }
  if (prefs.cuisines?.length && prefs.cuisines.includes(dish.kitchen))
    parts.push(`${dish.kitchen.charAt(0).toUpperCase()}${dish.kitchen.slice(1)} is on your cuisine shortlist.`);
  if (prefs.dietaryStyle && prefs.dietaryStyle !== "omnivore") {
    if (prefs.dietaryStyle === "vegetarian" && dish.isVeg) parts.push(`Fully vegetarian, no animal protein.`);
    else if (prefs.dietaryStyle === "keto" && dish.macros.carbs <= 20)
      parts.push(`At ${dish.macros.carbs}g carbs it stays inside a keto envelope.`);
  }
  if (parts.length === 0)
    parts.push(`Balanced macro split (${dish.macros.protein}P / ${dish.macros.carbs}C / ${dish.macros.fat}F) and a clean ingredient list.`);
  return parts.join(" ");
}

export default function V2Dish() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { open: openCart } = useCartDrawer();
  const { preferences } = usePreferences();
  const { isPremium } = usePremiumStatus();
  const premiumSlugs = usePremiumSlugs();
  const { dishes: catalogDishes } = useMenuCatalog();
  const { enabled: clinicalMode } = useClinicalMode();

  // In-place variant switching: tapping a protein/base variant swaps the dish
  // by updating local state (and the URL cosmetically via replaceState) instead
  // of navigating to a new route — no blank reload, scroll position preserved.
  // getDishVariants keys every family member, so the switcher stays intact after
  // a switch. Resets whenever the route dish itself changes.
  const [variantSlug, setVariantSlug] = useState<string | null>(null);
  useEffect(() => {
    setVariantSlug(null);
  }, [slug]);
  const activeSlug = variantSlug ?? slug;

  const meal: any = useMemo(() => {
    if (!activeSlug) return undefined;
    return catalogDishes.find((d: any) => d.slug === activeSlug) ?? getDishBySlug(activeSlug);
  }, [activeSlug, catalogDishes]);

  const selectVariant = (nextSlug: string) => {
    if (nextSlug === activeSlug) return;
    // Preserve scroll across the in-place content swap so the switcher stays put
    // under the user's thumb (a re-render can momentarily clamp scroll to 0).
    const y = typeof window !== "undefined" ? window.scrollY : 0;
    setVariantSlug(nextSlug);
    // Keep the URL shareable/refreshable without a router navigation (which
    // would remount and blank the page). replaceState = no extra history entry.
    if (typeof window !== "undefined") {
      window.history.replaceState(window.history.state, "", `/dish/${nextSlug}`);
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
    }
    track("pdp_variant_switched", { to: nextSlug });
  };

  const match = useMemo(() => (meal ? evaluateDishForPreferences(meal, preferences) : null), [meal, preferences]);
  const smartSwap = useMemo(() => (meal ? findSmartSwap(meal, preferences, catalogDishes) : null), [meal, preferences, catalogDishes]);
  const customizations = useMemo(() => (meal ? getCustomizationsForDish(meal) : []), [meal]);
  const variants = useMemo(() => (meal ? getDishVariants(meal.slug, catalogDishes) : []), [meal, catalogDishes]);

  // Determine suitability matches for Personalized "Why this fits" section
  const hasAssessment = preferences && (preferences.goal || preferences.dietaryStyle);
  const isHighFit = match && !match.blocked && match.warnings.length === 0;

  const [quantity, setQuantity] = useState(1);
  const [selections, setSelections] = useState<Record<number, string | string[]>>({});
  const [showFacts, setShowFacts] = useState(false);
  const [showCalcDisclosure, setShowCalcDisclosure] = useState(false);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  
  // Hero Carousel Slide index
  const [heroActiveIdx, setHeroActiveIdx] = useState(0);

  useEffect(() => {
    const init: Record<number, string | string[]> = {};
    customizations.forEach((group: any, idx: number) => {
      init[idx] =
        group.type === "single"
          ? group.options.find((o: any) => o.default)?.name ?? group.options[0]?.name ?? ""
          : [];
    });
    setSelections(init);
    setQuantity(1);
    setShowFacts(false);
    setHeroActiveIdx(0);
  }, [meal?.slug]);

  useEffect(() => {
    if (meal) {
      track("pdp_viewed", {
        dishId: meal.id,
        name: meal.name,
        fit_band: isHighFit ? "high" : "neutral",
        personalization_level: hasAssessment ? "assessment_complete" : "pre_assessment",
      });
    }
  }, [meal, isHighFit, hasAssessment]);

  useEffect(() => {
    if (meal && heroActiveIdx > 0) {
      track("pdp_gallery_swiped", { index: heroActiveIdx });
    }
  }, [heroActiveIdx, meal]);

  const calculatedUnitPrice = useMemo(() => {
    if (!meal) return 0;
    let mod = 0;
    customizations.forEach((group: any, idx: number) => {
      const sel = selections[idx];
      if (group.type === "single" && typeof sel === "string") {
        mod += group.options.find((o: any) => o.name === sel)?.priceModifier ?? 0;
      } else if (group.type === "multiple" && Array.isArray(sel)) {
        sel.forEach((name) => (mod += group.options.find((o: any) => o.name === name)?.priceModifier ?? 0));
      }
    });
    return meal.price + mod;
  }, [selections, meal, customizations]);

  const calculatedMacros = useMemo(() => {
    if (!meal) return null;
    const base = { ...meal.macros };
    customizations.forEach((group: any, idx: number) => {
      const sel = selections[idx];
      const applyMod = (optName: string) => {
        const mod = getOptionMacroModifier(optName);
        base.calories += mod.calories;
        base.protein += mod.protein;
        base.carbs += mod.carbs;
        base.fat += mod.fat;
        base.fiber += mod.fiber;
      };
      
      if (group.type === "single" && typeof sel === "string") {
        applyMod(sel);
      } else if (group.type === "multiple" && Array.isArray(sel)) {
        sel.forEach(applyMod);
      }
    });
    return base;
  }, [selections, meal, customizations]);


  const calculatedTotal = calculatedUnitPrice * quantity;

  if (!meal) {
    return (
      <div className="tnm2 nn min-h-screen bg-[var(--tnm-surface-ink)]">
        <div className="max-w-[480px] mx-auto min-h-screen">
          <div className="appbar">
            <Link className="iconbtn" to="/menu"><i className="ph-bold ph-arrow-left" /></Link>
            <div className="abt">Dish</div>
          </div>
          <div className="padx tc pt-12">
            <i className="ph-bold ph-warning text-[var(--color-warning)] text-3xl" />
            <div className="tt mt-5 text-base font-bold text-white">Dish not found</div>
            <Link className="btn btn-g btn-blk mt-5" to="/menu">Back to menu</Link>
          </div>
        </div>
      </div>
    );
  }

  const isVeg = !!meal.isVeg;
  const gi: string = meal.glycaemicIndex || "medium";
  const isPremiumOnly = premiumSlugs.has(meal.slug);
  const macrosProvisional = macrosAreProvisional(meal);
  const macrosEstimated = !!meal.macrosEstimated;
  const label = buildNutritionLabel(meal);
  const kitchenNote = getKitchenNoteForDish(meal);
  const rdNote = getRdNoteForDish(meal);
  const chef = getChefForDish(meal);
  const inRdPlanRotation = PLAN_DISH_SLUGS.has(meal.slug);
  const upsells = getUpsellsForDish(meal, 3, catalogDishes);
  const pairingCandidate = meal.pairingSlug ? getDishBySlug(meal.pairingSlug) : undefined;
  const pairing = pairingCandidate?.isAvailable ? pairingCandidate : undefined;
  const balancedDoshas = (["vata", "pitta", "kapha"] as const).filter((d) => matchesDosha(meal, d));

  // Carousel images
  const galleryImages = [
    meal.image,
    meal.imageIngredient || FALLBACK_DISH_IMAGE,
    meal.imageDelivered || FALLBACK_DISH_IMAGE,
    meal.imagePackaging || FALLBACK_DISH_IMAGE,
    meal.imageLifestyle || FALLBACK_DISH_IMAGE,
  ];

  const handleSingleSelect = (idx: number, value: string) =>
    setSelections((prev) => ({ ...prev, [idx]: value }));
  const handleMultipleToggle = (idx: number, name: string) =>
    setSelections((prev) => {
      const cur = (prev[idx] as string[]) ?? [];
      return { ...prev, [idx]: cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name] };
    });

  const collectCustomizations = (): string[] => {
    const labels: string[] = [];
    customizations.forEach((group: any, idx: number) => {
      const sel = selections[idx];
      if (group.type === "single" && typeof sel === "string") {
        const opt = group.options.find((o: any) => o.name === sel);
        if (opt && !opt.default) {
          labels.push(opt.name);
        }
      } else if (group.type === "multiple" && Array.isArray(sel)) {
        sel.forEach((name) => {
          labels.push(name);
        });
      }
    });
    return labels;
  };

  const handleAddToOrder = () => {
    if (isPremiumOnly && !isPremium) {
      toast.error(`${meal.name} is a Premium-only dish`, {
        description: "Join Tanmatra Premium to add this dish.",
        action: { label: "See Premium", onClick: () => navigate("/premium") },
      });
      return;
    }
    if (match?.blocked === true) {
      toast.error("Cannot add dish: Allergen safety block");
      return;
    }
    const custom = collectCustomizations();
    addItem({
      dishId: meal.id,
      slug: meal.slug,
      name: meal.name,
      image: meal.image,
      basePrice: meal.price,
      unitPrice: calculatedUnitPrice,
      quantity: 1, // Add single item in plan mode
      kitchen: meal.kitchen,
      isVeg: meal.isVeg,
      rdVerified: meal.rdVerified,
      macros: meal.macros,
      customizations: custom,
    });
    track("add_committed", { source: "pdp", dishId: meal.id, name: meal.name, price: calculatedUnitPrice });
    openCart();
    toast.success(`Added ${meal.name} to order`);
  };

  // One-click add from the "Related meals" rail — adds the base dish (no
  // customization) straight to the order. Runs the same allergen/diet safety
  // gate as the main CTA so a quick-add can never bypass a block.
  const handleAddUpsell = (u: any) => {
    const um = evaluateDishForPreferences(u, preferences);
    if (um?.blocked) {
      toast.error(`${u.name} conflicts with your allergen/diet settings`);
      return;
    }
    addItem({
      dishId: u.id,
      slug: u.slug,
      name: u.name,
      image: u.image,
      basePrice: u.price,
      unitPrice: u.price,
      quantity: 1,
      kitchen: u.kitchen,
      isVeg: u.isVeg,
      rdVerified: u.rdVerified,
      macros: u.macros,
      customizations: [],
    });
    track("add_committed", { source: "pdp_related", dishId: u.id, name: u.name, price: u.price });
    openCart();
    toast.success(`Added ${u.name} to order`);
  };

  return (
    <div className="tnm2 nn min-h-screen bg-[var(--tnm-surface-ink)] text-white">
      <div className="max-w-[480px] mx-auto min-h-screen relative flex flex-col pb-[140px]">
        {/* Header App Bar Overlay */}
        <div className="absolute top-0 inset-x-0 flex items-center justify-between p-4 z-20">
          <Link className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white border border-white/10" to="/menu" aria-label="Back to menu">
            <i className="ph-bold ph-arrow-left text-sm" />
          </Link>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full text-white/80">
            {clinicalCategoryLabel(meal.category, meal.kitchen)}
          </span>
        </div>

        {/* 4.1 Hero Gallery Slider with dot pagination */}
        <div className="relative aspect-[4/3] w-full bg-black">
          <div className="w-full h-full flex overflow-hidden">
            {galleryImages.map((src, idx) => (
              <div
                key={idx}
                className={`w-full h-full shrink-0 transition-transform duration-300 ease-out`}
                style={{ transform: `translateX(-${heroActiveIdx * 100}%)` }}
              >
                <img
                  src={src}
                  alt={`${meal.name} gallery ${idx + 1}`}
                  loading={idx === 0 ? "eager" : "lazy"}
                  decoding={idx === 0 ? "sync" : "async"}
                  onError={onDishImageError}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>

          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--tnm-surface-ink)] to-transparent z-10" />

          {/* Dot Pagination — 48px touch targets (WCAG 2.1 AAA) with a small visual dot inside */}
          <div className="absolute bottom-1 inset-x-0 flex justify-center z-20">
            {galleryImages.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setHeroActiveIdx(idx)}
                className="touch-target-48 shrink-0"
                aria-label={`Go to slide ${idx + 1}`}
                aria-current={heroActiveIdx === idx}
              >
                <span
                  className={`h-1.5 rounded-full transition-all ${
                    heroActiveIdx === idx ? "bg-[var(--tnm-action)] w-4" : "bg-white/40 w-1.5"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* PDP Above-the-fold Details */}
        <div className="padx pt-2 flex-1">
          {/* Recommendation match badge */}
          {hasAssessment && isHighFit && (
            <div className="mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--tnm-action)]/15 text-[var(--tnm-action)] border border-[var(--tnm-action)]/25 px-2.5 py-1 rounded-md inline-flex items-center gap-1">
                <ShieldCheck weight="fill" className="w-3.5 h-3.5" />
                Recommended for your goal
              </span>
            </div>
          )}

          <h1 className="text-xl font-bold text-white/95 leading-tight">{meal.name}</h1>
          
          {/* Taste line sensory description */}
          <p className="text-xs text-white/50 italic mt-1 leading-snug">
            {getTasteDescriptionForDish(meal)}
          </p>

          {/* Capped 2 Status Badges (neutral gray, veg status is only sage colored) */}
          <div className="flex gap-2 items-center flex-wrap mt-3">
            <span
              className={`px-2 py-0.5 rounded-full border flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider ${
                isVeg ? "bg-[var(--tnm-sage)]/10 text-[var(--tnm-sage)] border-[var(--tnm-sage)]/25" : "bg-white/5 text-white/70 border-white/5"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isVeg ? "bg-[var(--tnm-sage)]" : "bg-white/40"}`} />
              {isVeg ? "Veg" : "Non-Veg"}
            </span>

            <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-white/80 font-bold uppercase tracking-wider">
              {gi === "low" ? "GI Low" : gi === "high" ? "GI High" : "GI Med"}
            </span>

          </div>

          {/* 4.4 Persistent Allergen summary line above fold */}
          <div className="mt-3 text-xs flex items-center gap-1.5 bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2">
            <span className="text-[10px] uppercase font-extrabold tracking-wider text-[var(--tnm-alert)]">Allergen Safety:</span>
            <AllergenSummaryValue meal={meal} className="text-white/80 font-medium truncate" />
          </div>

          {/* 4.5 Nutrition Snapshot Chips */}
          {!macrosProvisional && calculatedMacros && (
            <>
              <div className="grid grid-cols-2 min-[360px]:grid-cols-4 gap-2 mt-4 bg-white/[0.02] border border-white/5 rounded-xl p-2.5">
                <div className="flex flex-col items-center">
                  <span className="text-[9px] font-mono text-white/45 uppercase">Calories</span>
                  <span className="tnm-data text-xs font-bold text-white/90 mt-0.5">{macrosEstimated ? "~" : ""}{calculatedMacros.calories}</span>
                </div>
                <div className="flex flex-col items-center border-l border-white/5">
                  <span className="text-[9px] font-mono text-white/45 uppercase">Protein</span>
                  <span className="tnm-data text-xs font-bold text-white/90 mt-0.5">{macrosEstimated ? "~" : ""}{calculatedMacros.protein}g</span>
                </div>
                <div className="flex flex-col items-center border-l border-white/5">
                  <span className="text-[9px] font-mono text-white/45 uppercase">Glycemic</span>
                  <span className="text-[10px] font-bold text-white/90 mt-0.5 uppercase">{gi}</span>
                </div>
                <div className="flex flex-col items-center border-l border-white/5">
                  <span className="text-[9px] font-mono text-white/45 uppercase">Source</span>
                  <span className="text-[9px] font-bold text-white/90 mt-1 uppercase flex items-center gap-0.5">
                    {macrosEstimated ? (
                      <><Calculator className="w-2.5 h-2.5 text-[var(--tnm-action)]" weight="bold" /> Est.</>
                    ) : (
                      <><Check className="w-2.5 h-2.5 text-[var(--tnm-action)]" weight="bold" /> Measured</>
                    )}
                  </span>
                </div>
              </div>
              {macrosEstimated && (
                <p className="text-[9px] text-white/40 mt-1.5 leading-snug px-1">
                  Macros estimated from the ingredient list (IFCT 2017 / USDA) — a close approximation, not yet lab/RD-verified.
                </p>
              )}
            </>
          )}

          {/* Variant switcher */}
          {variants.length > 1 && (
            <div className="mt-6">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Select option</span>
              <div className="flex gap-2 flex-wrap mt-2">
                {variants.map((v: any) => {
                  const active = v.slug === meal.slug;
                  return (
                    <button
                      key={v.slug}
                      type="button"
                      onClick={() => selectVariant(v.slug)}
                      aria-pressed={active}
                      className={`text-xs px-4 py-2.5 min-h-[48px] rounded-xl border transition-all inline-flex items-center justify-center ${
                        active ? "bg-[var(--tnm-action)] border-[var(--tnm-action)] text-black font-semibold" : "bg-white/5 border-white/5 text-white/70 hover:bg-white/10"
                      }`}
                    >
                      {v.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Safety conflict banner */}
          {match?.blocked && (
            <div className="card border-[var(--color-alert-allergen)] border bg-[var(--color-alert-allergen)]/5 mt-5 p-3.5 flex flex-col gap-3 rounded-xl">
              <div className="flex items-start gap-2.5">
                <WarningCircle className="w-5 h-5 text-[var(--color-alert-allergen)] shrink-0 mt-0.5" weight="fill" />
                <div>
                  <h4 className="text-xs font-bold text-white/90">Safety Block Alert</h4>
                  <div className="text-[11px] text-white/60 leading-relaxed mt-1 flex flex-col gap-1">
                    {match.blockReasons.map((r, i) => {
                      if (r.code === "allergen_block") {
                        return <span key={i} className="block">• Contains allergens: {r.allergens.map((a: string) => a.toUpperCase()).join(", ")}</span>;
                      }
                      if (r.code === "contraindication_block") {
                        return <span key={i} className="block">• Contraindicated for: {r.conditions.join(", ")} ({r.detail})</span>;
                      }
                      if (r.code === "diet_block") {
                        return <span key={i} className="block">• Diet order conflict: {r.detail}</span>;
                      }
                      return <span key={i} className="block">• Patient safety conflict detected.</span>;
                    })}
                  </div>
                </div>
              </div>
              {smartSwap && (
                <Link
                  to={`/dish/${smartSwap.slug}`}
                  className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-2 hover:bg-white/10 transition-all text-xs"
                >
                  <span className="text-[var(--tnm-action)] font-semibold">View Allergen-Safe Smart Swap</span>
                  <CaretRight className="w-3.5 h-3.5 text-[var(--tnm-action)]" weight="bold" />
                </Link>
              )}
            </div>
          )}

          <p className="text-xs text-white/70 mt-5 leading-relaxed">{meal.description}</p>

          {/* 5.1 Why This Fits section (personalized vs pre-assessment fallback) */}
          <div className="mt-8">
            <h3 className="text-sm font-bold text-white/90 mb-3">Goal Fit Analysis</h3>
            {hasAssessment ? (
              <div className="card bg-white/[0.02] border border-white/5 p-3.5 rounded-xl">
                <div className="flex items-start gap-2.5 text-xs text-white/80">
                  <ShieldCheck className="w-5 h-5 text-[var(--tnm-action)] shrink-0 mt-0.5" weight="fill" />
                  <div className="flex-1">
                    <p className="leading-relaxed font-medium">
                      {buildNarrative(meal, preferences)}
                    </p>
                    <p className="text-[10px] text-white/45 mt-2">
                      Based on: {preferences.goal ? GOAL_LABEL[preferences.goal] : "general wellness"} &bull; {preferences.dietaryStyle || "standard dietary safety"} &bull; No active allergen clashes.
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        const next = !showCalcDisclosure;
                        setShowCalcDisclosure(next);
                        if (next) track("fit_explanation_expanded", { dishId: meal.id });
                      }}
                      className="text-[10px] text-[var(--tnm-action)] font-bold uppercase tracking-wider flex items-center gap-1 mt-3"
                    >
                      <Question className="w-3.5 h-3.5" />
                      {showCalcDisclosure ? "Hide calculation disclosure" : "How this fits your profile"}
                    </button>

                    {showCalcDisclosure && (
                      <div className="text-[10px] text-white/50 leading-relaxed border-t border-white/5 pt-2.5 mt-2.5">
                        Clinical analysis maps macros to targets: weights are checked for target BMR, and carbohydrates are verified as low glycemic index (GI &lt; 55) to protect glucose levels.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="card bg-white/[0.01] border border-white/5 border-dashed p-4 rounded-xl text-center flex flex-col items-center gap-2.5">
                <p className="text-xs text-white/60 leading-relaxed max-w-[280px]">
                  Calories, protein and allergens for this dish are listed below. Tell us your goals any time and we'll show how each meal fits.
                </p>
              </div>
            )}
          </div>

          {/* 5.2 Macro Target Visualizations */}
          {!macrosProvisional && (
            <div className="mt-8">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Macro splits</span>
              <div className="flex flex-col gap-3.5 mt-3">
                {/* Calories Track */}
                <MacroTrack
                  label="Calories"
                  value={calculatedMacros.calories}
                  target={preferences?.calorieTarget || null}
                  unit="kcal"
                />
                {/* Protein Track */}
                <MacroTrack
                  label="Protein"
                  value={calculatedMacros.protein}
                  target={preferences?.proteinTargetGrams || null}
                  unit="g"
                />
              </div>
            </div>
          )}

          {/* 5.3 Full Nutrition Facts Accordion (collapsed by default) */}
          <div className="card border border-white/5 bg-white/[0.01] mt-8 p-0 overflow-hidden rounded-xl">
            <button
              type="button"
              className="w-full flex items-center justify-between text-left px-4 py-3.5 text-xs font-bold text-white/90"
              onClick={() => {
                const next = !showFacts;
                setShowFacts(next);
                if (next) track("full_nutrition_opened", { dishId: meal.id });
              }}
            >
              <span>Full Nutrition Facts</span>
              <CaretRight className={`w-4 h-4 text-white/50 transition-transform duration-200 ${showFacts ? "rotate-90" : ""}`} />
            </button>
            {showFacts && (
              <div className="px-4 pb-4 border-t border-white/5 pt-3.5 text-[11px] text-white/60 flex flex-col gap-2">
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span>Serving weight</span>
                  <span className="font-mono text-white/80">{label.servingSize || "350g avg"}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span>Calories</span>
                  <span className="font-mono text-white/80">{calculatedMacros.calories} kcal</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span>Protein</span>
                  <span className="font-mono text-white/80">{calculatedMacros.protein} g</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span>Carbohydrates</span>
                  <span className="font-mono text-white/80">{calculatedMacros.carbs} g</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span>Fat</span>
                  <span className="font-mono text-white/80">{calculatedMacros.fat} g</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span>Fiber</span>
                  <span className="font-mono text-white/80">{calculatedMacros.fiber} g</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span>Sugar</span>
                  <span className="font-mono text-white/80">{meal.sugarPerServing || "—"}</span>
                </div>
                <div className="flex justify-between pb-1">
                  <span>Glycemic Index Category</span>
                  <span className="text-[var(--tnm-action)] uppercase font-bold text-[9px]">{gi}</span>
                </div>
              </div>
            )}
          </div>

          {/* 5.4 Complete Ingredients transparency */}
          <div className="mt-8">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Complete ingredient declaration</span>
            <div className="mt-2.5">
              {meal.ingredients?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {meal.ingredients.map((ing: string, i: number) => (
                    <span key={i} className="text-[10px] bg-white/5 text-white/70 px-2 py-1 rounded">
                      {stripIngredientAmount(ing)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/50 italic leading-snug">
                  Insufficient ingredient declaration data. Full data available on request.
                </p>
              )}
            </div>
          </div>

          {/* 5.5 Delivered Reality section */}
          <div className="mt-8 bg-white/[0.01] border border-white/5 rounded-xl p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 block">Delivered Reality</span>
            <div className="flex gap-4 mt-3">
              <div className="w-16 h-16 bg-white/5 rounded-lg overflow-hidden shrink-0 border border-white/10">
                <img
                  src={galleryImages[3]}
                  alt="Packaging view"
                  loading="lazy"
                  className="w-full h-full object-cover"
                  onError={onDishImageError}
                />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-bold text-white/90">Clinical packaging</h4>
                <p className="text-[11px] text-white/50 leading-relaxed mt-1">
                  {getServingInstructionForDish(meal)}
                </p>
              </div>
            </div>
          </div>

          {/* 5.7 RD Review advisory card */}
          <div className="mt-8 bg-white/[0.02] border border-white/5 rounded-xl p-4 flex gap-3">
            <ShieldCheck className="w-6 h-6 text-[var(--tnm-action)] shrink-0 mt-0.5" weight="fill" />
            <div className="flex-1">
              <h4 className="text-xs font-bold text-white/90">RD verification review</h4>
              <p className="text-[11px] text-white/60 leading-relaxed mt-1">
                {rdNote}
              </p>
              <div className="mt-3 pt-2.5 border-t border-white/5 flex justify-between items-center text-[10px]">
                <span className="text-white/45">Reviewer: Dr. Anjali Nair, RD (IDA)</span>
                <Link to="/about" className="text-[var(--tnm-action)] font-bold uppercase tracking-wider">
                  Learn about review
                </Link>
              </div>
            </div>
          </div>

          {/* Ask AI Coach Widget */}
          <div className="mt-8">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 block mb-2.5">
              Ask AI health coach
            </span>
            <CoachAgentWidget dishSlug={meal.slug} inline />
          </div>

          {/* Chef and Kitchen Notes */}
          <div className="mt-8 flex flex-col gap-3">
            <div className="card bg-white/[0.01] border border-white/5 p-3 flex gap-3 rounded-xl items-start">
              <span className="text-xs font-bold text-[var(--tnm-action)] shrink-0">Chef</span>
              <div className="flex-1">
                <p className="text-[11px] text-white/60 leading-relaxed">{kitchenNote}</p>
                {chef && (
                  <p className="text-[10px] text-white/40 mt-1">
                    Prepared by Chef {chef.name} &bull; {chef.title}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 5.9 Related meals section */}
          {upsells.length > 0 && (
            <div className="mt-10">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 block mb-3.5">
                Related meals based on goal
              </span>
              <div className="flex flex-col gap-3">
                {upsells.map((u: any) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 bg-white/[0.02] border border-white/5 rounded-xl p-2.5 hover:bg-white/5 transition-all"
                  >
                    <Link to={`/dish/${u.slug}`} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                      <div className="w-12 h-12 bg-white/5 rounded-lg overflow-hidden shrink-0 border border-white/10">
                        <img src={getLocalDishFallback(u.image, 200)} alt={u.name} className="w-full h-full object-cover" onError={onDishImageError} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-white/90 truncate">{u.name}</h4>
                        <p className="tnm-data text-[10px] text-white/50 mt-1 font-mono">
                          {u.macros?.calories || "—"} kcal &bull; {u.macros?.protein || "—"}g protein
                        </p>
                      </div>
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleAddUpsell(u)}
                      aria-label={`Add ${u.name} to order`}
                      className="shrink-0 w-11 h-11 rounded-xl bg-[var(--tnm-action)]/10 border border-[var(--tnm-action)]/25 text-[var(--tnm-action)] flex items-center justify-center hover:bg-[var(--tnm-action)]/20 transition-all"
                    >
                      <Plus className="w-4 h-4" weight="bold" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Customer reviews — server-verified eligibility; only real
              ratings/summaries are shown (empty state never fakes a rating). */}
          <div className="mt-8">
            <DishReviews slug={meal.slug} />
          </div>

          {/* Medical Disclaimer */}
          <div className="mt-8">
            <MedicalDisclaimer compact />
          </div>
        </div>

        {/* The allergen disclosure lives in the in-flow card near the title
            (AllergenSummaryValue there is the honest, fail-closed source). A
            second fixed copy pinned above the bottom bar duplicated it on every
            PDP and fought the CTA for thumb-zone space — removed. */}

        {/* 6. Consolidated sticky bottom bar (state machine context: pdp) */}
        <StickyBottomBar
          context="pdp"
          dishName={meal.name}
          dishPricePaise={calculatedUnitPrice}
          isInPlan={inRdPlanRotation}
          onAddDish={handleAddToOrder}
          disabled={match?.blocked === true}
        />

        {/* Customization Drawer Overlay */}
        {customizerOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[950] flex items-end justify-center">
            <div className="w-full max-w-[480px] bg-[var(--tnm-surface-ink-2)] border-t border-white/10 rounded-t-2xl max-h-[85dvh] max-h-[85vh] overflow-hidden flex flex-col p-4 shadow-2xl animate-in slide-in-from-bottom duration-200">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white/90">Customize {meal.name}</h3>
                  <p className="text-[10px] text-white/45 mt-0.5">Customize your therapeutic macros & extras</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomizerOpen(false)}
                  aria-label="Close customization sheet"
                  className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/70 hover:bg-white/10 touch-target-48"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Allergen banner visible during customization */}
              <div className="mt-3.5 alert-allergen-bg alert-allergen-border border rounded-xl p-3 flex gap-2 items-center">
                <Warning className="w-4.5 h-4.5 text-[var(--tnm-alert)] shrink-0" weight="fill" />
                <div className="text-[11px]">
                  <span className="font-bold text-[var(--tnm-alert)] mr-1">Allergen Warning:</span>
                  <AllergenSummaryValue meal={meal} className="text-white/80" />
                </div>
              </div>

              {/* Customization groups */}
              <div className="flex-1 overflow-y-auto flex flex-col gap-5 mt-4 py-2 pr-1">
                {customizations.map((group: any, groupIdx: number) => {
                  const selection = selections[groupIdx];
                  return (
                    <div key={groupIdx} className="flex flex-col gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/45">{group.groupName}</span>
                      <div className="flex flex-col gap-2 mt-1">
                        {group.options.map((opt: any) => {
                          const isSelected =
                            group.type === "single"
                              ? selection === opt.name
                              : Array.isArray(selection) && selection.includes(opt.name);

                          return (
                            <button
                              key={opt.name}
                              onClick={() => {
                                if (group.type === "single") {
                                  handleSingleSelect(groupIdx, opt.name);
                                } else {
                                  handleMultipleToggle(groupIdx, opt.name);
                                }
                              }}
                              className={`flex justify-between items-center p-3 rounded-xl border text-left transition-all ${
                                isSelected
                                  ? "bg-[var(--tnm-action)]/10 border-[var(--tnm-action)] text-white"
                                  : "bg-white/5 border-white/5 text-white/70 hover:bg-white/10"
                              }`}
                            >
                              <span className="text-xs font-semibold">{opt.name}</span>
                              <div className="flex items-center gap-2">
                                {opt.priceModifier > 0 && (
                                  <span className="tnm-data text-[10px] font-bold text-[var(--tnm-action)] bg-[var(--tnm-action)]/10 px-2 py-0.5 rounded">
                                    +{F(opt.priceModifier)}
                                  </span>
                                )}
                                <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                                  isSelected ? "border-[var(--tnm-action)] bg-[var(--tnm-action)]" : "border-white/30"
                                }`}>
                                  {isSelected && <Check className="w-3 h-3 text-black" weight="bold" />}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Live recalculated pricing & macros banner inside drawer */}
              <div className="mt-6 border-t border-white/5 pt-4 flex flex-col gap-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-white/55">Recalculated unit price:</span>
                  <span className="tnm-data text-base font-bold text-[var(--tnm-action)]">
                    {F(calculatedUnitPrice)}
                  </span>
                </div>
                <div className="text-[10px] text-white/40 leading-snug">
                  * Nutrition values and price modifier updates will apply to this meal when added to plan.
                </div>
                <button
                  onClick={() => setCustomizerOpen(false)}
                  className="w-full bg-[var(--tnm-action)] text-black hover:bg-[var(--tnm-action)]/90 h-11 rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg active:scale-95 transition-all mt-1"
                >
                  Apply & Close Customization
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper components for macro visualization tracks
interface MacroTrackProps {
  label: string;
  value: number;
  target: number | null;
  unit: string;
}

function MacroTrack({ label, value, target, unit }: MacroTrackProps) {
  const percent = target ? Math.min(100, Math.round((value / target) * 100)) : 0;
  const isOver = target && value > target;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-baseline text-xs text-white/80">
        <span className="font-semibold">{label}</span>
        <span className="font-mono text-[11px]">
          {value}{unit}
          {target ? (
            <>
              <span className="text-white/40"> / {target}{unit}</span>
              <span className={`ml-1.5 font-sans font-bold text-[10px] ${isOver ? "text-[var(--color-alert-stat)]" : "text-[var(--color-alert-safe)]"}`}>
                {isOver ? `Above range` : `${percent}% of target`}
              </span>
            </>
          ) : (
            <span className="text-white/40 ml-1.5 font-sans text-[10px]">Within range</span>
          )}
        </span>
      </div>
      <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            target
              ? isOver
                ? "bg-[var(--color-alert-stat)]"
                : "bg-[var(--color-alert-safe)]"
              : "bg-[var(--color-nn-primary)]"
          }`}
          style={{ width: target ? `${percent}%` : "100%" }}
        />
      </div>
    </div>
  );
}
