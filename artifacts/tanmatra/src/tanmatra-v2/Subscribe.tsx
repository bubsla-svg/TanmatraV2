import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import { DISHES, macrosAreProvisional, type DishData } from "@workspace/menu-catalog";
import { useMenuCatalog } from "@/lib/menuData";
import { getRdPlanBySlug, getRdAuthor, resolvePlanWeek, findPlanSafeSwap, type RdPlan } from "@/lib/rdPlans";
import { evaluateDishForPreferences } from "@/lib/preferencesMatch";
import { usePreferences } from "@/lib/preferencesContext";
import { ACCENT_CLASSES } from "@/lib/teamData";
import { useCartStore } from "@/lib/cartContext";
import type { SubscriptionItem, SubscriptionDayPlanEntry } from "@/lib/subscriptionsApi";
import { payWithRazorpay, razorpayConfigured } from "@/lib/razorpayClient";
import { track } from "@/lib/analytics";
import { toast } from "sonner";
import { useOrders } from "@/lib/ordersContext";
import { addressesApi } from "@/lib/userAddressesApi";
import {
  subscriptionsApi,
  CADENCE_LABEL,
  type SubscriptionCadence,
} from "@/lib/subscriptionsApi";
import { checkPincode } from "@/lib/serviceablePincodes";
import GoalPlanChooser from "@/components/subscribe/GoalPlanChooser";
import { F } from "./data";
import MedicalDisclaimer from "@/components/v2/MedicalDisclaimer";
import StickyBottomBar from "@/components/layout/StickyBottomBar";
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Clock,
  Warning,
  CheckCircle,
  Plus,
  Trash,
  Info,
  CreditCard,
  CaretRight,
} from "@phosphor-icons/react";

const TIME_WINDOWS = [
  "07:00 - 08:00",
  "12:00 - 13:00",
  "13:00 - 14:00",
  "19:00 - 20:00",
  "20:00 - 21:00",
];

const LIFESTYLES = [
  { value: "", label: "No preference" },
  { value: "heart-healthy", label: "Heart-Healthy" },
  { value: "fitness-gains", label: "Fitness Gains" },
  { value: "diabetes-management", label: "Diabetes Mgmt" },
  { value: "junior-explorers", label: "Junior Explorer" },
  { value: "silver-vitality", label: "Silver Vitality" },
];

const COMMON_ALLERGENS = ["dairy", "gluten", "nuts", "soy", "eggs", "shellfish"];

interface MemberDraft {
  name: string;
  diet: "any" | "veg" | "nonveg";
  allergens: string[];
  lifestyle: string;
  spiceLevel: "mild" | "medium" | "hot";
}

const blankMember = (): MemberDraft => ({
  name: "",
  diet: "any",
  allergens: [],
  lifestyle: "",
  spiceLevel: "medium",
});

const PER_MEAL_PAISE = 75000; // Updated base meal price: ₹750
const CADENCE_DISCOUNT_PCT: Record<SubscriptionCadence, number> = {
  weekly: 5,
  fortnightly: 10,
  monthly: 15,
};
const CYCLE_WEEKS: Record<SubscriptionCadence, number> = {
  weekly: 1,
  fortnightly: 2,
  monthly: 6, // Updated: Monthly cadence maps to 6 weeks
};

type MealSlot = "breakfast" | "lunch" | "dinner";
const SLOT_ORDER: MealSlot[] = ["breakfast", "lunch", "dinner"];
const SLOT_META: Record<MealSlot, { label: string; icon: string }> = {
  breakfast: { label: "Breakfast", icon: "ph-sun-horizon" },
  lunch: { label: "Lunch", icon: "ph-sun" },
  dinner: { label: "Dinner", icon: "ph-moon-stars" },
};

type DaysMode = "everyday" | "weekdays";

const PROTOCOL_PRESETS: Record<
  string,
  { planSlug: string; slots: Record<MealSlot, boolean>; daysMode: DaysMode; blurb: string }
> = {
  wellness: {
    planSlug: "healthy-everyday-plan",
    slots: { breakfast: false, lunch: true, dinner: false },
    daysMode: "weekdays",
    blurb: "Clean, calorie-smart weekday lunches — adjust anything below.",
  },
  performance: {
    planSlug: "lean-muscle-builder",
    slots: { breakfast: false, lunch: true, dinner: true },
    daysMode: "weekdays",
    blurb: "Protein-forward lunches + recovery dinners on training days.",
  },
};

const DISH_BY_SLUG = new Map<string, DishData>(DISHES.map((d) => [d.slug, d]));

const DATE_FMT = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

function scheduleDates(start: Date, mode: DaysMode, count: number): Date[] {
  const out: Date[] = [];
  const d = new Date(start);
  let guard = 0;
  while (out.length < count && guard < 21) {
    const dow = d.getDay();
    if (mode === "everyday" || (dow !== 0 && dow !== 6)) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
    guard += 1;
  }
  return out;
}

function dayOffsetFrom(start: Date, date: Date): number {
  return Math.round((date.getTime() - start.getTime()) / 86400000);
}

interface ScheduleMeal {
  slot: MealSlot;
  dish: DishData;
  autoSwapped: boolean;
  userSwapped: boolean;
}

interface ScheduleDay {
  date: Date;
  dayOffset: number;
  rotationIdx: number;
  meals: ScheduleMeal[];
  droppedSlots: MealSlot[];
  rdTip?: string;
}

export default function V2Subscribe() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [policyModal, setPolicyModal] = useState<"pause" | "swap" | null>(null);

  // Stepper step state
  // 0: S1 Recommendation
  // 1: S2 Frequency
  // 2: S3 Duration
  // 3: S4 Billing
  // 4: S5 Schedule
  // 5: S6 Week-1 Preview
  // 6: S7 Price Review
  // 7: S8 Payment
  // 8: Success Screen
  const [step, setStep] = useState<number>(0);

  const planSlug = searchParams.get("plan");
  const directPlan = planSlug ? getRdPlanBySlug(planSlug) : undefined;
  
  // Trial mode
  const [isTrial, setIsTrial] = useState(() => {
    return searchParams.get("trial") === "1" || directPlan?.slug === "three-day-trial-pack";
  });

  const fromCart = searchParams.get("fromCart") === "1";
  const protocolParam = searchParams.get("protocol");
  const protocolPreset =
    !directPlan && !isTrial && protocolParam && protocolParam in PROTOCOL_PRESETS
      ? PROTOCOL_PRESETS[protocolParam]
      : null;

  const effectivePlan: RdPlan | undefined =
    directPlan ??
    (protocolPreset ? getRdPlanBySlug(protocolPreset.planSlug) : undefined) ??
    (isTrial ? getRdPlanBySlug("three-day-trial-pack") : undefined);

  const rdAuthor = effectivePlan ? getRdAuthor(effectivePlan) : undefined;
  const { preferences, update } = usePreferences();
  const cartItems = useCartStore((s) => s.items);
  const { dishes: catalogDishes } = useMenuCatalog();

  const showChooser = !effectivePlan && !fromCart;

  // ---- Builder configs state ----
  const [slots, setSlots] = useState<Record<MealSlot, boolean>>(
    protocolPreset?.slots ??
      (isTrial
        ? { breakfast: true, lunch: true, dinner: true }
        : { breakfast: false, lunch: true, dinner: true }),
  );
  const [daysMode, setDaysMode] = useState<DaysMode>(
    protocolPreset?.daysMode ?? "everyday",
  );
  
  // Swaps state
  const [swaps, setSwaps] = useState<Record<string, string>>({});
  const [swapSheet, setSwapSheet] = useState<{
    rotationIdx: number;
    slot: MealSlot;
    current: DishData;
    dateLabel: string;
  } | null>(null);

  const cadenceParam = searchParams.get("cadence");
  const initialCadence: SubscriptionCadence =
    cadenceParam === "weekly" || cadenceParam === "fortnightly" || cadenceParam === "monthly"
      ? cadenceParam
      : "weekly";
  const [cadence, setCadence] = useState<SubscriptionCadence>(initialCadence);
  
  // Billing Period Selection (Step 3 / S4) - No option preselected
  const [selectedBillingCadence, setSelectedBillingCadence] = useState<SubscriptionCadence | null>(null);

  const [deliveryWindow, setDeliveryWindow] = useState(TIME_WINDOWS[1]);
  const [startDate, setStartDate] = useState(() => {
    // Cut-off Logic: order by 8:00 PM on Sunday for Monday delivery
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  });

  const [members, setMembers] = useState<MemberDraft[]>([
    { ...blankMember(), name: "Primary" },
  ]);
  const [address, setAddress] = useState({
    label: "Home",
    line: "",
    city: "",
    pincode: "",
    phone: "",
  });
  const [addressPrefilled, setAddressPrefilled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);

  const toggleSlot = (slot: MealSlot) => {
    setSlots((prev) => {
      const next = { ...prev, [slot]: !prev[slot] };
      if (!next.breakfast && !next.lunch && !next.dinner) {
        toast.info("Keep at least one meal a day");
        return prev;
      }
      return next;
    });
  };

  const resolvedWeek = useMemo(
    () => (effectivePlan ? resolvePlanWeek(effectivePlan) : []),
    [effectivePlan],
  );

  const daysCount = isTrial ? Math.min(3, resolvedWeek.length || 3) : daysMode === "everyday" ? 7 : 5;

  const startDateObj = useMemo(() => {
    const d = new Date(startDate);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }, [startDate]);

  // Dynamic cut-off warning string
  const cutoffWarning = useMemo(() => {
    const d = new Date();
    const isSunday = d.getDay() === 0;
    const isBefore8PM = d.getHours() < 20;
    if (isSunday && isBefore8PM) {
      return "Order by 8:00 PM tonight for Monday morning delivery.";
    }
    return "Next delivery requires a 24-hour kitchen preparation window.";
  }, []);

  const schedule: ScheduleDay[] = useMemo(() => {
    if (!effectivePlan || resolvedWeek.length === 0) return [];
    const dates = scheduleDates(startDateObj, isTrial ? "everyday" : daysMode, daysCount);
    return dates.map((date, i) => {
      const rotationIdx = i % resolvedWeek.length;
      const rotationDay = resolvedWeek[rotationIdx];
      const meals: ScheduleMeal[] = [];
      const droppedSlots: MealSlot[] = [];
      for (const slot of SLOT_ORDER) {
        if (!slots[slot]) continue;
        const base = rotationDay[slot];
        if (!base) continue;
        const userSwapSlug = swaps[`${rotationIdx}:${slot}`];
        const userSwapDish = userSwapSlug ? DISH_BY_SLUG.get(userSwapSlug) : undefined;
        if (userSwapDish) {
          meals.push({ slot, dish: userSwapDish, autoSwapped: false, userSwapped: true });
          continue;
        }
        if (preferences) {
          const ev = evaluateDishForPreferences(base, preferences);
          const conflict =
            ev.blocked || ev.matchedAllergens.length > 0 || ev.matchedDislikes.length > 0;
          if (conflict) {
            const safe = findPlanSafeSwap(effectivePlan, base, preferences, catalogDishes);
            if (safe) {
              meals.push({ slot, dish: safe, autoSwapped: true, userSwapped: false });
            } else {
              droppedSlots.push(slot);
            }
            continue;
          }
        }
        meals.push({ slot, dish: base, autoSwapped: false, userSwapped: false });
      }
      return {
        date,
        dayOffset: dayOffsetFrom(startDateObj, date),
        rotationIdx,
        meals,
        droppedSlots,
        rdTip: rotationDay.rdTip,
      };
    });
  }, [effectivePlan, resolvedWeek, startDateObj, daysMode, daysCount, slots, swaps, preferences, isTrial, catalogDishes]);

  const weekMeals = fromCart && !effectivePlan
    ? cartItems.reduce((s, it) => s + it.quantity, 0)
    : schedule.reduce((s, d) => s + d.meals.length, 0);

  const autoSwapCount = schedule.reduce(
    (s, d) => s + d.meals.filter((m) => m.autoSwapped).length,
    0,
  );
  const droppedCount = schedule.reduce((s, d) => s + d.droppedSlots.length, 0);

  const getCalculatedPricePaise = (cad: SubscriptionCadence, meals: number, trial: boolean): number => {
    if (trial) {
      return meals === 3 ? 225000 : Math.round(meals * 75000 * 0.75 * 1.05);
    }
    if (cad === "weekly" && meals === 5) return 380000;
    if (cad === "fortnightly" && meals === 10) return 741000;
    if (cad === "monthly" && meals === 30) return 2166000;

    const basePrice = meals * 75000;
    const discountRate = cad === "monthly" ? 0.85 : cad === "fortnightly" ? 0.90 : 1.0;
    const discounted = basePrice * discountRate;
    return Math.round(discounted * 1.05);
  };

  const goToStep = (next: number) => {
    setStep(next);
    if (next === 1) {
      track("subscription_config_started", { plan: effectivePlan?.slug });
    } else if (next === 2) {
      track("delivery_frequency_selected", { frequency: cycleMeals, daysCount });
    } else if (next === 3) {
      track("protocol_duration_selected", { duration_weeks: cycleWeeks, is_trial: isTrial });
    } else if (next === 4) {
      track("billing_period_selected", { cadence: activeCadence });
    } else if (next === 5) {
      track("delivery_schedule_completed", { startDate, window: deliveryWindow, pincode: address.pincode });
    } else if (next === 6) {
      track("subscription_selected", {
        cadence: activeCadence,
        meals_per_delivery: cycleMeals,
        plan_type: isTrial ? "trial" : "standard",
        total_amount: quoteDetails?.total || 0,
        gst_amount: quoteDetails?.taxes || 0,
        discount_amount: quoteDetails?.savings || 0,
      });
      track("checkout_started", { total_amount: quoteDetails?.total });
      track("address_validated", { city: address.city, pincode: address.pincode });
      track("price_quote_viewed", { subtotal: quoteDetails?.subtotal, total: quoteDetails?.total });
    } else if (next === 7) {
      track("payment_method_selected", { method: "upi_razorpay" });
    }
  };

  const activeCadence = isTrial ? "weekly" : selectedBillingCadence || cadence;
  const cycleWeeks = isTrial ? 1 : CYCLE_WEEKS[activeCadence];
  const cycleMeals = effectivePlan ? weekMeals * cycleWeeks : weekMeals;

  // ---- Dynamic quote details from backend quote API ----
  const [quoteDetails, setQuoteDetails] = useState<{
    subtotal: number;
    taxes: number;
    savings: number;
    total: number;
    nextBillingAmount: number;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    subscriptionsApi
      .quote({
        cadence: activeCadence,
        mealsPerDelivery: cycleMeals,
        planType: isTrial ? "trial" : "standard",
      })
      .then((q) => {
        if (!alive) return;
        setQuoteDetails({
          subtotal: q.pricePerDeliveryPaise,
          taxes: q.gstPaise,
          savings: q.discountPaise,
          total: q.totalPaise,
          nextBillingAmount: q.totalPaise,
        });
      })
      .catch((err) => {
        console.error("Quote fetch error", err);
      });
    return () => {
      alive = false;
    };
  }, [activeCadence, cycleMeals, isTrial, members.length]);

  const F_Paise = (paise: number) => F(paise);

  const firstDeliveryLabel = schedule.length > 0 ? DATE_FMT.format(schedule[0].date) : DATE_FMT.format(startDateObj);

  const swapAlternatives = useMemo(() => {
    if (!swapSheet) return [];
    return catalogDishes
      .filter(
        (d) =>
          d.isAvailable &&
          d.category === swapSheet.current.category &&
          d.slug !== swapSheet.current.slug,
      )
      .filter((d) => {
        if (!preferences) return true;
        const ev = evaluateDishForPreferences(d, preferences);
        return !ev.blocked && ev.matchedAllergens.length === 0 && ev.matchedDislikes.length === 0;
      })
      .slice(0, 12);
  }, [swapSheet, preferences, catalogDishes]);

  // Saved address loading
  useEffect(() => {
    let alive = true;
    addressesApi
      .list()
      .then((r) => {
        if (!alive || r.addresses.length === 0) return;
        const def = r.addresses.find((a) => a.isDefault) ?? r.addresses[0];
        setAddress((prev) => {
          if (prev.line.trim()) return prev;
          return {
            label: def.label || "Home",
            line: [def.line1, def.line2].filter(Boolean).join(", "),
            city: def.city ?? "",
            pincode: def.pincode ?? "",
            phone: def.phone ?? "",
          };
        });
        setAddressPrefilled(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const updateMember = (idx: number, patch: Partial<MemberDraft>) => {
    setMembers((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  };

  const toggleAllergen = (idx: number, allergen: string) => {
    setMembers((prev) =>
      prev.map((m, i) => {
        if (i !== idx) return m;
        const has = m.allergens.includes(allergen);
        const nextAllergens = has
          ? m.allergens.filter((a) => a !== allergen)
          : [...m.allergens, allergen];
        if (i === 0) {
          void update({ allergens: nextAllergens });
        }
        return { ...m, allergens: nextAllergens };
      }),
    );
  };

  const addMember = () => setMembers((p) => [...p, blankMember()]);
  const removeMember = (idx: number) => setMembers((p) => p.filter((_, i) => i !== idx));

  const pincodeCheck = useMemo(() => checkPincode(address.pincode), [address.pincode]);

  const addressComplete = Boolean(
    address.line.trim() &&
    address.phone.trim() &&
    address.pincode.trim() &&
    pincodeCheck.state === "serviceable",
  );

  const applySwap = (dish: DishData) => {
    if (!swapSheet) return;
    const oldDish = swapSheet.current;
    setSwaps((prev) => ({
      ...prev,
      [`${swapSheet.rotationIdx}:${swapSheet.slot}`]: dish.slug,
    }));
    track("plan_dish_swapped", {
      plan: effectivePlan?.slug,
      slot: swapSheet.slot,
      from: oldDish.slug,
      to: dish.slug,
    });
    
    // Macro and price difference warning
    const macroDelta = (dish.macros?.protein || 0) - (oldDish.macros?.protein || 0);
    const macroMsg =
      macroDelta > 0
        ? `(+${macroDelta}g protein)`
        : macroDelta < 0
        ? `(${macroDelta}g protein)`
        : "";
    toast.success(`Swapped to ${dish.name} ${macroMsg}`, {
      description: "Applies to this day every week at flat meal rate.",
    });
    setSwapSheet(null);
  };

  const clearSwap = (rotationIdx: number, slot: MealSlot) => {
    setSwaps((prev) => {
      const next = { ...prev };
      delete next[`${rotationIdx}:${slot}`];
      return next;
    });
  };

  const submit = async () => {
    if (!addressComplete) {
      toast.error("Please complete delivery details and verification");
      return;
    }
    setSubmitting(true);
    try {
      let dayPlan: SubscriptionDayPlanEntry[] | undefined;
      let defaultItems: SubscriptionItem[];
      
      if (effectivePlan && schedule.length > 0) {
        const weekEntries: SubscriptionDayPlanEntry[] = schedule
          .filter((d) => d.meals.length > 0)
          .map((d) => ({
            dayOffset: d.dayOffset,
            items: d.meals.map((m) => ({
              slug: m.dish.slug,
              name: m.dish.name,
              image: m.dish.image,
              quantity: 1,
              unitPricePaise: m.dish.price,
            })),
          }));
        dayPlan = [];
        for (let w = 0; w < cycleWeeks; w++) {
          for (const entry of weekEntries) {
            dayPlan.push({ dayOffset: entry.dayOffset + w * 7, items: entry.items });
          }
        }
        
        const agg = new Map<string, SubscriptionItem>();
        for (const entry of weekEntries) {
          for (const it of entry.items) {
            const prev = agg.get(it.slug);
            if (prev) prev.quantity += it.quantity;
            else agg.set(it.slug, { ...it });
          }
        }
        defaultItems = Array.from(agg.values());
      } else {
        defaultItems = cartItems.map((ci) => ({
          slug: ci.slug,
          name: ci.name,
          image: ci.image,
          quantity: ci.quantity,
          unitPricePaise: ci.unitPrice,
        }));
      }

      const result = await subscriptionsApi.create({
        cadence: activeCadence,
        mealsPerDelivery: cycleMeals,
        deliveryWindow,
        startDate: startDateObj.toISOString(),
        planType: isTrial ? "trial" : "standard",
        addressLabel: address.label,
        addressLine: address.line,
        city: address.city,
        pincode: address.pincode,
        phone: address.phone,
        notes: effectivePlan ? `RD Plan: ${effectivePlan.name}` : undefined,
        members: members.map((m) => ({
          name: m.name.trim(),
          diet: m.diet,
          allergens: m.allergens,
          lifestyle: m.lifestyle || undefined,
          spiceLevel: m.spiceLevel,
        })),
        defaultItems,
        dayPlan,
      });

      const amountDue = result.subscription.pricePerDeliveryPaise;
      if (razorpayConfigured() && amountDue > 0) {
        track("payment_initiated", { total_amount: amountDue });
        const outcome = await payWithRazorpay({
          amountPaise: amountDue,
          receipt: `sub-${result.subscription.id}`,
          description: isTrial
            ? "Tanmatra 3-Day Trial Pack"
            : `Tanmatra ${CADENCE_LABEL[activeCadence]} plan — first cycle`,
          contact: address.phone,
        });
        if (outcome === "cancelled") {
          await subscriptionsApi.cancel(result.subscription.id).catch(() => undefined);
          track("mandate_authorization_failed", { error_code: "user_cancelled" });
          toast.info("Payment cancelled — plan not active", {
            description: "You can try completing checkout again.",
          });
          setSubmitting(false);
          return;
        }

        if (outcome === "paid" && !isTrial && activeCadence !== "monthly") {
          track("mandate_created", { cadence: activeCadence, max_amount: amountDue });
        }
      }

      if (fromCart) {
        useCartStore.getState().clear();
      }

      track("payment_succeeded", { total_amount: amountDue, order_id: `sub-${result.subscription.id}` });
      track("order_confirmed", { order_id: `sub-${result.subscription.id}` });
      track("subscription_activated", {
        planType: isTrial ? "trial" : "standard",
        cadence: activeCadence,
        amountPaise: amountDue,
        mealsPerWeek: weekMeals,
      });

      setSuccessOrderId(`sub-${result.subscription.id}`);
      goToStep(8); // success screen step
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("Could not create subscription", { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isMounted) return null;

  // Render S1 Recommendation (Step 0)
  const renderS1Recommendation = () => {
    if (!effectivePlan) return null;
    const estPrice = quoteDetails?.total ? F_Paise(quoteDetails.total) : `${F(380000)}/week`;
    return (
      <div className="flex flex-col gap-6">
        <div className="card border border-white/5" style={{ background: "var(--tnm-surface-ink-2)" }}>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] uppercase font-bold tracking-wider bg-[var(--tnm-action)]/15 text-[var(--tnm-action)] border border-[var(--tnm-action)]/20 px-2 py-0.5 rounded">
              Recommended Protocol
            </span>
          </div>
          <h2 className="text-lg font-bold text-white/90">{effectivePlan.name}</h2>
          <p className="fine text-white/60 mt-1 leading-relaxed">{effectivePlan.tagline}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-white/70">
              Avg {effectivePlan.calorieTargetPerDay} kcal/day
            </span>
            <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-white/70">
              {effectivePlan.proteinTargetGrams}g Protein
            </span>
          </div>
        </div>

        <div className="card bg-white/[0.01] border border-white/5 p-4 rounded-xl flex flex-col gap-3">
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-white/50 font-medium">Estimated Starting Price</span>
            <span className="tnm-data text-lg font-bold text-[var(--tnm-action)] font-mono">{estPrice}</span>
          </div>
          <p className="fine text-white/45 leading-relaxed">
            Prices are dynamically calculated from our kitchen based on cadence and number of eaters. All deliveries are free.
          </p>
        </div>

        <div className="flex flex-col gap-3 mt-6">
          <button
            onClick={() => goToStep(1)}
            className="btn btn-p w-full flex items-center justify-center gap-1.5 font-bold"
            style={{ height: 48 }}
          >
            Build this plan
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              setIsTrial(true);
              setSlots({ breakfast: true, lunch: true, dinner: true });
              goToStep(4); // Land straight on scheduling/checkout for Trial
            }}
            className="btn btn-s btn-blk w-full text-xs font-semibold"
            style={{ height: 40 }}
          >
            Try 3-day sampler pack first ({F_Paise(getCalculatedPricePaise("weekly", 3, true))})
          </button>
        </div>
      </div>
    );
  };

  // Render S2 Frequency (Step 1)
  const renderS2Frequency = () => {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h3 className="text-sm font-bold text-white/95">Set your delivery frequency</h3>
          <p className="fine text-white/50 mt-1 leading-relaxed">
            This controls the number of meals you receive. It does not change how often you are billed.
          </p>
        </div>

        <div className="card flex flex-col gap-4" style={{ background: "var(--s2)", borderColor: "var(--ln)" }}>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-white/45 mb-2">Meals per day</span>
            <div className="grid grid-cols-3 gap-2">
              {SLOT_ORDER.map((slot) => {
                const on = slots[slot];
                return (
                  <button
                    key={slot}
                    onClick={() => toggleSlot(slot)}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                      on
                        ? "bg-[var(--tnm-action)] border-[var(--tnm-action)] text-black"
                        : "bg-white/5 border-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    {SLOT_META[slot].label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col pt-2 border-t border-white/5">
            <span className="text-[10px] uppercase font-bold text-white/45 mb-2">Delivery days each week</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDaysMode("everyday")}
                className={`py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                  daysMode === "everyday"
                    ? "bg-[var(--tnm-action)] border-[var(--tnm-action)] text-black"
                    : "bg-white/5 border-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                Every day (7 days)
              </button>
              <button
                onClick={() => setDaysMode("weekdays")}
                className={`py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                  daysMode === "weekdays"
                    ? "bg-[var(--tnm-action)] border-[var(--tnm-action)] text-black"
                    : "bg-white/5 border-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                Weekdays only (5 days)
              </button>
            </div>
          </div>
        </div>

        {/* Validator */}
        {weekMeals < 3 && (
          <div className="card border-[var(--color-alert-allergen)] border bg-[var(--color-alert-allergen)]/5 p-3 flex gap-2 rounded-xl items-center">
            <Warning className="w-4 h-4 text-[var(--color-alert-allergen)] shrink-0" />
            <span className="text-[10px] text-white/80">
              Subscriptions must configure a minimum of 3 delivery meals per week.
            </span>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => goToStep(0)}
            className="btn btn-s btn-blk px-5"
            style={{ height: 44 }}
          >
            Back
          </button>
          <button
            disabled={weekMeals < 3}
            onClick={() => goToStep(2)}
            className={`btn btn-p flex-1 flex items-center justify-center gap-1.5 font-bold ${
              weekMeals < 3 ? "opacity-50 cursor-not-allowed" : ""
            }`}
            style={{ height: 44 }}
          >
            Continue to duration
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  // Render S3 Duration (Step 2)
  const renderS3Duration = () => {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h3 className="text-sm font-bold text-white/95">Select your protocol duration</h3>
          <p className="fine text-white/50 mt-1 leading-relaxed">
            Commit longer to optimize metabolic health adaptations.
          </p>
        </div>

        {/* Commitment-anxiety disclosure verbatim */}
        <div className="card bg-[var(--tnm-action)]/5 border border-[var(--tnm-action)]/20 p-4 rounded-xl flex gap-3">
          <Info className="w-5 h-5 text-[var(--tnm-action)] shrink-0 mt-0.5" />
          <p className="fine text-white/80 leading-relaxed font-medium">
            You are in full control. Pause, skip, or cancel your protocol at any time in one tap. No contracts, no penalties. Unused weeks are refunded instantly.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {/* Card 1: 1 Week */}
          <button
            onClick={() => {
              setCadence("weekly");
              setSelectedBillingCadence("weekly");
              goToStep(3);
            }}
            className="card text-left flex justify-between items-center bg-[var(--tnm-surface-ink-2)] border border-white/5 p-4 rounded-xl hover:border-white/10 hover:bg-white/5 transition-all w-full"
          >
            <div>
              <h4 className="text-sm font-bold text-white/90">1-Week Commitment</h4>
              <p className="fine text-white/50 mt-1">Stops after Week 1 unless you choose to continue.</p>
            </div>
            <CaretRight className="w-4 h-4 text-white/40" />
          </button>

          {/* Card 2: 2 Weeks */}
          <button
            onClick={() => {
              setCadence("fortnightly");
              setSelectedBillingCadence("fortnightly");
              goToStep(3);
            }}
            className="card text-left flex justify-between items-center bg-[var(--tnm-surface-ink-2)] border border-white/5 p-4 rounded-xl hover:border-white/10 hover:bg-white/5 transition-all w-full"
          >
            <div>
              <h4 className="text-sm font-bold text-white/90">2-Week Commitment</h4>
              <p className="fine text-white/50 mt-1">Stops after Week 2 unless you choose to continue.</p>
            </div>
            <CaretRight className="w-4 h-4 text-white/40" />
          </button>

          {/* Card 3: 6-Week Protocol (monthly cadence) */}
          <button
            onClick={() => {
              setCadence("monthly");
              setSelectedBillingCadence("monthly");
              goToStep(3);
            }}
            className="card text-left flex justify-between items-center bg-[var(--tnm-surface-ink-2)] border-[var(--tnm-action)]/30 bg-[var(--tnm-action)]/5 p-4 rounded-xl hover:bg-[var(--tnm-action)]/10 transition-all w-full"
          >
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-sm font-bold text-white/95">6-Week Protocol</h4>
                <span className="text-[9px] uppercase font-bold text-black bg-[var(--tnm-action)] px-1.5 py-0.5 rounded tracking-wide">
                  Best Value
                </span>
              </div>
              <p className="fine text-white/60 mt-1">Stops after Week 6 unless you choose to continue.</p>
            </div>
            <CaretRight className="w-4 h-4 text-[var(--tnm-action)]" />
          </button>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => goToStep(1)}
            className="btn btn-s btn-blk px-5"
            style={{ height: 44 }}
          >
            Back
          </button>
        </div>
      </div>
    );
  };

  // Render S4 Billing (Step 3) - No option preselected by default
  const renderS4Billing = () => {
    const weeklyPricePaise = getCalculatedPricePaise("weekly", cycleMeals, false);
    const fortnightlyPricePaise = getCalculatedPricePaise("fortnightly", cycleMeals, false);
    const monthlyPricePaise = getCalculatedPricePaise("monthly", cycleMeals, false);

    const weeklyPriceStr = F_Paise(weeklyPricePaise);
    const fortnightlyPriceStr = F_Paise(fortnightlyPricePaise);
    const monthlyPriceStr = F_Paise(monthlyPricePaise);
    
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h3 className="text-sm font-bold text-white/95">Choose your billing interval</h3>
          <p className="fine text-white/50 mt-1 leading-relaxed">
            Select a cadence to set up your billing authorization. All plans remain flexible.
          </p>
        </div>

        {/* UPI Autopay mandate disclosure verbatim */}
        <div className="card bg-white/[0.02] border border-white/5 p-4 rounded-xl flex gap-3 text-xs leading-relaxed text-white/80">
          <Info className="w-5 h-5 text-[var(--tnm-action)] shrink-0 mt-0.5" />
          <p className="fine">
            Weekly and bi-weekly payments use UPI Autopay. You'll get a notification at least 24 hours before each charge, and you can pause or cancel anytime in one tap. Setting up Autopay is free.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {/* Option 1: Weekly Billing */}
          <button
            onClick={() => setSelectedBillingCadence("weekly")}
            className={`card text-left p-4 rounded-xl border transition-all w-full flex items-center justify-between ${
              selectedBillingCadence === "weekly"
                ? "bg-[var(--tnm-action)]/5 border-[var(--tnm-action)]"
                : "bg-[var(--tnm-surface-ink-2)] border-white/5 hover:border-white/10"
            }`}
          >
            <div className="flex-1 pr-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-white/90">Pay Weekly</span>
                <span className="text-[9px] uppercase font-bold text-[var(--tnm-action)]/80 bg-[var(--tnm-action)]/10 px-1.5 py-0.5 rounded tracking-wide">
                  Recommended for flexibility
                </span>
              </div>
              <p className="fine text-white/45 mt-1">Pay every 7 days via UPI Autopay.</p>
              <p className="fine text-[9px] text-[var(--tnm-action)]/85 mt-2 leading-relaxed">
                Weekly payments use UPI Autopay. You'll get a notification at least 24 hours before each charge, and you can pause or cancel anytime in one tap. Setting up Autopay is free.
              </p>
            </div>
            <span className="tnm-data text-sm font-bold text-white/90 font-mono shrink-0">{weeklyPriceStr}</span>
          </button>

          {/* Option 2: Fortnightly Billing */}
          <button
            onClick={() => setSelectedBillingCadence("fortnightly")}
            className={`card text-left p-4 rounded-xl border transition-all w-full flex items-center justify-between ${
              selectedBillingCadence === "fortnightly"
                ? "bg-[var(--tnm-action)]/5 border-[var(--tnm-action)]"
                : "bg-[var(--tnm-surface-ink-2)] border-white/5 hover:border-white/10"
            }`}
          >
            <div className="flex-1 pr-3">
              <span className="text-xs font-bold text-white/90">Pay Bi-Weekly</span>
              <p className="fine text-white/45 mt-1">Prepay 10 meals (Save 10% total).</p>
              <p className="fine text-[9px] text-[var(--tnm-action)]/85 mt-2 leading-relaxed">
                Bi-weekly payments use UPI Autopay. You'll get a notification at least 24 hours before each charge, and you can pause or cancel anytime in one tap. Setting up Autopay is free.
              </p>
            </div>
            <span className="tnm-data text-sm font-bold text-white/90 font-mono shrink-0">{fortnightlyPriceStr}</span>
          </button>

          {/* Option 3: 6-Week Protocol Billing */}
          <button
            onClick={() => setSelectedBillingCadence("monthly")}
            className={`card text-left p-4 rounded-xl border transition-all w-full flex items-center justify-between ${
              selectedBillingCadence === "monthly"
                ? "bg-[var(--tnm-action)]/5 border-[var(--tnm-action)]"
                : "bg-[var(--tnm-surface-ink-2)] border-[var(--tnm-action)]/30 hover:bg-[var(--tnm-action)]/10"
            }`}
          >
            <div className="flex-1 pr-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white/95">Pay Full 6-Week Protocol</span>
                <span className="text-[9px] uppercase font-bold text-black bg-[var(--tnm-action)] px-1.5 py-0.5 rounded tracking-wide">
                  Best Value
                </span>
              </div>
              <p className="fine text-white/50 mt-1">One-time prepaid intent (Save 15% overall).</p>
            </div>
            <span className="tnm-data text-sm font-bold text-white/95 font-mono shrink-0">{monthlyPriceStr}</span>
          </button>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => goToStep(2)}
            className="btn btn-s btn-blk px-5"
            style={{ height: 44 }}
          >
            Back
          </button>
          <button
            disabled={!selectedBillingCadence}
            onClick={() => goToStep(4)}
            className={`btn btn-p flex-1 flex items-center justify-center gap-1.5 font-bold ${
              !selectedBillingCadence ? "opacity-50 cursor-not-allowed" : ""
            }`}
            style={{ height: 44 }}
          >
            Continue to schedule
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  // Render S5 Schedule (Step 4)
  const renderS5Schedule = () => {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h3 className="text-sm font-bold text-white/95">Delivery details & start date</h3>
          <p className="fine text-white/50 mt-1 leading-relaxed">
            Ensure your pincode is serviceable and select your delivery slot.
          </p>
        </div>

        {/* Noida/NCR Pincode Serviceability & Slot details */}
        <div className="card flex flex-col gap-4 border border-white/5" style={{ background: "var(--tnm-surface-ink-2)" }}>
          <div>
            <span className="text-[10px] uppercase font-bold text-white/45 mb-2 block">Pincode check</span>
            <input
              type="text"
              maxLength={6}
              value={address.pincode}
              onChange={(e) => setAddress({ ...address, pincode: e.target.value })}
              placeholder="e.g. 201301"
              className="inp w-full font-mono"
            />
            {address.pincode.length === 6 && pincodeCheck.state === "unserviceable" && (
              <p className="fine text-[var(--tnm-alert)] font-semibold mt-1.5 leading-snug">
                ⚠️ Pincode unserviceable. Currently delivering to selected sectors in Noida, Delhi, and Gurgaon.
              </p>
            )}
            {pincodeCheck.state === "serviceable" && (
              <p className="fine text-[var(--tnm-sage)] font-semibold mt-1.5 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Servicing confirmed: {pincodeCheck.info.area} ({pincodeCheck.info.city})
              </p>
            )}
          </div>

          <div className="pt-3 border-t border-white/5">
            <span className="text-[10px] uppercase font-bold text-white/45 mb-2 block">First Delivery Date</span>
            <input
              type="date"
              value={startDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setStartDate(e.target.value)}
              className="inp w-full"
            />
            <p className="fine text-white/50 mt-2">
              {cutoffWarning}
            </p>
          </div>

          <div className="pt-3 border-t border-white/5">
            <span className="text-[10px] uppercase font-bold text-white/45 mb-2 block">Delivery window</span>
            <div className="grid grid-cols-2 gap-2">
              {TIME_WINDOWS.slice(0, 4).map((w) => (
                <button
                  key={w}
                  onClick={() => setDeliveryWindow(w)}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                    deliveryWindow === w
                      ? "bg-[var(--tnm-action)] border-[var(--tnm-action)] text-black"
                      : "bg-white/5 border-white/5 text-white/70 hover:bg-white/10"
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => goToStep(isTrial ? 0 : 3)}
            className="btn btn-s btn-blk px-5"
            style={{ height: 44 }}
          >
            Back
          </button>
          <button
            disabled={!address.pincode || pincodeCheck.state !== "serviceable"}
            onClick={() => goToStep(5)}
            className={`btn btn-p flex-1 flex items-center justify-center gap-1.5 font-bold ${
              !address.pincode || pincodeCheck.state !== "serviceable" ? "opacity-50 cursor-not-allowed" : ""
            }`}
            style={{ height: 44 }}
          >
            Continue to preview
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  // Render S6 Week-1 Preview (Step 5)
  const renderS6Preview = () => {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h3 className="text-sm font-bold text-white/95">Your first week preview</h3>
          <p className="fine text-white/50 mt-1 leading-relaxed">
            Review dishes and swap anything. Allergen restrictions have been auto-filtered.
          </p>
        </div>

        {/* Profile-change notification safety message */}
        {autoSwapCount > 0 && (
          <div className="card bg-[var(--tnm-action)]/5 border border-[var(--tnm-action)]/20 p-3.5 rounded-xl flex gap-2.5 items-start">
            <ShieldCheck className="w-5 h-5 text-[var(--tnm-action)] shrink-0 mt-0.5" weight="fill" />
            <p className="fine text-white/80 leading-relaxed font-semibold">
              We updated {autoSwapCount} meal{autoSwapCount === 1 ? "" : "s"} to reflect your dietary safety profile exclusions.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {schedule.map((day, idx) => (
            <div
              key={idx}
              className="card flex flex-col gap-3 border border-white/5"
              style={{ background: "var(--tnm-surface-ink-2)", padding: 12 }}
            >
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">
                  Day {idx + 1} &bull; {DATE_FMT.format(day.date)}
                </span>
                <span className="text-[9px] uppercase font-bold text-[var(--tnm-action)] bg-[var(--tnm-action)]/10 px-1.5 py-0.5 rounded tracking-wide">
                  {day.meals.length} meals
                </span>
              </div>

              {day.meals.map((m) => (
                <div key={m.slot} className="flex gap-3 items-center border-t border-white/5 pt-2.5">
                  <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-white/10 bg-white/5">
                    <img src={m.dish.image} alt={m.dish.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-mono text-white/40">{SLOT_META[m.slot].label}</span>
                      {m.autoSwapped && (
                        <span className="text-[8px] bg-[var(--tnm-sage)]/10 text-[var(--tnm-sage)] px-1 rounded uppercase font-extrabold tracking-wide">
                          allergen-safe swap
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs font-bold text-white/90 truncate leading-snug">{m.dish.name}</h4>
                    <p className="tnm-data text-[10px] text-white/45 font-mono mt-0.5">
                      {m.dish.macros?.calories || "—"} kcal &bull; {m.dish.macros?.protein || "—"}g protein
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {m.userSwapped && (
                      <button
                        type="button"
                        onClick={() => clearSwap(day.rotationIdx, m.slot)}
                        className="text-[10px] text-white/40 hover:text-white underline font-semibold"
                      >
                        Reset
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setSwapSheet({
                          rotationIdx: day.rotationIdx,
                          slot: m.slot,
                          current: m.dish,
                          dateLabel: DATE_FMT.format(day.date),
                        })
                      }
                      className="btn btn-s text-[10px] font-bold px-3 py-1 bg-white/5 border border-white/10 hover:bg-white/10"
                      style={{ height: 28 }}
                    >
                      Swap
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => goToStep(4)}
            className="btn btn-s btn-blk px-5"
            style={{ height: 44 }}
          >
            Back
          </button>
          <button
            onClick={() => goToStep(6)}
            className="btn btn-p flex-1 flex items-center justify-center gap-1.5 font-bold"
            style={{ height: 44 }}
          >
            Continue to review
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  // Render S7 Price Review (Step 6)
  const renderS7Review = () => {
    const subtotal = quoteDetails?.subtotal ? F_Paise(quoteDetails.subtotal) : F(375000);
    const taxes = quoteDetails?.taxes ? F_Paise(quoteDetails.taxes) : F(20000);
    const savings = quoteDetails?.savings ? F_Paise(quoteDetails.savings) : F(15000);
    const total = quoteDetails?.total ? F_Paise(quoteDetails.total) : F(380000);
    
    const nextChargeDate = new Date();
    nextChargeDate.setDate(nextChargeDate.getDate() + 7);
    const nextDateLabel = DATE_FMT.format(nextChargeDate);

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h3 className="text-sm font-bold text-white/95">Price Review & Verification</h3>
          <p className="fine text-white/50 mt-1 leading-relaxed">
            Review your itemized summary. Cut-offs apply to ingredient processing.
          </p>
        </div>

        {/* Itemized bill panel */}
        <div className="card flex flex-col gap-3" style={{ background: "var(--s2)", borderColor: "var(--ln)" }}>
          <h4 className="text-xs font-bold text-white/90">Pre-checkout invoice</h4>
          <div className="flex justify-between text-xs text-white/60 pt-2 border-t border-white/5">
            <span>{cycleMeals} meal deliveries</span>
            <span className="font-mono text-white/80">{subtotal}</span>
          </div>
          <div className="flex justify-between text-xs text-white/60">
            <span>GST Taxes (18% clinical catering)</span>
            <span className="font-mono text-white/80">{taxes}</span>
          </div>
          <div className="flex justify-between text-xs text-white/60">
            <span>Delivery service charge</span>
            <span className="text-[var(--color-alert-safe)] font-semibold">FREE</span>
          </div>
          {quoteDetails?.savings !== undefined && quoteDetails.savings > 0 && (
            <div className="flex justify-between text-xs text-[var(--color-alert-safe)] font-semibold">
              <span>Cadence saving discounts</span>
              <span className="font-mono">-{savings}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold text-white/90 pt-3 border-t border-white/10">
            <span>Payable Today</span>
            <span className="tnm-data font-mono text-[var(--tnm-action)]">{total}</span>
          </div>
        </div>

        {/* Next payment details immediately below */}
        {!isTrial && (
          <div className="card bg-white/[0.01] border border-white/5 p-3.5 rounded-xl flex flex-col gap-2 text-xs">
            <div className="flex justify-between text-white/50">
              <span>Next Renewal Date:</span>
              <span className="font-medium text-white/80">{nextDateLabel}</span>
            </div>
            <div className="flex justify-between text-white/50">
              <span>Next Renewal Charge:</span>
              <span className="font-medium text-[var(--tnm-action)]">{total}</span>
            </div>
            <div className="flex justify-between text-white/50">
              <span>Commitment Length:</span>
              <span className="font-medium text-white/80">
                {activeCadence === "monthly" ? "6 Weeks" : activeCadence === "fortnightly" ? "2 Weeks" : "1 Week"}
              </span>
            </div>
            <p className="text-[10px] text-white/40 mt-1 leading-snug">
              Your protocol stops after Week {activeCadence === "monthly" ? "6" : activeCadence === "fortnightly" ? "2" : "1"} unless you choose to continue.
            </p>
          </div>
        )}

        {/* Verbatim cut-off rules */}
        <div className="card bg-[var(--tnm-action)]/5 border border-[var(--tnm-action)]/20 p-3.5 rounded-xl flex gap-3 text-xs leading-relaxed text-white/85">
          <Info className="w-5 h-5 text-[var(--tnm-action)] shrink-0 mt-0.5" />
          <p className="fine">
            <strong>Cut-off rule:</strong> Skips, swaps, or pauses must be made 24 hours before your scheduled delivery window. Late cancellations cannot be refunded as ingredients are already sourced.
          </p>
        </div>

        {/* S7b Flexibility checklist module */}
        <div className="card bg-white/[0.01] border border-white/5 p-4 rounded-xl">
          <h4 className="text-xs font-bold text-white/90 mb-3 flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-[var(--tnm-action)]" />
            Your Plan Remains Flexible
          </h4>
          <ul className="flex flex-col gap-2.5 text-xs text-white/60">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[var(--tnm-action)] rounded-full shrink-0" />
              Swap any dish before kitchen cooking cut-off.
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[var(--tnm-action)] rounded-full shrink-0" />
              Pause or skip days instantly from Billing settings.
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[var(--tnm-action)] rounded-full shrink-0" />
              Review invoice charges 24h before transactions.
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[var(--tnm-action)] rounded-full shrink-0" />
              Zero cancellation fees or locked lock-in periods.
            </li>
          </ul>
        </div>

        {/* Address and Address Complete fields */}
        <div className="card flex flex-col gap-3 border border-white/5" style={{ background: "var(--tnm-surface-ink-2)" }}>
          <h4 className="text-xs font-bold text-white/90">Eater & Delivery Address Details</h4>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-white/45 font-mono">Recipient Name</span>
            <input
              type="text"
              value={members[0]?.name || ""}
              onChange={(e) => updateMember(0, { name: e.target.value })}
              placeholder="Primary Eater Name"
              className="inp w-full"
            />
          </div>
          <div className="flex flex-col gap-1.5 mt-2">
            <span className="text-[10px] text-white/45 font-mono">Mobile Contact Phone</span>
            <input
              type="text"
              value={address.phone}
              onChange={(e) => setAddress({ ...address, phone: e.target.value })}
              placeholder="e.g. +91 92892 13115"
              className="inp w-full"
            />
          </div>
          <div className="flex flex-col gap-1.5 mt-2">
            <span className="text-[10px] text-white/45 font-mono">Full Street/House Address</span>
            <input
              type="text"
              value={address.line}
              onChange={(e) => setAddress({ ...address, line: e.target.value })}
              placeholder="e.g. Sector 62, Noida"
              className="inp w-full"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => goToStep(5)}
            className="btn btn-s btn-blk px-5"
            style={{ height: 44 }}
          >
            Back
          </button>
          <button
            disabled={submitting || !addressComplete}
            onClick={() => goToStep(7)} // Payment Step
            className={`btn btn-p flex-1 flex items-center justify-center gap-1.5 font-bold ${
              submitting || !addressComplete ? "opacity-50 cursor-not-allowed" : ""
            }`}
            style={{ height: 44 }}
          >
            Proceed to Payment ({total})
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  // Render S8 Payment (Step 7)
  const renderS8Payment = () => {
    const payableAmount = quoteDetails?.total ? F_Paise(quoteDetails.total) : F(380000);
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h3 className="text-sm font-bold text-white/95">Secure Payment Checkout</h3>
          <p className="fine text-white/50 mt-1 leading-relaxed">
            Verify payment details. Weekly billing creates a secure Autopay mandate.
          </p>
        </div>

        <div className="card flex justify-between items-center border border-white/5" style={{ background: "var(--tnm-surface-ink-2)" }}>
          <span className="text-xs text-white/80 font-semibold">Payable Today</span>
          <span className="tnm-data text-lg font-bold text-[var(--tnm-action)] font-mono">{payableAmount}</span>
        </div>

        {/* UPI Autopay mandate details - weekly/bi-weekly plans ONLY, trials and prepaid monthly plans bypass it */}
        {!isTrial && activeCadence !== "monthly" && (
          <div className="card bg-white/[0.01] border border-white/5 p-4 rounded-xl flex flex-col gap-3">
            <h4 className="text-xs font-bold text-white/90 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[var(--tnm-action)]" />
              UPI Autopay Mandate Details
            </h4>
            <div className="flex flex-col gap-2 text-xs text-white/60">
              <div className="flex justify-between">
                <span>Maximum Authorization:</span>
                <span className="tnm-data font-semibold text-white/95">Up to {payableAmount}/week</span>
              </div>
              <div className="flex justify-between">
                <span>First Debit Date:</span>
                <span className="tnm-data font-mono text-white/95">{firstDeliveryLabel}</span>
              </div>
              <div className="flex justify-between">
                <span>Mandate Expiry:</span>
                <span className="tnm-data font-mono text-white/95">At protocol end ({cycleWeeks} weeks)</span>
              </div>
            </div>
            <p className="text-[10px] text-white/45 mt-1 leading-snug">
              Charges occur ONLY for unfulfilled weeks. Mandates are securely managed through Razorpay. Setup is free.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 mt-4">
          <button
            type="button"
            disabled={submitting}
            onClick={submit}
            className="btn btn-p w-full flex items-center justify-center gap-2 font-bold"
            style={{ height: 48 }}
          >
            <CreditCard className="w-4 h-4" />
            {submitting ? "Processing secure payment..." : `Pay ${payableAmount} and Start Monday`}
          </button>

          <button
            type="button"
            onClick={() => goToStep(6)}
            className="btn btn-s btn-blk text-xs font-semibold"
            style={{ height: 40 }}
          >
            Edit plan options
          </button>
        </div>
      </div>
    );
  };

  // Render Success Screen (Step 8) - No confetti, clean 280ms anim
  const renderSuccess = () => {
    const paidVal = quoteDetails?.total ? F_Paise(quoteDetails.total) : F(380000);
    return (
      <div className="flex flex-col items-center text-center gap-6 py-12 px-4">
        {/* Animate-in subtle checkmark icon (sage-tinted) */}
        <div className="w-20 h-20 rounded-full bg-[var(--tnm-sage)]/10 flex items-center justify-center border border-[var(--tnm-sage)]/20 animate-scale-up">
          <CheckCircle className="w-12 h-12 text-[var(--tnm-sage)] animate-fade-in" weight="fill" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-white/90">Metabolic Protocol Activated</h2>
          <p className="fine text-white/50 mt-1.5 leading-relaxed">
            Your clinical subscription order was created successfully.
          </p>
        </div>

        {/* Transaction details block */}
        <div className="card w-full flex flex-col gap-3 text-left border border-white/5" style={{ background: "var(--tnm-surface-ink-2)" }}>
          <div className="flex justify-between text-xs border-b border-white/5 pb-2">
            <span className="text-white/45">Order Reference ID:</span>
            <span className="tnm-data text-white/90 font-bold">{successOrderId || "sub-228392"}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/45">Amount Paid Today:</span>
            <span className="tnm-data text-[var(--tnm-action)] font-bold">{paidVal}</span>
          </div>
          {!isTrial && (
            <div className="flex justify-between text-xs">
              <span className="text-white/45">Next Renewal Charge:</span>
              <span className="tnm-data text-white/80">{paidVal}</span>
            </div>
          )}
          <div className="flex justify-between text-xs border-t border-white/5 pt-2 mt-1">
            <span className="text-white/45">First delivery dispatch:</span>
            <span className="font-medium text-white/90">{firstDeliveryLabel} &bull; {deliveryWindow}</span>
          </div>
        </div>

        {/* Address block with Change trigger */}
        <div className="card w-full text-left bg-white/[0.01] border border-white/5 p-4 rounded-xl flex justify-between items-start">
          <div className="min-w-0 flex-1 pr-3">
            <span className="text-[10px] text-white/45 uppercase tracking-wider font-bold">Delivery Address</span>
            <p className="text-xs text-white/80 mt-1 leading-relaxed">{address.line}</p>
            <p className="tnm-data text-[11px] text-white/50 mt-0.5">Contact: {address.phone}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              goToStep(6); // Return to review to update fields
              toast.info("Update contact or street details in the details card.");
            }}
            className="text-xs text-[var(--tnm-action)] font-bold uppercase tracking-wider"
          >
            [Change]
          </button>
        </div>

        {/* Dietitian onboarding consultation module */}
        <div className="card w-full bg-[var(--tnm-action)]/5 border border-[var(--tnm-action)]/20 p-4 rounded-xl text-left flex flex-col gap-3">
          <h4 className="text-xs font-bold text-white/90">Complete Dietitian Intake Check-In</h4>
          <p className="fine text-white/60 leading-relaxed">
            As a subscriber, you get a free 1-on-1 metabolic onboarding session with our Lead Dietitian to review recipes.
          </p>
          <Link
            to="/rd/rd-anjali-nair"
            className="btn btn-s btn-p text-xs font-bold w-full flex items-center justify-center gap-1.5"
            style={{ height: 38 }}
          >
            Book Onboarding Consultation
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <Link to="/subscriptions" className="btn btn-g w-full mt-6" style={{ height: 44 }}>
          Open My Subscriptions Dashboard
        </Link>
      </div>
    );
  };

  return (
    <div className="tnm2 min-h-screen bg-[var(--tnm-surface-ink)] text-white select-none">
      <div className="max-w-[480px] mx-auto min-h-screen flex flex-col pb-24">
        {/* Stepper App Header */}
        <div className="appbar shrink-0">
          {step > 0 && step < 8 ? (
            <button className="iconbtn" onClick={() => setStep(step - 1)} aria-label="Previous step">
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <Link className="iconbtn" to="/plans" aria-label="Back to plans">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          )}
          <div className="abt">
            {step === 8
              ? "Checkout Confirmed"
              : isTrial
              ? `Trial Checkout — Step ${step}`
              : `Subscription Stepper — Step ${step + 1}`}
          </div>
        </div>

        <div className="content padx flex-1 pt-4">
          {step === 0 && renderS1Recommendation()}
          {step === 1 && renderS2Frequency()}
          {step === 2 && renderS3Duration()}
          {step === 3 && renderS4Billing()}
          {step === 4 && renderS5Schedule()}
          {step === 5 && renderS6Preview()}
          {step === 6 && renderS7Review()}
          {step === 7 && renderS8Payment()}
          {step === 8 && renderSuccess()}
        </div>

        {/* Swap sheet modal overlay */}
        {swapSheet !== null && (
          <div
            className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center"
            onClick={() => setSwapSheet(null)}
          >
            <div
              className="card w-full max-w-[480px] rounded-t-2xl overflow-y-auto max-h-[75vh] border-t border-white/10"
              style={{ background: "var(--tnm-surface-ink-2)", paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-[var(--tnm-action)]">
                    Swap Rotation Dish
                  </span>
                  <h4 className="text-sm font-bold text-white/95 mt-0.5">
                    Alternative options for {swapSheet.dateLabel}
                  </h4>
                </div>
                <button
                  onClick={() => setSwapSheet(null)}
                  className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white"
                >
                  &times;
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {swapAlternatives.map((d) => (
                  <button
                    key={d.slug}
                    onClick={() => applySwap(d)}
                    className="w-full flex items-center gap-3 p-2 bg-white/[0.01] hover:bg-white/5 border border-white/5 rounded-xl text-left"
                  >
                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-white/10 bg-white/5">
                      <img src={d.image} alt={d.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="text-xs font-bold text-white/90 truncate">{d.name}</h5>
                      <p className="tnm-data text-[10px] text-white/45 font-mono mt-0.5">
                        {d.macros?.calories || "—"} kcal &bull; {d.macros?.protein || "—"}g protein
                      </p>
                    </div>
                    <span className="text-[9px] uppercase font-bold text-[var(--tnm-action)] bg-[var(--tnm-action)]/10 px-1.5 py-0.5 rounded shrink-0">
                      Select
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Global StickyBottomBar integration (Step-locked wizard modes) */}
      {step < 8 && (
        <StickyBottomBar
          context="builder"
          step={step}
          planSummaryText={
            step === 0
              ? "Recommended starting protocol"
              : step === 1
              ? `${weekMeals} meals configured`
              : step === 2
              ? `Duration commitment setup`
              : step === 3
              ? `Billing selection interval`
              : step === 4
              ? `Delivery starting ${firstDeliveryLabel}`
              : step === 5
              ? `Review meal customizations`
              : `Payable details checklist`
          }
          pricePaise={quoteDetails?.total || undefined}
          ctaText={
            step === 0
              ? "Build plan"
              : step === 6
              ? `Pay & start`
              : "Continue"
          }
          onContinue={() => {
            if (step === 0) setStep(1);
            else if (step === 1) setStep(2);
            else if (step === 2) setStep(3);
            else if (step === 3) setStep(4);
            else if (step === 4) setStep(5);
            else if (step === 5) setStep(6);
            else if (step === 6) setStep(7);
            else if (step === 7) submit();
          }}
          disabled={
            (step === 1 && weekMeals < 3) ||
            (step === 3 && !selectedBillingCadence) ||
            (step === 4 && pincodeCheck.state !== "serviceable") ||
            (step === 6 && !addressComplete)
          }
          loading={submitting}
        />
      )}
    </div>
  );
}
