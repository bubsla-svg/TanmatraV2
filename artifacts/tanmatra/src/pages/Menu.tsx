import { useState, useMemo, useEffect } from "react";

import { useSearchParams, type MetaFunction } from "react-router";
import { DISHES as STATIC_DISHES } from "@/lib/menuData";

export const meta: MetaFunction = () => [
  { title: "Clinical Menu | Tanmatra" },
  { name: "description", content: "Browse Tanmatra's curated clinical menu — therapeutic meals formulated by registered dietitians for wellness, performance, and clinical protocols." },
  { property: "og:title", content: "Clinical Menu | Tanmatra" },
  { property: "og:description", content: "Therapeutic meals for every goal — weight management, gut health, metabolic balance, and more. Designed by RDs, delivered fresh." },
  { property: "og:image", content: "https://tanmatra.food/opengraph.jpg" },
  { property: "og:url", content: "https://tanmatra.food/menu" },
  { name: "twitter:card", content: "summary_large_image" },
  {
    "script:ld+json": {
      "@context": "https://schema.org",
      "@type": "Menu",
      "name": "Tanmatra Clinical Menu",
      "url": "https://tanmatra.food/menu",
      "hasMenuItem": STATIC_DISHES.map(dish => ({
        "@type": "MenuItem",
        "name": dish.name,
        "description": dish.description,
        "offers": {
          "@type": "Offer",
          "price": (dish.price / 100).toFixed(2),
          "priceCurrency": "INR",
        },
        ...(dish.allergens?.length ? { "allergenDeclaration": dish.allergens.join(", ") } : {}),
      })),
    },
  },
];
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatPrice } from "@/lib/api/adapter";
import { useBundles, groupOrdersApi } from "@/lib/queries";
import {
  CATEGORY_LABELS,
  getDishById,
  useMenuCatalog,
  type DishCategory,
  type DishKitchen,
  type DishData,
} from "@/lib/menuData";
import {
  LIFESTYLE_LABELS,
  LIFESTYLE_TAGS,
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
import {
  PROTOCOLS,
  PROTOCOL_LABELS,
  PROTOCOL_TAGLINES,
  isProtocol,
  matchesProtocol,
  type Protocol,
} from "@/lib/protocols";
import { useCart, useCartDrawer, useCartStore } from "@/lib/cartContext";
import { usePreferences } from "@/lib/preferencesContext";
import { useOrders } from "@/lib/ordersContext";
import { addressesApi } from "@/lib/userAddressesApi";
import { usePremiumStatus, usePremiumSlugs } from "@/lib/usePremium";
import { useNavigate } from "react-router";
import { Crown } from "lucide-react";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import MenuCard from "@/components/menu/MenuCard";
import { groupCatalogDishes, type ConsolidatedDish, type ConsolidatedVariant } from "@/lib/menuVariants";
import ActiveFilters, { type ActiveFilter } from "@/components/menu/ActiveFilters";
import {
  evaluateDishForPreferences,
  rankDishesForPreferences,
  findSmartSwap,
} from "@/lib/preferencesMatch";
import { toast } from "sonner";
import {
  AlertTriangle,
  Heart,
  Dumbbell,
  Activity,
  Baby,
  Leaf,
  Search,
  X,
  Plus,
  ShieldAlert,
  Sparkles as SparklesIcon,
  SlidersHorizontal,
  Package,
  Users,
  PlusCircle,
  Zap,
} from "lucide-react";
import { Link } from "react-router";

const KITCHEN_TABS: Array<"all" | DishKitchen> = [
  "all",
  "continental",
  "indian",
  "asian",
  "mediterranean",
];
const CATEGORY_TABS: Array<"all" | DishCategory> = [
  "all",
  "beverages",
  "breakfast",
  "salads",
  "soups",
  "pasta",
  "wraps",
  "bowls",
  "snacks",
  "mains",
];
const LIFESTYLE_TABS: Array<{ value: Lifestyle; label: string; icon: typeof Heart }> = [
  { value: "all", label: "All", icon: Leaf },
  { value: "heart-healthy", label: LIFESTYLE_LABELS["heart-healthy"], icon: Heart },
  { value: "fitness-gains", label: LIFESTYLE_LABELS["fitness-gains"], icon: Dumbbell },
  { value: "diabetes-management", label: LIFESTYLE_LABELS["diabetes-management"], icon: Activity },
  { value: "junior-explorers", label: LIFESTYLE_LABELS["junior-explorers"], icon: Baby },
  { value: "silver-vitality", label: LIFESTYLE_LABELS["silver-vitality"], icon: Leaf },
];
type DietFilter = "all" | "veg" | "nonveg";

const QUICK_FILTERS = [
  { value: "high-protein", label: "High-Protein" },
  { value: "veg", label: "Veg" },
  { value: "keto", label: "Keto" },
  { value: "vegan", label: "Vegan" },
  { value: "gluten-free", label: "Gluten-Free" },
  { value: "jain", label: "Jain" },
  { value: "carnivore", label: "Carnivore" },
  { value: "low-fodmap", label: "Low-FODMAP" },
  { value: "vata", label: "Vata Dosha" },
  { value: "pitta", label: "Pitta Dosha" },
  { value: "kapha", label: "Kapha Dosha" },
];

export default function Menu() {
  const { isPremium } = usePremiumStatus();
  const premiumSlugs = usePremiumSlugs();
  const navigate = useNavigate();

  useEffect(() => {
    track("view_menu");
  }, []);
  const [kitchen, setKitchen] = useState<"all" | DishKitchen>("all");
  const [category, setCategory] = useState<"all" | DishCategory>("all");
  const [diet, setDiet] = useState<DietFilter>("all");
  const [lifestyle, setLifestyle] = useState<Lifestyle>("all");
  const [quickFilters, setQuickFilters] = useState<string[]>([]);
  // Collapse the four secondary filter rails behind a "More filters"
  // button on mobile. The Protocol chip-row above stays inline as the
  // primary IA axis. Per adoption audit P1 #19. Open by default on
  // desktop (md+); user-toggleable on mobile.
  const [showFilters, setShowFilters] = useState(false);
  const [query, setQuery] = useState("");
  const [hideBlocked, setHideBlocked] = useState(true);
  // Pagination: start with 24 cards in the DOM. Loading all 113 at once
  // produced scroll jank on mid-range Android devices.
  const PAGE_SIZE = 24;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [customizingDish, setCustomizingDish] = useState<ConsolidatedDish | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const { addItem, addBundleSlug, clear } = useCart();
  const { open: openCart } = useCartDrawer();
  const { preferences } = usePreferences();
  const [hasSavedAddress, setHasSavedAddress] = useState(false);

  useEffect(() => {
    if (preferences) {
      addressesApi
        .list()
        .then((r) => setHasSavedAddress(r.addresses.length > 0))
        .catch(() => setHasSavedAddress(false));
    } else {
      setHasSavedAddress(false);
    }
  }, [preferences]);

  const [searchParams, setSearchParams] = useSearchParams();
  const groupCode = searchParams.get("group");
  const protocolParam = searchParams.get("protocol");
  const activeProtocol: Protocol | null = isProtocol(protocolParam)
    ? protocolParam
    : null;
  const { data: bundles } = useBundles();
  const { dishes: catalogDishes } = useMenuCatalog();
  const { enabled: clinicalMode, dietOrderId } = useClinicalMode();
  const dietOrder = DIET_ORDER_BY_ID.get(dietOrderId);
  const { orders } = useOrders();
  const hasOrderHistory = orders.length > 0;

  const repeatMeals = useMemo(() => {
    if (!preferences && orders.length === 0) return [];
    const orderedIds = new Set<number>();
    const list: DishData[] = [];
    orders.forEach((o) => {
      o.items.forEach((item) => {
        if (!orderedIds.has(item.dishId)) {
          orderedIds.add(item.dishId);
          const dish = catalogDishes.find((d) => d.id === item.dishId);
          if (dish && dish.isAvailable && !isSecondaryVariant(dish.slug)) {
            list.push(dish);
          }
        }
      });
    });
    if (list.length < 6 && preferences) {
      catalogDishes.forEach((d) => {
        if (!orderedIds.has(d.id) && d.isAvailable && !isSecondaryVariant(d.slug)) {
          if (!evaluateDishForPreferences(d, preferences).blocked) {
            orderedIds.add(d.id);
            list.push(d);
          }
        }
      });
    }
    return list.slice(0, 8);
  }, [orders, preferences, catalogDishes]);

  const handleQuickAdd = (e: React.MouseEvent, item: DishData) => {
    e.preventDefault();
    e.stopPropagation();
    if (!item.isAvailable) return;
    if (groupCode) {
      groupOrdersApi
        .addItem(groupCode, {
          dishId: item.id,
          quantity: 1,
          customizations: [],
        })
        .then(() => {
          toast.success(`Added ${item.name} to group ${groupCode}`);
        })
        .catch(() => toast.error("Could not add to group order"));
      return;
    }
    if (premiumSlugs.has(item.slug) && !isPremium) {
      toast.error(`${item.name} is a Premium-only dish`, {
        description: "Join Tanmatra Premium to unlock chef-table dishes.",
        action: { label: "See Premium", onClick: () => navigate("/premium") },
      });
      return;
    }
    addItem({
      dishId: item.id,
      slug: item.slug,
      name: item.name,
      image: item.image,
      basePrice: item.price,
      unitPrice: item.price,
      quantity: 1,
      kitchen: item.kitchen,
      isVeg: item.isVeg,
      rdVerified: item.rdVerified,
      macros: item.macros,
      customizations: [],
    });
    openCart();
    toast.success(`Added ${item.name} to your order`, {
      description: "Tap View Cart to review and check out.",
      action: { label: "View Cart", onClick: openCart },
    });
  };

  const handleQuickAddClick = (e: React.MouseEvent, parent: ConsolidatedDish) => {
    e.preventDefault();
    e.stopPropagation();
    if (parent.optionGroups.length > 0) {
      setCustomizingDish(parent);
    } else {
      const originalDish = catalogDishes.find((d) => d.id === parent.id);
      if (originalDish) {
        handleQuickAdd(e, originalDish);
      }
    }
  };

  // Initialize with first option chosen by default
  useEffect(() => {
    if (customizingDish) {
      const initialOptions: Record<string, string> = {};
      customizingDish.optionGroups.forEach((group) => {
        if (group.options.length > 0) {
          initialOptions[group.name] = group.options[0].name;
        }
      });
      setSelectedOptions(initialOptions);
    }
  }, [customizingDish]);

  const activeVariant = useMemo(() => {
    if (!customizingDish) return null;
    const selectedNames = Object.values(selectedOptions);
    return (
      customizingDish.variants.find((variant) =>
        variant.optionNames.every((name) => selectedNames.includes(name)),
      ) || customizingDish.variants[0]
    );
  }, [customizingDish, selectedOptions]);

  const handleExpressBuy = (item: DishData) => {
    if (!item.isAvailable) return;
    clear(); // Reset cart so it's a single purchase
    addItem({
      dishId: item.id,
      slug: item.slug,
      name: item.name,
      image: item.image,
      basePrice: item.price,
      unitPrice: item.price,
      quantity: 1,
      kitchen: item.kitchen,
      isVeg: item.isVeg,
      rdVerified: item.rdVerified,
      macros: item.macros,
      customizations: [],
    });
    navigate("/checkout");
  };

  const handleAddBundle = (
    bundle: NonNullable<typeof bundles>[number],
  ) => {
    if (groupCode) {
      toast.error("Bundles can only be added to your personal cart");
      return;
    }
    const beforeLineIds = new Set(useCartStore.getState().items.map((i) => i.lineId));
    let added = 0;
    for (const did of bundle.dishIds) {
      const dish = getDishById(did);
      if (!dish || !dish.isAvailable) continue;
      // Per-line discount so the cart subtotal matches the bundle price.
      const perDishOriginal = dish.price;
      const ratio = bundle.pricePaise / Math.max(1, bundle.originalPricePaise);
      const discounted = Math.round(perDishOriginal * ratio);
      addItem({
        dishId: dish.id,
        slug: dish.slug,
        name: dish.name,
        image: dish.image,
        basePrice: dish.price,
        unitPrice: discounted,
        quantity: 1,
        kitchen: dish.kitchen,
        isVeg: dish.isVeg,
        rdVerified: dish.rdVerified,
        macros: dish.macros,
        customizations: [`Bundle: ${bundle.name}`],
      });
      added++;
    }
    if (added === 0) {
      toast.error("This bundle is currently unavailable");
    } else {
      const newLineIds = useCartStore
        .getState()
        .items.filter((i) => !beforeLineIds.has(i.lineId))
        .map((i) => i.lineId);
      // Record the slug so the server can re-validate at finalize and
      // apply the authoritative bundle discount (client-side per-line
      // pricing is just for cart UX).
      addBundleSlug(bundle.slug);
      openCart();
      toast.success(`${bundle.name} added to your order`, {
        description: `${added} item${added === 1 ? "" : "s"} for ${formatPrice(bundle.pricePaise)}`,
        action: {
          label: "Undo",
          onClick: () => newLineIds.forEach((lid) => useCartStore.getState().removeItem(lid)),
        },
      });
    }
  };

  // Reset pagination when any filter changes so the user always starts
  // at the first page of the new filtered set.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [kitchen, category, diet, lifestyle, query, activeProtocol, quickFilters]);

  // Real-time optimistic quick filter counts based on other active filters
  const quickFilterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const baseListForCounts = catalogDishes.filter((d) => {
      if (!d.isAvailable) return false;
      if (kitchen !== "all" && d.kitchen !== kitchen) return false;
      if (category !== "all" && d.category !== category) return false;
      if (diet === "veg" && !d.isVeg) return false;
      if (diet === "nonveg" && d.isVeg) return false;
      if (!matchesLifestyle(d, lifestyle)) return false;
      if (activeProtocol && !matchesProtocol(d, activeProtocol)) return false;
      if (clinicalMode && dishMatchesDietOrder(d, dietOrderId) !== null) return false;
      if (query && !d.name.toLowerCase().includes(query.toLowerCase()) && !d.description.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });

    for (const qf of QUICK_FILTERS) {
      counts[qf.value] = baseListForCounts.filter(d => matchesDietaryFilter(d, qf.value)).length;
    }
    return counts;
  }, [catalogDishes, kitchen, category, diet, lifestyle, activeProtocol, clinicalMode, dietOrderId, query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const baseList = catalogDishes.filter((d) => {
      if (!d.isAvailable) return false;
      if (kitchen !== "all" && d.kitchen !== kitchen) return false;
      if (category !== "all" && d.category !== category) return false;
      if (diet === "veg" && !d.isVeg) return false;
      if (diet === "nonveg" && d.isVeg) return false;
      if (!matchesLifestyle(d, lifestyle)) return false;
      if (activeProtocol && !matchesProtocol(d, activeProtocol)) return false;
      // Clinical-mode diet-order filter — out-of-diet items are hidden from
      // the menu entirely so the patient can't add them in the first place.
      // The cart still renders a per-line block for items added before the
      // diet order was changed.
      if (clinicalMode && dishMatchesDietOrder(d, dietOrderId) !== null) {
        return false;
      }
      if (q && !d.name.toLowerCase().includes(q) && !d.description.toLowerCase().includes(q))
        return false;
      
      // Quick Filters logic (OR within axis, AND across axes)
      if (quickFilters.length > 0) {
        const nutritionFilters = quickFilters.filter(f => ["high-protein", "keto", "carnivore"].includes(f));
        const dietFilters = quickFilters.filter(f => ["veg", "vegan", "gluten-free", "jain", "low-fodmap"].includes(f));
        const doshaFilters = quickFilters.filter(f => ["vata", "pitta", "kapha"].includes(f));

        let matchesNutrition = true;
        if (nutritionFilters.length > 0) {
          matchesNutrition = nutritionFilters.some(f => matchesDietaryFilter(d, f));
        }

        let matchesDiet = true;
        if (dietFilters.length > 0) {
          matchesDiet = dietFilters.some(f => matchesDietaryFilter(d, f));
        }

        let matchesDosha = true;
        if (doshaFilters.length > 0) {
          matchesDosha = doshaFilters.some(f => matchesDietaryFilter(d, f));
        }

        if (!matchesNutrition || !matchesDiet || !matchesDosha) {
          return false;
        }
      }

      return true;
    });
    const ranked = rankDishesForPreferences(baseList, preferences);
    return hideBlocked ? ranked.filter((r) => !r.match.blocked) : ranked;
  }, [kitchen, category, diet, lifestyle, query, preferences, hideBlocked, catalogDishes, activeProtocol, clinicalMode, dietOrderId, quickFilters]);

  const consolidatedDishes = useMemo(() => {
    const flatDishes = filtered.map((f) => f.dish);
    const grouped = groupCatalogDishes(flatDishes);
    return grouped.map((parent) => {
      const rep = filtered.find((f) => f.dish.id === parent.id)!;
      return {
        parent,
        match: rep.match,
        hasVariants: parent.optionGroups.length > 0,
      };
    });
  }, [filtered]);

  const blockedCount = useMemo(() => {
    if (!preferences) return 0;
    return catalogDishes.filter(
      (d) => evaluateDishForPreferences(d, preferences).blocked,
    ).length;
  }, [preferences, catalogDishes]);

  const lifestyleTag = (() => {
    if (lifestyle === "all") return null;
    const consumer = LIFESTYLE_TAGS[lifestyle as Exclude<Lifestyle, "all">];
    if (!clinicalMode) return consumer;
    // Replace the marketing tag printed on each MenuCard's hero image with
    // the EHR-aligned vocabulary so clinicians see "Cardiac" / "Soft" /
    // "Diabetic-CCHO" rather than "Heart Healthy" / "Silver Vitality".
    return LIFESTYLE_EHR_LABEL[lifestyle as string] ?? consumer;
  })();



  return (
    <div className="max-w-7xl mx-auto px-4 pt-6 pb-44 md:pb-8 space-y-8">
      {clinicalMode && dietOrder && (
        <div className="rounded-lg border border-clinical-gold/30 bg-clinical-gold/5 px-3 py-2 text-[11px] text-clinical-zinc flex items-start gap-2">
          <span className="text-clinical-gold font-semibold uppercase tracking-[0.14em] text-[10px] shrink-0">
            {dietOrder.short}
          </span>
          <span className="flex-1">{dietOrder.description}</span>
          <button
            type="button"
            onClick={() => clinicalModeStore.disable()}
            className="shrink-0 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-clinical-zinc hover:text-white"
            aria-label="Exit clinical mode"
          >
            <X className="w-3 h-3" />
            Exit clinical mode
          </button>
        </div>
      )}

      <div className="space-y-1">
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-white">
          {activeProtocol
            ? `${PROTOCOL_LABELS[activeProtocol]} Protocol — qualifying dishes`
            : "Menu"}
        </h1>
        <p className="text-xs uppercase tracking-[0.18em] text-clinical-zinc font-medium">
          {activeProtocol
            ? `Filtered by ${PROTOCOL_LABELS[activeProtocol]} criteria · ${filtered.length} ${filtered.length === 1 ? "dish" : "dishes"}`
            : "Cooked fresh daily · Dietitian-approved · Live availability"}
        </p>
      </div>

      {/* Delivery-promise banner — quick-commerce urgency, clinical tone. */}
      <div className="flex items-center justify-center gap-2 rounded-xl border border-clinical-gold/25 bg-clinical-gold/5 px-4 py-2.5 text-xs sm:text-[13px] text-zinc-200">
        <Zap className="w-4 h-4 text-clinical-gold fill-clinical-gold shrink-0" aria-hidden />
        <span>
          Delivered fresh to your doorstep in{" "}
          <span className="text-clinical-gold font-semibold whitespace-nowrap">25–40 minutes</span>
        </span>
      </div>

      {/* Re-order / recommendation carousel */}
      {repeatMeals.length > 0 && !groupCode && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-clinical-gold/20 border border-clinical-gold/40 flex items-center justify-center text-clinical-gold shadow-[0_0_12px_rgba(212,175,55,0.2)]">
                <Zap className="w-4 h-4 fill-clinical-gold" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-clinical-gold font-extrabold leading-none">
                  {hasOrderHistory ? "Order again" : "Picked for you"}
                </p>
                <h2 className="text-base sm:text-lg font-serif font-bold text-white mt-0.5">
                  {hasOrderHistory ? "Your usual meals" : "Matched to your goals"}
                </h2>
              </div>
            </div>
            <span className="text-[11px] text-clinical-zinc font-mono hidden sm:inline">tap + to add instantly</span>
          </div>
          <div className="flex gap-3.5 overflow-x-auto pb-3 -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {repeatMeals.map((dish) => (
              <div
                key={dish.id}
                className="w-64 shrink-0 rounded-2xl border border-white/10 bg-clinical-surface hover:border-clinical-gold/50 hover:shadow-[0_8px_25px_rgba(212,175,55,0.15)] transition-all overflow-hidden flex flex-col group"
              >
                <div className="relative h-32 overflow-hidden bg-zinc-900">
                  <img
                    src={dish.image}
                    alt={dish.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-clinical-surface via-transparent to-transparent" />
                  <div className="absolute top-2 left-2 flex gap-1 items-center">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-clinical-dark/90 backdrop-blur-md border ${
                      dish.isVeg ? "alert-safe-border alert-safe-text" : "alert-allergen-border alert-allergen-text"
                    }`}>
                      {dish.isVeg ? "VEG" : "NON-VEG"}
                    </span>
                    {dish.rdVerified && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-clinical-dark/90 backdrop-blur-md border alert-safe-border alert-safe-text">
                        ★ RD
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-3.5 flex-1 flex flex-col justify-between gap-2.5">
                  <div>
                    <h3 className="text-sm font-bold text-white leading-tight line-clamp-1 group-hover:text-clinical-gold transition-colors">
                      {dish.name}
                    </h3>
                    <p className="text-[10px] text-clinical-zinc font-mono mt-1">
                      {dish.macros.calories} kcal · {dish.macros.protein}g protein
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <span className="font-display font-extrabold text-base text-white tabular-nums">
                      {formatPrice(dish.price)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleQuickAdd(e, dish)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-clinical-gold bg-clinical-gold px-3.5 py-1.5 text-xs font-black text-[#050505] shadow-[0_0_15px_rgba(212,175,55,0.25)] hover:bg-clinical-gold/90 active:scale-95 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeProtocol && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-clinical-gold/30 bg-clinical-gold/5 px-4 py-3">
          <SparklesIcon className="w-4 h-4 text-clinical-gold shrink-0" />
          <p className="text-xs text-clinical-zinc flex-1 min-w-[12rem] leading-relaxed">
            {PROTOCOL_TAGLINES[activeProtocol]}
          </p>
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.delete("protocol");
              setSearchParams(next, { replace: true });
            }}
            className="text-[11px] uppercase tracking-[0.12em] text-clinical-gold hover:underline font-semibold"
          >
            Clear protocol filter
          </button>
        </div>
      )}

      {groupCode && (
        <Card className="bg-clinical-gold/5 border-clinical-gold/30">
          <CardContent className="p-3 text-xs flex items-center gap-2 text-clinical-zinc">
            <Users className="w-4 h-4 text-clinical-gold" />
            <span className="flex-1">
              Adding items to group{" "}
              <span className="font-mono text-clinical-gold">{groupCode}</span>.
              Items go straight to the shared order, not your cart.
            </span>
            <Link
              to={`/group/${groupCode}`}
              className="text-clinical-gold hover:underline"
            >
              View group →
            </Link>
          </CardContent>
        </Card>
      )}

      {bundles && bundles.length > 0 && !groupCode && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-clinical-zinc font-semibold flex items-center gap-1.5">
                <Package className="w-3 h-3 text-clinical-gold" />
                Curated Selections
              </p>
              <h2 className="text-lg font-serif text-white mt-0.5">
                RD-curated combos
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {bundles.map((b) => {
              const savings = b.originalPricePaise - b.pricePaise;
              const includedDishes = b.dishIds
                .map((id) => getDishById(id))
                .filter((d): d is DishData => Boolean(d));
              const includesLine = includedDishes.map((d) => d.name).join(" · ");
              return (
                <Dialog key={b.id}>
                  <Card className="bg-clinical-surface border-clinical-border hover:border-clinical-gold/40 transition-colors overflow-hidden flex flex-col">
                    <DialogTrigger asChild>
                      <button
                        type="button"
                        className="relative aspect-[4/3] block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-clinical-gold/60"
                        aria-label={`View ${b.name} combo details — save ${formatPrice(savings)}${b.badge ? ` · ${b.badge}` : ""}`}
                      >
                        {b.image && (
                          <img
                            src={b.image}
                            alt={b.name}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#050505]/85 via-transparent to-transparent keep-gradient" />
                        {b.badge && (
                          <Badge className="absolute top-2 left-2 bg-clinical-gold/90 text-[#050505] border-0 text-[9px] tracking-widest">
                            {b.badge}
                          </Badge>
                        )}
                        <div className="absolute bottom-2 right-2 bg-clinical-sage/90 text-[#050505] rounded px-1.5 py-0.5 text-[10px] font-bold">
                          Save {formatPrice(savings)}
                        </div>
                      </button>
                    </DialogTrigger>
                    <CardContent className="p-3 space-y-2 flex-1 flex flex-col">
                      <DialogTrigger asChild>
                        <button
                          type="button"
                          className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-clinical-gold/60 rounded"
                        >
                          <h3 className="text-sm font-semibold text-white hover:text-clinical-gold transition-colors">
                            {b.name}
                          </h3>
                        </button>
                      </DialogTrigger>
                      <p className="text-[11px] text-clinical-zinc line-clamp-2 leading-relaxed">
                        {b.description}
                      </p>
                      {includesLine && (
                        <p className="text-[10px] text-clinical-zinc line-clamp-2 leading-snug">
                          <span className="text-white/80">Includes: </span>
                          {includesLine}
                        </p>
                      )}
                      <div className="flex items-baseline gap-2 mt-auto pt-1">
                        <span className="text-base font-bold text-clinical-gold tabular-nums">
                          {formatPrice(b.pricePaise)}
                        </span>
                        <span className="text-[11px] text-clinical-zinc line-through tabular-nums">
                          {formatPrice(b.originalPricePaise)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-clinical-border text-clinical-zinc hover:text-white hover:border-clinical-border h-9 text-xs"
                          >
                            View
                          </Button>
                        </DialogTrigger>
                        <Button
                          size="sm"
                          onClick={() => handleAddBundle(b)}
                          className="bg-clinical-gold/15 text-clinical-gold border border-clinical-gold/40 hover:bg-clinical-gold/25 gap-1.5 h-9 text-xs"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          Add Combo to Order
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  <DialogContent className="bg-clinical-surface border-clinical-border max-w-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-white font-serif text-xl">
                        {b.name}
                      </DialogTitle>
                      <DialogDescription className="text-clinical-zinc text-xs leading-relaxed">
                        {b.description}
                      </DialogDescription>
                    </DialogHeader>
                    {b.image && (
                      <div className="relative aspect-[16/9] rounded-lg overflow-hidden border border-clinical-border">
                        <img
                          src={b.image}
                          alt={b.name}
                          className="w-full h-full object-cover"
                        />
                        {b.badge && (
                          <Badge className="absolute top-2 left-2 bg-clinical-gold/90 text-[#050505] border-0 text-[9px] tracking-widest">
                            {b.badge}
                          </Badge>
                        )}
                      </div>
                    )}
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-clinical-zinc-muted font-semibold">
                        What's inside ({includedDishes.length} {includedDishes.length === 1 ? "dish" : "dishes"})
                      </p>
                      {includedDishes.length === 0 ? (
                        <p className="text-xs text-clinical-zinc-muted italic">
                          This combo's dishes are temporarily unavailable.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {includedDishes.map((d) => (
                            <li key={d.id}>
                              <Link
                                to={`/dish/${d.slug}`}
                                className="flex items-center gap-3 p-2 rounded-lg border border-clinical-border hover:border-clinical-gold/40 transition-colors group"
                              >
                                <img
                                  src={d.image}
                                  alt={d.name}
                                  className="w-12 h-12 rounded object-cover shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-white group-hover:text-clinical-gold transition-colors truncate">
                                    {d.name}
                                  </p>
                                  <p className="text-[11px] text-clinical-zinc truncate">
                                    {d.macros.calories} kcal · {d.macros.protein}g protein
                                  </p>
                                </div>
                                <span className="text-xs text-clinical-zinc tabular-nums shrink-0">
                                  {formatPrice(d.price)}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-clinical-border">
                      <div className="space-y-0.5">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xl font-bold text-clinical-gold tabular-nums">
                            {formatPrice(b.pricePaise)}
                          </span>
                          <span className="text-xs text-clinical-zinc line-through tabular-nums">
                            {formatPrice(b.originalPricePaise)}
                          </span>
                        </div>
                        <p className="text-[10px] text-clinical-sage font-semibold">
                          You save {formatPrice(savings)}
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => handleAddBundle(b)}
                        className="w-full bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90 gap-1.5"
                      >
                        <PlusCircle className="w-4 h-4" />
                        Add Combo to Order
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              );
            })}
          </div>
        </div>
      )}

      {/* Search — sticky under the header on desktop so faceting stays
          one glance away no matter how deep the user scrolls. */}
      <div className="relative md:sticky md:top-16 md:z-30 md:-mx-2 md:px-2 md:py-2 md:bg-clinical-dark/95 md:backdrop-blur-xl md:rounded-xl">
        <Search className="absolute left-3 md:left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-clinical-zinc-muted" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search dishes, ingredients, protocols..."
          className="pl-9 pr-9 h-11 bg-clinical-surface border-clinical-border focus-visible:border-clinical-gold/40 focus-visible:ring-clinical-gold/20 text-sm"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-clinical-zinc hover:text-white"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Protocol filter chips — promotes the clinical-grade IA axis to
          a first-class browsing dimension (was previously only reachable
          via deep-link `?protocol=` from the Community → Wellness/
          Performance/Clinical pages). Per UX audit dimension 1.2. */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.18em] text-clinical-zinc font-semibold">
          Protocol
        </p>
        <div
          className="flex gap-2 overflow-x-auto md:flex-wrap -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label="Filter by clinical protocol"
        >
          {(["all", ...PROTOCOLS] as const).map((p) => {
            const active = p === "all" ? !activeProtocol : activeProtocol === p;
            const label = p === "all" ? "All Protocols" : PROTOCOL_LABELS[p];
            return (
              <button
                key={p}
                type="button"
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  if (p === "all") next.delete("protocol");
                  else next.set("protocol", p);
                  setSearchParams(next, { replace: true });
                }}
                aria-pressed={active}
                className={`shrink-0 inline-flex items-center px-3 min-h-[44px] sm:min-h-[32px] rounded-full border text-[11px] uppercase tracking-[0.12em] font-semibold transition-all ${
                  active
                    ? "border-clinical-gold/50 bg-clinical-gold/10 text-clinical-gold shadow-[0_0_12px_rgba(212,175,55,0.18)]"
                    : "border-clinical-border text-clinical-zinc hover:border-clinical-gold/30 hover:text-clinical-gold"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile-only trigger: collapse secondary filters until tapped.
          Counter shows how many filters are active so the user knows
          to expand it if they want to refine. */}
      <button
        type="button"
        onClick={() => setShowFilters((v) => !v)}
        aria-expanded={showFilters}
        className="md:hidden flex items-center justify-between w-full px-3 py-2.5 rounded-md border border-clinical-border bg-clinical-surface text-xs text-white hover:border-clinical-gold/40 min-h-11"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-clinical-gold" />
          <span>More filters</span>
          {(lifestyle !== "all" || diet !== "all" || category !== "all" || kitchen !== "all") && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-clinical-gold/20 text-clinical-gold font-bold tabular-nums">
              {[lifestyle, diet, category, kitchen].filter((v) => v !== "all").length}
            </span>
          )}
        </span>
        <span className="text-clinical-zinc text-[10px]">{showFilters ? "Hide" : "Show"}</span>
      </button>

      {/* Secondary filter rails. Always visible md+; toggle-driven on
          mobile. Wrapped in a single container so all 4 rails share
          the same collapse state. */}
      <div className={showFilters ? "space-y-3 md:space-y-4" : "hidden md:block space-y-4"}>
      {/* Lifestyle / EHR-diet chips. Clinical mode swaps the marketing
          copy ("Heart Healthy", "Silver Vitality") for hospital vocabulary
          ("Cardiac", "Soft") without altering the underlying matcher. */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.18em] text-clinical-zinc font-semibold">
          {clinicalMode ? "Therapeutic diet" : "Lifestyle"}
        </p>
        <div
          className="flex gap-2 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label="Filter by lifestyle"
        >
          {LIFESTYLE_TABS.map(({ value, label: marketingLabel, icon: Icon }) => {
            const label =
              clinicalMode && value !== "all"
                ? LIFESTYLE_EHR_LABEL[value] ?? marketingLabel
                : marketingLabel;
            const active = lifestyle === value;
            return (
              <button
                key={value}
                onClick={() => setLifestyle(value)}
                aria-pressed={active}
                className={`shrink-0 flex items-center gap-1.5 px-3 min-h-[44px] sm:min-h-[32px] rounded-full border text-[11px] uppercase tracking-[0.12em] font-semibold transition-all ${
                  active
                    ? "border-clinical-gold/50 bg-clinical-gold/10 text-clinical-gold shadow-[0_0_12px_rgba(212,175,55,0.18)]"
                    : "border-clinical-border text-clinical-zinc hover:border-clinical-gold/30 hover:text-clinical-gold"
                }`}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Diet + Category + Kitchen */}
      <div className="space-y-2 md:space-y-3">
        <div className="flex items-center gap-2 overflow-x-auto md:flex-wrap -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-clinical-zinc font-semibold pr-1">
            Diet
          </span>
          {(["all", "veg", "nonveg"] as DietFilter[]).map((opt) => {
            const active = diet === opt;
            const dot = opt === "veg" ? "bg-green-500" : opt === "nonveg" ? "bg-red-500" : null;
            return (
              <button
                key={opt}
                onClick={() => setDiet(opt)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 min-h-[44px] sm:min-h-[32px] rounded-full border text-[11px] uppercase tracking-[0.12em] font-semibold transition-all ${
                  active
                    ? "border-clinical-gold/50 bg-clinical-gold/10 text-clinical-gold"
                    : "border-clinical-border text-clinical-zinc hover:text-clinical-gold"
                }`}
              >
                {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
                {opt === "all" ? "All" : opt === "veg" ? "Veg" : "Non-Veg"}
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.18em] text-clinical-zinc font-semibold">
            Category
          </p>
          <div
            className="flex gap-2 overflow-x-auto md:flex-wrap -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label="Filter by category"
          >
            {CATEGORY_TABS.map((c) => {
              const active = category === c;
              return (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  aria-pressed={active}
                  className={`shrink-0 inline-flex items-center px-3 min-h-[44px] sm:min-h-[32px] rounded-full border text-[11px] uppercase tracking-[0.12em] font-semibold transition-all ${
                    active
                      ? "border-clinical-gold/50 bg-clinical-gold/10 text-clinical-gold"
                      : "border-clinical-border text-clinical-zinc hover:text-clinical-gold"
                  }`}
                >
                  {c === "all" ? "All Categories" : CATEGORY_LABELS[c]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.18em] text-clinical-zinc font-semibold">
            Kitchen
          </p>
          <div
            className="flex gap-2 overflow-x-auto md:flex-wrap -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label="Filter by kitchen"
          >
            {KITCHEN_TABS.map((k) => {
              const active = kitchen === k;
              return (
                <button
                  key={k}
                  onClick={() => setKitchen(k)}
                  aria-pressed={active}
                  className={`shrink-0 inline-flex items-center px-3 min-h-[44px] sm:min-h-[32px] rounded-full border text-[11px] uppercase tracking-[0.12em] font-semibold transition-all ${
                    active
                      ? "border-clinical-gold/50 bg-clinical-gold/10 text-clinical-gold"
                      : "border-clinical-border text-clinical-zinc hover:text-clinical-gold"
                  }`}
                >
                  {k === "all" ? "All Kitchens" : k.charAt(0).toUpperCase() + k.slice(1)}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      </div>{/* /secondary filter rails wrapper */}

      {/* Advanced Quick Filters Scroll Row */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.18em] text-text-secondary font-semibold">
            Quick Filters
          </p>
          <div className="flex items-center gap-4">
            {quickFilters.length > 0 && (
              <button
                onClick={() => setQuickFilters([])}
                className="text-[11px] uppercase tracking-[0.12em] text-action hover:underline font-semibold"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <div
          className="flex gap-2 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-1"
          role="group"
          aria-label="Quick filters"
        >
          {QUICK_FILTERS.map((qf) => {
            const active = quickFilters.includes(qf.value);
            const count = quickFilterCounts[qf.value] ?? 0;
            const disabled = count === 0 && !active;

            return (
              <button
                key={qf.value}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setQuickFilters(prev =>
                    active ? prev.filter(v => v !== qf.value) : [...prev, qf.value]
                  );
                }}
                className={`shrink-0 flex items-center gap-1.5 px-3.5 min-h-[44px] sm:min-h-[32px] rounded-full border text-[11px] uppercase tracking-[0.12em] font-semibold transition-all duration-150 ${
                  active
                    ? "border-saffron-700 bg-saffron-50 dark:bg-saffron-400/10 text-text-primary shadow-sm"
                    : disabled
                    ? "border-border opacity-40 cursor-not-allowed line-through"
                    : "border-border text-text-secondary hover:border-border-strong hover:text-text-primary"
                }`}
              >
                {active && <span className="text-action font-bold">✓ </span>}
                <span>{qf.label}</span>
                <span className="font-mono text-[9px] opacity-60">({count})</span>
              </button>
            );
          })}
        </div>

      {quickFilters.some((f) => ["vata", "pitta", "kapha"].includes(f)) && (
        <div className="rounded-lg border border-clinical-border bg-clinical-dark p-3 text-xs leading-relaxed animate-in fade-in">
          <p className="text-clinical-zinc">
            💡 <strong className="text-white">Ayurvedic Tip:</strong> Doshas (Vata, Pitta, Kapha) refer to traditional Indian body types. 
            If your doctor advised a standard heart or diabetic plan, you can ignore these and focus on the High-Protein, Low-FODMAP, or Keto tags.
          </p>
        </div>
      )}

      {quickFilters.includes("jain") && (
        <div className="rounded-lg border border-clinical-sage/30 bg-clinical-sage/5 p-3 text-xs leading-relaxed animate-in fade-in">
          <p className="text-clinical-zinc">
            🛡️ <strong className="text-clinical-sage">Jain Preparation Guarantee:</strong> All Jain meals are prepared in our ISO 22000 certified kitchen using dedicated, root-vegetable-free surfaces and cooking utensils to strictly prevent cross-contamination.
          </p>
        </div>
      )}
      </div>

      {preferences && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-clinical-gold/20 bg-clinical-gold/5 px-3 py-2">
          <SparklesIcon className="w-3.5 h-3.5 text-clinical-gold" />
          <span className="text-[11px] text-clinical-zinc">
            Personalized for your{" "}
            <span className="text-clinical-gold capitalize">
              {preferences.dietaryStyle}
            </span>{" "}
            profile
            {blockedCount > 0 && (
              <>
                {" · "}
                <button
                  type="button"
                  onClick={() => setHideBlocked((v) => !v)}
                  className="text-clinical-gold underline-offset-2 hover:underline"
                >
                  {hideBlocked
                    ? `${blockedCount} hidden by your preferences — show`
                    : "hide conflicts"}
                </button>
              </>
            )}
          </span>
          <Link
            to="/preferences"
            className="ml-auto text-[11px] text-clinical-gold hover:underline flex items-center gap-1"
          >
            <SlidersHorizontal className="w-3 h-3" />
            Edit
          </Link>
        </div>
      )}

      <ActiveFilters
        filters={(() => {
          const list: ActiveFilter[] = [];
          if (kitchen !== "all") {
            list.push({
              id: "kitchen",
              label: kitchen.charAt(0).toUpperCase() + kitchen.slice(1),
              onClear: () => setKitchen("all"),
            });
          }
          if (category !== "all") {
            list.push({
              id: "category",
              label: CATEGORY_LABELS[category],
              onClear: () => setCategory("all"),
            });
          }
          if (diet !== "all") {
            list.push({
              id: "diet",
              label: diet === "veg" ? "Veg" : "Non-Veg",
              onClear: () => setDiet("all"),
            });
          }
          if (lifestyle !== "all") {
            list.push({
              id: "lifestyle",
              label: clinicalMode
                ? LIFESTYLE_EHR_LABEL[lifestyle] ?? LIFESTYLE_LABELS[lifestyle]
                : LIFESTYLE_LABELS[lifestyle],
              onClear: () => setLifestyle("all"),
            });
          }
          if (activeProtocol) {
            list.push({
              id: "protocol",
              label: PROTOCOL_LABELS[activeProtocol],
              onClear: () => {
                const next = new URLSearchParams(searchParams);
                next.delete("protocol");
                setSearchParams(next, { replace: true });
              },
            });
          }
          if (query.trim()) {
            list.push({
              id: "query",
              label: `"${query.trim()}"`,
              onClear: () => setQuery(""),
            });
          }
          // Add quick filters to active filters display list
          quickFilters.forEach((qfValue) => {
            const qfInfo = QUICK_FILTERS.find(q => q.value === qfValue);
            if (qfInfo) {
              list.push({
                id: `qf-${qfValue}`,
                label: qfInfo.label,
                onClear: () => setQuickFilters(prev => prev.filter(v => v !== qfValue)),
              });
            }
          });
          return list;
        })()}
        onClearAll={() => {
          setKitchen("all");
          setCategory("all");
          setDiet("all");
          setLifestyle("all");
          setQuery("");
          setQuickFilters([]);
          if (activeProtocol) {
            const next = new URLSearchParams(searchParams);
            next.delete("protocol");
            setSearchParams(next, { replace: true });
          }
        }}
      />

      <div className="text-xs text-clinical-zinc tabular-nums">
        {consolidatedDishes.length} {consolidatedDishes.length === 1 ? "dish" : "dishes"}
      </div>

      {consolidatedDishes.length === 0 && (
        <Card className="max-w-md mx-auto bg-clinical-surface border-clinical-border text-center py-12 px-6 space-y-4 shadow-lg">
          <AlertTriangle className="w-10 h-10 text-clinical-gold mx-auto" />
          <div className="space-y-1">
            <h3 className="font-serif text-lg font-bold text-white">No clinical dishes match your filters</h3>
            <p className="text-xs text-clinical-zinc leading-relaxed">
              No clinical dishes match your current filter combination.
            </p>
          </div>
          <div className="pt-2">
            <Button
              onClick={() => {
                setKitchen("all");
                setCategory("all");
                setDiet("all");
                setLifestyle("all");
                setQuery("");
                setQuickFilters([]);
                if (activeProtocol) {
                  const next = new URLSearchParams(searchParams);
                  next.delete("protocol");
                  setSearchParams(next, { replace: true });
                }
              }}
              className="bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90 font-bold uppercase tracking-[0.12em] text-xs px-6"
            >
              Reset Filters
            </Button>
          </div>
        </Card>
      )}

      {/* Dish grid — dark luxury cards */}
      {/* Menu density: 2 dishes / row on mobile (matches Swiggy/Zomato),
          3 on tablet, 4 on desktop. The previous 1-per-row layout
          showed roughly 1.5 dishes above the fold on mobile after the
          filter rails — a known browse-friction point flagged in the
          adoption audit (P1 #19). */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 [&>*]:[content-visibility:auto] [&>*]:[contain-intrinsic-size:auto_420px]">
        {consolidatedDishes.slice(0, visibleCount).map(({ parent, match, hasVariants }, idx) => {
          const repDish: DishData = {
            ...filtered.find((f) => f.dish.id === parent.id)!.dish,
            name: parent.name,
            price: parent.variants[0].price,
          };
          return (
            <MenuCard
              key={parent.id}
              item={repDish}
              match={match}
              index={idx}
              isPremium={isPremium}
              premiumSlugs={premiumSlugs}
              preferences={preferences}
              lifestyleTag={lifestyleTag}
              hasSavedAddress={hasSavedAddress}
              hasVariants={hasVariants}
              onQuickAdd={(e) => handleQuickAddClick(e, parent)}
              onExpressBuy={hasVariants ? undefined : handleExpressBuy}
              onPremiumGate={() => navigate("/premium")}
            />
          );
        })}
      </div>

      {visibleCount < consolidatedDishes.length && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
            className="min-h-11 border-clinical-gold/40 bg-transparent text-clinical-gold hover:bg-clinical-gold/10 hover:text-clinical-gold px-6 text-[11px] uppercase tracking-[0.12em] font-semibold"
          >
            Load {Math.min(PAGE_SIZE, consolidatedDishes.length - visibleCount)} more
            <span className="ml-2 text-clinical-zinc tabular-nums">
              ({visibleCount} / {consolidatedDishes.length})
            </span>
          </Button>
        </div>
      )}

      {customizingDish && activeVariant && (
        <Dialog
          open={Boolean(customizingDish)}
          onOpenChange={(open) => !open && setCustomizingDish(null)}
        >
          <DialogContent className="bg-clinical-surface border-clinical-border text-white sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl text-white">
                Customize {customizingDish.name}
              </DialogTitle>
              <DialogDescription className="text-clinical-zinc text-xs">
                {customizingDish.description}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
              {/* Option Groups */}
              {customizingDish.optionGroups.map((group) => (
                <div key={group.name} className="space-y-2.5">
                  <h4 className="text-xs uppercase tracking-[0.12em] text-clinical-zinc-muted font-bold">
                    {group.name}
                  </h4>
                  <div className="flex flex-col gap-2">
                    {group.options.map((option) => {
                      const isSelected = selectedOptions[group.name] === option.name;
                      const optDish = catalogDishes.find((d) => d.id === option.dishId);
                      const priceDiff = optDish ? optDish.price - customizingDish.variants[0].price : 0;
                      return (
                        <label
                          key={option.name}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border text-sm cursor-pointer transition-colors",
                            isSelected
                              ? "bg-clinical-gold/5 border-clinical-gold text-white"
                              : "bg-clinical-surface-elevated border-clinical-border text-clinical-zinc hover:border-clinical-gold/30 hover:text-white"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name={`group-${group.name}`}
                              checked={isSelected}
                              onChange={() =>
                                setSelectedOptions((prev) => ({
                                  ...prev,
                                  [group.name]: option.name,
                                }))
                              }
                              className="accent-clinical-gold"
                            />
                            <span className="font-medium">{option.name}</span>
                          </div>
                          {priceDiff > 0 && (
                            <span className="text-xs text-clinical-gold tabular-nums font-medium">
                              +{formatPrice(priceDiff)}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Dynamic Macro & Price Display */}
              <div className="rounded-xl border border-clinical-border bg-clinical-surface-elevated p-4 space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-clinical-zinc text-xs">Calibrated Price</span>
                  <span className="text-lg font-serif font-bold text-clinical-gold tabular-nums">
                    {formatPrice(activeVariant.price)}
                  </span>
                </div>
                
                <div className="border-t border-dashed border-clinical-border/40 my-2 pt-2 flex gap-2.5 font-mono text-[11px] text-clinical-zinc justify-between">
                  <span className="font-semibold text-white">
                    {activeVariant.macros.calories} Kcal
                  </span>
                  <span>·</span>
                  <span>{activeVariant.macros.protein}g P</span>
                  <span>·</span>
                  <span>{activeVariant.macros.carbs}g C</span>
                  <span>·</span>
                  <span>{activeVariant.macros.fat}g F</span>
                </div>

                <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.1em] pt-1">
                  <span className="text-clinical-zinc-muted">Glycemic Status</span>
                  <span className={cn(
                    "font-bold",
                    activeVariant.glycaemicIndex === "low" && "text-clinical-sage",
                    activeVariant.glycaemicIndex === "medium" && "text-amber-400",
                    activeVariant.glycaemicIndex === "high" && "text-red-400"
                  )}>
                    {activeVariant.glycaemicIndex.toUpperCase()} GI
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter className="flex flex-row gap-2 sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setCustomizingDish(null)}
                className="flex-1 sm:flex-initial h-11 border-clinical-border bg-transparent text-clinical-zinc hover:bg-white/5 hover:text-white text-xs uppercase tracking-[0.12em] font-semibold"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const originalDish = catalogDishes.find((d) => d.id === activeVariant.id);
                  if (originalDish) {
                    if (premiumSlugs.has(originalDish.slug) && !isPremium) {
                      toast.error(`${originalDish.name} is a Premium-only dish`, {
                        description: "Join Tanmatra Premium to unlock chef-table dishes.",
                        action: { label: "See Premium", onClick: () => navigate("/premium") },
                      });
                      return;
                    }
                    addItem({
                      dishId: originalDish.id,
                      slug: originalDish.slug,
                      name: originalDish.name,
                      image: originalDish.image,
                      basePrice: originalDish.price,
                      unitPrice: originalDish.price,
                      quantity: 1,
                      kitchen: originalDish.kitchen,
                      isVeg: originalDish.isVeg,
                      rdVerified: originalDish.rdVerified,
                      macros: originalDish.macros,
                      customizations: [],
                    });
                    setCustomizingDish(null);
                    openCart();
                    toast.success(`Added ${originalDish.name} to your order`, {
                      description: "Tap View Cart to review and check out.",
                      action: { label: "View Cart", onClick: openCart },
                    });
                  }
                }}
                className="flex-1 sm:flex-initial h-11 bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90 text-xs font-bold uppercase tracking-[0.12em]"
              >
                {premiumSlugs.has(activeVariant.slug) && !isPremium
                  ? "Upgrade to Premium"
                  : "Add to Order"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Legacy inline card markup removed — moved to <MenuCard /> component.
// Original implementation below intentionally stripped to avoid duplicate JSX.
