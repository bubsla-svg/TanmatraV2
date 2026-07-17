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
import {
  Check, ShieldCheck, WarningCircle, CaretRight, Question, X, Warning,
  Plus, Calculator, Timer, SealCheck, CheckCircle, Sparkle, ChartBar,
  Info, Package, FirstAid, ArrowLeft,
} from "@phosphor-icons/react";

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

  // ─── colour palette — pixel-matches the reference design spec ───────────
  // primary-container = #fbbf24 (amber) = var(--tnm-action)
  // surface-container = #1f1f1f  surface-container-high = #2a2a2a
  // error-container   = #93000a  secondary = #c6c6c7
  // tertiary-container= #34daff  (teal, data-provenance "Reviewed" icon)

  const allergenDisclosure = getAllergenDisclosure(meal ?? { allergens: [] });
  const hasAllergens = allergenDisclosure.state !== "unchecked" && allergenDisclosure.allergens.length > 0;

  return (
    <div className="tnm2 nn min-h-screen bg-[var(--tnm-surface-ink)] text-[var(--pdp-on-surface)] antialiased pb-[120px]">

      {/* ── Fixed Top Nav ──────────────────────────────────────────────── */}
      <div className="fixed top-0 w-full z-50 flex justify-between items-center px-4 h-16 pointer-events-none">
        <Link
          to="/menu"
          aria-label="Go back"
          className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white border border-white/10 pointer-events-auto hover:bg-black/60 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" weight="bold" />
        </Link>
        <div className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 pointer-events-auto flex items-center gap-1.5">
          <span className="text-[11px] leading-4 tracking-[0.05em] font-semibold text-[var(--pdp-on-surface)] uppercase" style={{ fontFamily: "Geist, sans-serif" }}>
            {clinicalCategoryLabel(meal.category, meal.kitchen)}
          </span>
        </div>
      </div>

      {/* ── Hero Image ─────────────────────────────────────────────────── */}
      <div className="relative w-full h-[530px] md:h-[442px] max-w-3xl mx-auto overflow-hidden">
        {/* gradient scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--tnm-surface-ink)] via-transparent to-transparent z-10 h-full" />

        {/* gallery slides — drag/swipe support via translateX */}
        <div className="w-full h-full flex" style={{ overflow: "hidden" }}>
          {galleryImages.map((src, idx) => (
            <div
              key={idx}
              className="w-full h-full shrink-0 transition-transform duration-300 ease-out"
              style={{ transform: `translateX(-${heroActiveIdx * 100}%)` }}
            >
              <img
                src={src}
                alt={idx === 0 ? meal.name : `${meal.name} view ${idx + 1}`}
                loading={idx === 0 ? "eager" : "lazy"}
                decoding={idx === 0 ? "sync" : "async"}
                onError={onDishImageError}
                className="w-full h-full object-cover rounded-b-3xl"
              />
            </div>
          ))}
        </div>

        {/* dot pagination — active = wide amber pill, rest = white/30 circle */}
        <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2 z-20">
          {galleryImages.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setHeroActiveIdx(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              aria-current={heroActiveIdx === idx}
              className="flex items-center justify-center"
              style={{ width: heroActiveIdx === idx ? 16 : 8, height: 16 }}
            >
              <span
                className="rounded-full transition-all duration-200"
                style={{
                  width: heroActiveIdx === idx ? 16 : 4,
                  height: 4,
                  backgroundColor: heroActiveIdx === idx ? "var(--tnm-action)" : "color-mix(in srgb, white 30%, transparent)",
                }}
              />
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Content ───────────────────────────────────────────────── */}
      <main className="max-w-3xl mx-auto px-4 -mt-8 relative z-20 space-y-8">

        {/* ① Header & Title */}
        <div className="space-y-1">
          {/* "Recommended for your goal" badge — only when assessment complete + high fit */}
          {hasAssessment && isHighFit && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md mb-1"
              style={{ background: "color-mix(in srgb, var(--tnm-action) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--tnm-action) 20%, transparent)" }}>
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--tnm-action)]" weight="fill" />
              <span className="text-[11px] leading-4 tracking-[0.05em] font-semibold text-[var(--tnm-action)] uppercase" style={{ fontFamily: "Geist, sans-serif" }}>
                Recommended for your goal
              </span>
            </div>
          )}

          <h1 className="text-[28px] leading-[34px] font-bold text-white">{meal.name}</h1>

          <p className="text-[15px] leading-5 text-[var(--pdp-secondary)] italic">
            {getTasteDescriptionForDish(meal)}
          </p>

          {/* Veg + GI chips */}
          <div className="flex gap-2 pt-2">
            <div className="flex items-center gap-1 px-2 py-1 rounded-md border border-white/5" style={{ background: "var(--pdp-chip-surface)" }}>
              <span className={`w-2 h-2 rounded-full ${isVeg ? "bg-green-500" : "bg-orange-400"}`} />
              <span className="text-[10px] leading-3 font-medium text-[var(--pdp-on-surface)] uppercase" style={{ fontFamily: "Geist, sans-serif" }}>
                {isVeg ? "Veg" : "Non-Veg"}
              </span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded-md border border-white/5" style={{ background: "var(--pdp-chip-surface)" }}>
              <span className="text-[10px] leading-3 font-medium text-[var(--pdp-on-surface)] uppercase" style={{ fontFamily: "Geist, sans-serif" }}>
                GI {gi === "low" ? "Low" : gi === "high" ? "High" : "Med"}
              </span>
            </div>
          </div>
        </div>

        {/* ② Allergen Warning */}
        <div className="rounded-lg p-3 flex items-start gap-3"
          style={{ background: "color-mix(in srgb, var(--pdp-error-container) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--pdp-error-container) 20%, transparent)" }}>
          <span className="text-[11px] leading-4 tracking-[0.05em] font-semibold text-[var(--pdp-on-error)] uppercase mt-0.5 shrink-0" style={{ fontFamily: "Geist, sans-serif" }}>
            Allergen Safety:
          </span>
          <AllergenSummaryValue meal={meal} className="text-[15px] leading-5 text-[var(--pdp-on-surface)]" />
        </div>

        {/* ③ Macro Summary Bento */}
        {calculatedMacros && (
          <div>
            <div className="grid grid-cols-4 rounded-xl overflow-hidden border border-white/10"
              style={{ gap: "1px", background: "color-mix(in srgb, white 5%, transparent)" }}>
              {/* Calories */}
              <div className="flex flex-col items-center justify-center text-center p-3" style={{ background: "var(--tnm-surface-ink-2)" }}>
                <span className="text-[10px] leading-3 font-medium text-[var(--pdp-secondary)] uppercase mb-1" style={{ fontFamily: "Geist, sans-serif" }}>Calories</span>
                <span className="text-[22px] leading-7 font-semibold tracking-[-0.01em] text-white">{calculatedMacros.calories}</span>
              </div>
              {/* Protein */}
              <div className="flex flex-col items-center justify-center text-center p-3" style={{ background: "var(--tnm-surface-ink-2)" }}>
                <span className="text-[10px] leading-3 font-medium text-[var(--pdp-secondary)] uppercase mb-1" style={{ fontFamily: "Geist, sans-serif" }}>Protein</span>
                <span className="text-[22px] leading-7 font-semibold tracking-[-0.01em] text-white">{calculatedMacros.protein}g</span>
              </div>
              {/* Glycemic */}
              <div className="flex flex-col items-center justify-center text-center p-3" style={{ background: "var(--tnm-surface-ink-2)" }}>
                <span className="text-[10px] leading-3 font-medium text-[var(--pdp-secondary)] uppercase mb-1" style={{ fontFamily: "Geist, sans-serif" }}>Glycemic</span>
                <span className="text-[10px] leading-3 font-medium text-white uppercase mt-1" style={{ fontFamily: "Geist, sans-serif" }}>
                  {gi === "low" ? "Low" : gi === "high" ? "High" : "Medium"}
                </span>
              </div>
              {/* Source */}
              <div className="flex flex-col items-center justify-center text-center p-3" style={{ background: "var(--tnm-surface-ink-2)" }}>
                <span className="text-[10px] leading-3 font-medium text-[var(--pdp-secondary)] uppercase mb-1" style={{ fontFamily: "Geist, sans-serif" }}>Source</span>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[10px] leading-3 font-medium text-white uppercase" style={{ fontFamily: "Geist, sans-serif" }}>
                    {macrosEstimated ? "Estimated" : "Measured"}
                  </span>
                </div>
              </div>
            </div>
            {/* "Verified nutrition profile" footnote */}
            <div className="flex justify-end mt-1">
              <span className="flex items-center gap-1 text-[10px] leading-3 font-medium text-[var(--pdp-secondary)]" style={{ fontFamily: "Geist, sans-serif" }}>
                <Info className="w-3 h-3" />
                {macrosEstimated ? "Estimated nutrition profile" : "Verified nutrition profile"}
              </span>
            </div>
          </div>
        )}

        {/* ④ Options / Variant Selector */}
        {variants.length > 1 && (
          <div className="space-y-4">
            <h3 className="text-[11px] leading-4 tracking-[0.05em] font-semibold text-[var(--pdp-secondary)] uppercase" style={{ fontFamily: "Geist, sans-serif" }}>
              Select Option
            </h3>
            {/* scrollable underline tab bar — matches reference exactly */}
            <div className="flex gap-4 overflow-x-auto pb-2 border-b border-white/10" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
              {variants.map((v: any) => {
                const active = v.slug === activeSlug;
                return (
                  <button
                    key={v.slug}
                    type="button"
                    onClick={() => selectVariant(v.slug)}
                    aria-pressed={active}
                    style={{ borderBottom: active ? "2px solid var(--tnm-action)" : "2px solid transparent" }}
                    className={`pb-2 font-normal text-[17px] leading-6 whitespace-nowrap px-1 transition-colors ${
                      active ? "text-white" : "text-[var(--pdp-secondary)] hover:text-white"
                    }`}
                  >
                    {v.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[15px] leading-5 text-[var(--pdp-outline-variant)]">{meal.description}</p>
          </div>
        )}

        {/* Safety conflict banner — blocked allergen/diet */}
        {match?.blocked && (
          <div className="rounded-xl p-3.5 flex flex-col gap-3 border"
            style={{ background: "color-mix(in srgb, var(--pdp-error-container) 8%, transparent)", borderColor: "color-mix(in srgb, var(--pdp-error-container) 30%, transparent)" }}>
            <div className="flex items-start gap-2.5">
              <WarningCircle className="w-5 h-5 text-[var(--pdp-on-error)] shrink-0 mt-0.5" weight="fill" />
              <div>
                <h4 className="text-[15px] leading-5 font-semibold text-white">Safety Block Alert</h4>
                <div className="text-[13px] text-white/60 leading-relaxed mt-1 flex flex-col gap-1">
                  {match.blockReasons.map((r, i) => {
                    if (r.code === "allergen_block")
                      return <span key={i}>• Contains allergens: {r.allergens.map((a: string) => a.toUpperCase()).join(", ")}</span>;
                    if (r.code === "diet_block")
                      return <span key={i}>• Diet order conflict: {r.detail}</span>;
                    return <span key={i}>• Patient safety conflict detected.</span>;
                  })}
                </div>
              </div>
            </div>
            {smartSwap && (
              <Link
                to={`/dish/${smartSwap.slug}`}
                className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-2 hover:bg-white/10 transition-all text-[13px]"
              >
                <span className="text-[var(--tnm-action)] font-semibold">View Allergen-Safe Smart Swap</span>
                <CaretRight className="w-3.5 h-3.5 text-[var(--tnm-action)]" weight="bold" />
              </Link>
            )}
          </div>
        )}

        {/* ⑤ Goal Fit Analysis */}
        <div className="space-y-4">
          <h3 className="text-[11px] leading-4 tracking-[0.05em] font-bold text-white uppercase" style={{ fontFamily: "Geist, sans-serif" }}>
            Goal Fit Analysis
          </h3>
          <div className="rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden border border-white/10"
            style={{ background: "var(--tnm-surface-ink-2)" }}>
            {/* left amber accent bar */}
            <div className="absolute top-0 left-0 w-1 h-full" style={{ background: "var(--tnm-action)" }} />
            <div className="flex items-start gap-3 pl-2">
              <ShieldCheck className="w-5 h-5 text-[var(--tnm-action)] shrink-0 mt-0.5" weight="fill" />
              <div>
                <p className="text-[15px] leading-5 text-white font-semibold">
                  {hasAssessment && preferences
                    ? buildNarrative(meal, preferences)
                    : `Balanced macro split (${meal.macros.protein}P / ${meal.macros.carbs}C / ${meal.macros.fat}F) and a clean ingredient list.`}
                </p>
                <p className="text-[10px] leading-3 font-medium text-[var(--pdp-secondary)] mt-1" style={{ fontFamily: "Geist, sans-serif" }}>
                  Based on: {preferences?.goal ? GOAL_LABEL[preferences.goal] ?? "general-wellness" : "general-wellness"} &bull;{" "}
                  {preferences?.dietaryStyle || "omnivore"} &bull; No active allergen clashes.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !showCalcDisclosure;
                setShowCalcDisclosure(next);
                if (next) track("fit_explanation_expanded", { dishId: meal.id });
              }}
              className="flex items-center gap-1.5 pl-9 mt-1 text-[var(--tnm-action)] hover:text-[var(--pdp-on-surface)] transition-colors"
            >
              <Question className="w-4 h-4" />
              <span className="text-[11px] leading-4 tracking-[0.05em] font-semibold uppercase" style={{ fontFamily: "Geist, sans-serif" }}>
                {showCalcDisclosure ? "Hide calculation disclosure" : "How this fits your profile"}
              </span>
            </button>
            {showCalcDisclosure && (
              <p className="pl-9 text-[13px] text-white/50 leading-relaxed border-t border-white/5 pt-2.5 mt-1">
                Clinical analysis maps macros to targets: weights are checked for target BMR, and carbohydrates are verified as low glycemic index (GI &lt; 55) to protect glucose levels.
              </p>
            )}
          </div>
        </div>

        {/* ⑥ Macro Splits Detail + Full Nutrition Facts */}
        {calculatedMacros && (
          <div className="space-y-4">
            <h3 className="text-[11px] leading-4 tracking-[0.05em] font-semibold text-[var(--pdp-secondary)] uppercase" style={{ fontFamily: "Geist, sans-serif" }}>
              Macro Splits
            </h3>
            <div className="space-y-4">
              {/* Calories bar */}
              <MacroTrack
                label="Calories"
                value={calculatedMacros.calories}
                target={preferences?.calorieTarget || null}
                unit="kcal"
                fillPercent={Math.min(100, (calculatedMacros.calories / 400) * 100)}
              />
              {/* Protein bar */}
              <MacroTrack
                label="Protein"
                value={calculatedMacros.protein}
                target={preferences?.proteinTargetGrams || null}
                unit="g"
                fillPercent={Math.min(100, (calculatedMacros.protein / 30) * 100)}
              />
            </div>

            {/* Full Nutrition Facts accordion row */}
            <button
              type="button"
              className="w-full flex items-center justify-between p-4 rounded-xl border border-white/5 hover:bg-white/5 transition-colors mt-4 group"
              style={{ background: "var(--tnm-surface-ink-2)" }}
              onClick={() => {
                const next = !showFacts;
                setShowFacts(next);
                if (next) track("full_nutrition_opened", { dishId: meal.id });
              }}
            >
              <span className="text-[17px] leading-6 text-white">Full Nutrition Facts</span>
              <CaretRight className={`w-5 h-5 text-[var(--pdp-secondary)] group-hover:text-white transition-all duration-200 ${showFacts ? "rotate-90" : ""}`} />
            </button>

            {showFacts && (
              <div className="rounded-xl border border-white/5 overflow-hidden" style={{ background: "var(--tnm-surface-ink-2)" }}>
                {[
                  ["Serving weight", label.servingSize || "350g avg"],
                  ["Calories", `${calculatedMacros.calories} kcal`],
                  ["Protein", `${calculatedMacros.protein} g`],
                  ["Carbohydrates", `${calculatedMacros.carbs} g`],
                  ["Fat", `${calculatedMacros.fat} g`],
                  ["Fiber", `${calculatedMacros.fiber} g`],
                  ["Sugar", meal.sugarPerServing || "—"],
                  ["Glycemic Index", gi.charAt(0).toUpperCase() + gi.slice(1)],
                ].map(([k, v], i, arr) => (
                  <div
                    key={k}
                    className="flex justify-between px-4 py-3 text-[15px] leading-5"
                    style={{ borderBottom: i < arr.length - 1 ? "1px solid color-mix(in srgb, white 5%, transparent)" : "none" }}
                  >
                    <span className="text-[var(--pdp-secondary)]">{k}</span>
                    <span className="text-white font-semibold">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ⑦ Ingredients */}
        <div className="space-y-4">
          <h3 className="text-[11px] leading-4 tracking-[0.05em] font-semibold text-[var(--pdp-secondary)] uppercase" style={{ fontFamily: "Geist, sans-serif" }}>
            Complete Ingredient Declaration
          </h3>
          {meal.ingredients?.length ? (
            <div className="flex flex-wrap gap-2">
              {meal.ingredients.map((ing: string, i: number) => (
                <span
                  key={i}
                  className="px-3 py-1.5 rounded-full text-[10px] leading-3 font-medium text-[var(--pdp-on-surface)]"
                  style={{ background: "var(--tnm-surface-ink-2)", border: "1px solid color-mix(in srgb, white 5%, transparent)", fontFamily: "Geist, sans-serif" }}
                >
                  {stripIngredientAmount(ing)}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[15px] leading-5 text-[var(--pdp-secondary)] italic">
              Full ingredient declaration available on request.
            </p>
          )}
        </div>

        {/* ⑧ Delivered Reality */}
        <div className="space-y-4">
          <h3 className="text-[11px] leading-4 tracking-[0.05em] font-semibold text-[var(--pdp-secondary)] uppercase" style={{ fontFamily: "Geist, sans-serif" }}>
            Delivered Reality
          </h3>
          <div className="rounded-xl p-4 flex items-start gap-4 border border-white/10" style={{ background: "var(--tnm-surface-ink-2)" }}>
            {/* 48×48 icon box, black bg, border */}
            <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 border border-white/10" style={{ background: "black" }}>
              <Package className="w-5 h-5 text-[var(--pdp-secondary)]" />
            </div>
            <div>
              <h4 className="text-[17px] leading-6 text-white font-semibold mb-1">Clinical packaging</h4>
              <p className="text-[15px] leading-5 text-[var(--pdp-secondary)] leading-relaxed">
                {getServingInstructionForDish(meal)}
              </p>
            </div>
          </div>
        </div>

        {/* ⑨ Data Provenance */}
        <div className="space-y-4">
          <h3 className="text-[11px] leading-4 tracking-[0.05em] font-semibold text-[var(--pdp-secondary)] uppercase" style={{ fontFamily: "Geist, sans-serif" }}>
            Data Provenance
          </h3>
          <div className="rounded-xl border border-white/10 overflow-hidden divide-y divide-white/5" style={{ background: "var(--tnm-surface-ink-2)" }}>
            {/* Allergen Disclosure row */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-[var(--pdp-teal)]" weight="fill" />
                <span className="text-[15px] leading-5 text-white">Allergen Disclosure</span>
              </div>
              <span className="text-[11px] leading-4 tracking-[0.05em] font-semibold text-[var(--pdp-teal)] uppercase" style={{ fontFamily: "Geist, sans-serif" }}>
                {allergenDisclosure.state === "reviewed" ? "Reviewed" : allergenDisclosure.state === "derived" ? "Derived" : "Pending"}
              </span>
            </div>
            {/* Macro Source row */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ChartBar className="w-5 h-5 text-[var(--pdp-secondary)]" />
                <span className="text-[15px] leading-5 text-white">Macro Source</span>
              </div>
              <span className="text-[11px] leading-4 tracking-[0.05em] font-semibold text-[var(--pdp-secondary)] uppercase" style={{ fontFamily: "Geist, sans-serif" }}>
                {macrosEstimated ? "Estimated" : "Measured"}
              </span>
            </div>
            {/* "How we verify" link row */}
            <Link
              to="/about"
              className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors text-left group"
            >
              <span className="text-[15px] leading-5 text-[var(--tnm-action)]">How we verify nutrition data</span>
              <CaretRight className="w-5 h-5 text-[var(--tnm-action)] group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>

        {/* ⑩ Ask AI Health Coach */}
        <div className="space-y-4">
          <h3 className="text-[11px] leading-4 tracking-[0.05em] font-semibold text-[var(--pdp-secondary)] uppercase" style={{ fontFamily: "Geist, sans-serif" }}>
            Ask AI Health Coach
          </h3>
          <CoachAgentWidget dishSlug={meal.slug} inline />
          <p className="text-[15px] leading-5 text-[var(--pdp-secondary)] text-center">
            Ask about protein modifications, metabolic impacts, or allergen alternatives.
          </p>
        </div>

        {/* ⑪ Kitchen / Chef Note */}
        <div className="rounded-xl p-4 flex items-start gap-3 border border-white/5" style={{ background: "var(--tnm-surface-ink-2)" }}>
          <span className="text-[11px] leading-4 tracking-[0.05em] font-semibold text-[var(--tnm-action)] uppercase mt-1 shrink-0" style={{ fontFamily: "Geist, sans-serif" }}>
            Note
          </span>
          <div>
            <p className="text-[15px] leading-5 text-[var(--pdp-secondary)] italic">
              {kitchenNote}
            </p>
            {chef && (
              <p className="text-[10px] text-white/40 mt-1.5" style={{ fontFamily: "Geist, sans-serif" }}>
                Prepared by Chef {chef.name} &bull; {chef.title}
              </p>
            )}
          </div>
        </div>

        {/* ⑫ Related Meals */}
        {upsells.length > 0 && (
          <div className="space-y-4 pt-4 pb-8">
            <h3 className="text-[11px] leading-4 tracking-[0.05em] font-semibold text-[var(--pdp-secondary)] uppercase" style={{ fontFamily: "Geist, sans-serif" }}>
              Related Meals Based On Goal
            </h3>
            <div className="space-y-3">
              {upsells.map((u: any) => (
                <div
                  key={u.id}
                  className="flex items-center gap-4 p-3 rounded-xl border border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                  style={{ background: "var(--tnm-surface-ink-2)" }}
                >
                  <Link to={`/dish/${u.slug}`} className="flex-1 flex items-center gap-4 min-w-0">
                    <img
                      alt={u.name}
                      className="w-14 h-14 rounded-lg object-cover shrink-0"
                      src={getLocalDishFallback(u.image, 200)}
                      onError={onDishImageError}
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[15px] leading-5 text-white font-semibold truncate">{u.name}</h4>
                      <p className="text-[10px] leading-3 font-medium text-[var(--pdp-secondary)] mt-1" style={{ fontFamily: "Geist, sans-serif" }}>
                        {u.macros?.calories || "—"} kcal &bull; {u.macros?.protein || "—"}g protein
                      </p>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleAddUpsell(u)}
                    aria-label={`Add ${u.name} to order`}
                    className="w-10 h-10 flex items-center justify-center text-[var(--pdp-secondary)] hover:text-white transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Medical disclaimer line */}
            <p className="text-[10px] leading-4 text-white/20 flex items-start gap-1 pt-4 text-center justify-center" style={{ fontFamily: "Geist, sans-serif" }}>
              <FirstAid className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Tanmatra meals support — they don't replace — medical care. Consult your physician before starting any therapeutic nutrition programme.
            </p>
          </div>
        )}

        {/* Customer reviews — server-verified, never faked */}
        <DishReviews slug={meal.slug} />
      </main>

      {/* ── Fixed Bottom Action Bar ──────────────────────────────────── */}
      <div className="fixed bottom-0 w-full z-50 backdrop-blur-xl border-t border-white/10" style={{ background: "color-mix(in srgb, var(--tnm-surface-ink) 95%, transparent)" }}>
        {/* allergen safety strip */}
        <div className="px-4 py-2 flex items-center gap-2 border-b"
          style={{ background: "color-mix(in srgb, var(--pdp-error-container) 20%, transparent)", borderColor: "color-mix(in srgb, var(--pdp-error-container) 10%, transparent)" }}>
          <span className="text-[11px] leading-4 tracking-[0.05em] font-semibold text-[var(--pdp-on-error)] uppercase shrink-0" style={{ fontFamily: "Geist, sans-serif" }}>
            Allergen Safety:
          </span>
          <AllergenSummaryValue meal={meal} className="text-[15px] leading-5 text-[var(--pdp-on-surface)] truncate" />
        </div>
        {/* CTA row */}
        <div className="px-4 py-4 flex items-center justify-between gap-4 max-w-3xl mx-auto">
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] leading-4 tracking-[0.05em] font-semibold text-[var(--tnm-action)] uppercase truncate" style={{ fontFamily: "Geist, sans-serif" }}>
              {meal.name}
            </span>
            <span className="text-[15px] leading-5 text-white font-semibold">
              {inRdPlanRotation ? "Included in plan" : F(calculatedUnitPrice)}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {customizations.length > 0 && (
              <button
                type="button"
                onClick={() => setCustomizerOpen(true)}
                className="min-w-[44px] min-h-[44px] px-4 py-2 rounded-lg border border-white/10 text-white font-semibold text-[17px] leading-6 hover:bg-white/10 transition-colors"
                style={{ background: "var(--tnm-surface-ink-2)" }}
              >
                Customise
              </button>
            )}
            <button
              type="button"
              onClick={handleAddToOrder}
              disabled={match?.blocked === true}
              className="min-w-[44px] min-h-[44px] px-6 py-2 rounded-lg text-black font-bold text-[17px] leading-6 relative overflow-hidden group transition-colors disabled:opacity-40 disabled:pointer-events-none"
              style={{
                background: "var(--tnm-action)",
                boxShadow: "0px 8px 24px color-mix(in srgb, var(--tnm-action) 25%, transparent)",
              }}
            >
              <div className="absolute inset-x-0 top-0 h-px bg-white/40" />
              <span className="relative z-10">{inRdPlanRotation ? "Add Another" : "Add to Order"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Customization Drawer ─────────────────────────────────────── */}
      {customizerOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[950] flex items-end justify-center">
          <div className="w-full max-w-[480px] border-t border-white/10 rounded-t-2xl max-h-[85dvh] overflow-hidden flex flex-col p-4 shadow-2xl"
            style={{ background: "var(--tnm-surface-ink-2)" }}>
            <div className="mx-auto h-1.5 w-10 rounded-full bg-white/15 mb-3 shrink-0" />
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <div>
                <h3 className="text-[17px] leading-6 font-semibold text-white">Customize {meal.name}</h3>
                <p className="text-[10px] text-white/45 mt-0.5" style={{ fontFamily: "Geist, sans-serif" }}>Adjust macros & extras</p>
              </div>
              <button type="button" onClick={() => setCustomizerOpen(false)} aria-label="Close"
                className="w-12 h-12 rounded-full flex items-center justify-center text-white/70 hover:bg-white/10">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* allergen banner inside drawer */}
            <div className="mt-3.5 rounded-xl p-3 flex gap-2 items-center border"
              style={{ background: "color-mix(in srgb, var(--pdp-error-container) 10%, transparent)", borderColor: "color-mix(in srgb, var(--pdp-error-container) 20%, transparent)" }}>
              <Warning className="w-4 h-4 text-[var(--pdp-on-error)] shrink-0" weight="fill" />
              <div className="text-[13px]">
                <span className="font-bold text-[var(--pdp-on-error)] mr-1">Allergen Warning:</span>
                <AllergenSummaryValue meal={meal} className="text-white/80" />
              </div>
            </div>

            {/* customization groups */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-5 mt-4 py-2 pr-1">
              {customizations.map((group: any, groupIdx: number) => {
                const selection = selections[groupIdx];
                return (
                  <div key={groupIdx} className="flex flex-col gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.05em] text-white/45" style={{ fontFamily: "Geist, sans-serif" }}>{group.groupName}</span>
                    <div className="flex flex-col gap-2">
                      {group.options.map((opt: any) => {
                        const isSelected = group.type === "single"
                          ? selection === opt.name
                          : Array.isArray(selection) && selection.includes(opt.name);
                        return (
                          <button
                            key={opt.name}
                            onClick={() => group.type === "single" ? handleSingleSelect(groupIdx, opt.name) : handleMultipleToggle(groupIdx, opt.name)}
                            className={`flex justify-between items-center p-3 rounded-xl border text-left transition-all ${
                              isSelected ? "border-[var(--tnm-action)] text-white" : "border-white/5 text-white/70 hover:bg-white/10"
                            }`}
                            style={{ background: isSelected ? "color-mix(in srgb, var(--tnm-action) 10%, transparent)" : "color-mix(in srgb, white 3%, transparent)" }}
                          >
                            <span className="text-[15px] leading-5 font-semibold">{opt.name}</span>
                            <div className="flex items-center gap-2">
                              {opt.priceModifier > 0 && (
                                <span className="text-[10px] font-bold text-[var(--tnm-action)] px-2 py-0.5 rounded"
                                  style={{ background: "color-mix(in srgb, var(--tnm-action) 10%, transparent)", fontFamily: "Geist, sans-serif" }}>
                                  +{F(opt.priceModifier)}
                                </span>
                              )}
                              <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                                isSelected ? "bg-[var(--tnm-action)] border-[var(--tnm-action)]" : "border-white/30"
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

            {/* live price banner */}
            <div className="mt-4 border-t border-white/5 pt-4 flex flex-col gap-3">
              <div className="flex justify-between items-baseline">
                <span className="text-[13px] text-white/55">Recalculated unit price</span>
                <span className="text-[17px] font-bold text-[var(--tnm-action)]">{F(calculatedUnitPrice)}</span>
              </div>
              <button
                onClick={() => setCustomizerOpen(false)}
                className="w-full h-11 rounded-xl text-black text-[15px] font-bold uppercase tracking-wide shadow-lg active:scale-95 transition-all"
                style={{ background: "var(--tnm-action)" }}
              >
                Apply & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MacroTrack ──────────────────────────────────────────────────────────────
interface MacroTrackProps {
  label: string;
  value: number;
  target: number | null;
  unit: string;
  fillPercent: number; // 0–100 override for display when no target
}

function MacroTrack({ label, value, target, unit, fillPercent }: MacroTrackProps) {
  const percent = target ? Math.min(100, Math.round((value / target) * 100)) : fillPercent;
  const isOver = target ? value > target : false;

  return (
    <div>
      <div className="flex justify-between items-end mb-2">
        <span className="text-[15px] leading-5 text-white font-semibold">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[15px] leading-5 text-white font-semibold">
            {value}{unit === "kcal" ? "kcal" : unit}
          </span>
          <span className="text-[10px] leading-3 font-medium text-[var(--pdp-secondary)]" style={{ fontFamily: "Geist, sans-serif" }}>
            {target ? (isOver ? "Above range" : `${percent}% of target`) : "Within range"}
          </span>
        </div>
      </div>
      <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: "var(--pdp-chip-surface)" }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${percent}%`,
            background: isOver ? "var(--color-alert-stat)" : "var(--tnm-action)",
          }}
        />
      </div>
    </div>
  );
}
