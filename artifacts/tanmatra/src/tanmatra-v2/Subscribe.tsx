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

// Flat plan rate per meal — matches the server's PER_MEAL_PAISE exactly so
// the price on this page is the price Razorpay charges, to the paisa.
const PER_MEAL_PAISE = 26000;
const CADENCE_DISCOUNT_PCT: Record<SubscriptionCadence, number> = {
  weekly: 5,
  fortnightly: 10,
  monthly: 15,
};
// Billing cycles in weeks — the weekly menu pattern repeats each week
// inside longer cycles ("monthly" bills every 4 weeks, never 30 days,
// so day-of-week plans can't drift).
const CYCLE_WEEKS: Record<SubscriptionCadence, number> = {
  weekly: 1,
  fortnightly: 2,
  monthly: 4,
};
// Honest copy: there is no recurring billing mandate — only the first
// cycle is charged up front; renewal is a manual one-tap action.
const CADENCE_BILLING_COPY: Record<SubscriptionCadence, string> = {
  weekly: "Prepaid week — renew in one tap",
  fortnightly: "Prepaid 2 weeks — renew in one tap",
  monthly: "Prepaid 4 weeks — renew in one tap",
};

type MealSlot = "breakfast" | "lunch" | "dinner";
const SLOT_ORDER: MealSlot[] = ["breakfast", "lunch", "dinner"];
const SLOT_META: Record<MealSlot, { label: string; icon: string }> = {
  breakfast: { label: "Breakfast", icon: "ph-sun-horizon" },
  lunch: { label: "Lunch", icon: "ph-sun" },
  dinner: { label: "Dinner", icon: "ph-moon-stars" },
};

type DaysMode = "everyday" | "weekdays";

// Landing-card entries (?protocol=…) map to a real RD rotation preset so
// the card's promise opens as an actual, editable week — not an empty form.
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
  const { orders } = useOrders();
  const [policyModal, setPolicyModal] = useState<"pause" | "swap" | null>(null);

  const planSlug = searchParams.get("plan");
  const directPlan = planSlug ? getRdPlanBySlug(planSlug) : undefined;
  // Trial mode: either the D2C `?trial=1` entry or the legacy RD trial slug.
  const isTrial =
    searchParams.get("trial") === "1" ||
    directPlan?.slug === "three-day-trial-pack";
  const fromCart = searchParams.get("fromCart") === "1";
  const protocolParam = searchParams.get("protocol");
  const protocolPreset =
    !directPlan && !isTrial && protocolParam && protocolParam in PROTOCOL_PRESETS
      ? PROTOCOL_PRESETS[protocolParam]
      : null;

  // Every plan entry resolves to a real RD rotation. Only the cart hand-off
  // is item-based (no day mapping).
  const effectivePlan: RdPlan | undefined =
    directPlan ??
    (protocolPreset ? getRdPlanBySlug(protocolPreset.planSlug) : undefined) ??
    (isTrial ? getRdPlanBySlug("three-day-trial-pack") : undefined);

  const rdAuthor = effectivePlan ? getRdAuthor(effectivePlan) : undefined;
  const { preferences, update } = usePreferences();
  const cartItems = useCartStore((s) => s.items);
  // Live catalog for swap suggestions — a dish an ops/RD editor has 86'd
  // since deploy must never be auto-swapped in or offered on the swap sheet.
  const { dishes: catalogDishes } = useMenuCatalog();

  // Bare entry (no plan, no trial, no cart hand-off, no protocol preset):
  // show the goal-first chooser; picking a plan sets ?plan=<slug> and flows
  // into the day-first configurator below.
  const showChooser = !effectivePlan && !fromCart;

  // ---- Step 1 state: meal slots + days per week --------------------------
  const slotsParam = searchParams.get("slots");
  const initialSlots = useMemo(() => {
    if (slotsParam) {
      const split = slotsParam.split(",");
      return {
        breakfast: split.includes("breakfast"),
        lunch: split.includes("lunch"),
        dinner: split.includes("dinner"),
      };
    }
    return protocolPreset?.slots ??
      (isTrial
        ? { breakfast: true, lunch: true, dinner: true }
        : { breakfast: false, lunch: true, dinner: true });
  }, [slotsParam, protocolPreset, isTrial]);

  const daysModeParam = searchParams.get("daysMode");
  const initialDaysMode = (daysModeParam === "weekdays" || daysModeParam === "everyday")
    ? daysModeParam
    : (protocolPreset?.daysMode ?? "everyday");

  const [slots, setSlots] = useState<Record<MealSlot, boolean>>(initialSlots);
  const [daysMode, setDaysMode] = useState<DaysMode>(initialDaysMode);
  // User dish swaps, keyed by `${rotationIdx}:${slot}` → replacement slug.
  const [swaps, setSwaps] = useState<Record<string, string>>({});
  const [swapSheet, setSwapSheet] = useState<{
    rotationIdx: number;
    slot: MealSlot;
    current: DishData;
    dateLabel: string;
  } | null>(null);

  const cadenceParam = searchParams.get("cadence");
  const initialCadence: SubscriptionCadence =
    cadenceParam === "weekly" ||
    cadenceParam === "fortnightly" ||
    cadenceParam === "monthly"
      ? cadenceParam
      : "weekly";
  const [cadence, setCadence] = useState<SubscriptionCadence>(initialCadence);
  const [deliveryWindow, setDeliveryWindow] = useState(TIME_WINDOWS[1]);
  const [startDate, setStartDate] = useState(() => {
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

  // ---- Derived: the actual week, day by day ------------------------------
  const resolvedWeek = useMemo(
    () => (effectivePlan ? resolvePlanWeek(effectivePlan) : []),
    [effectivePlan],
  );

  const daysCount = isTrial ? Math.min(3, resolvedWeek.length || 3) : daysMode === "weekdays" ? 5 : 7;

  // Parse the date-only string as UTC midnight (same as the server's
  // "today or later" check) so picking today never fails in IST.
  const startDateObj = useMemo(() => {
    const d = new Date(startDate);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }, [startDate]);

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

  const cycleWeeks = isTrial ? 1 : CYCLE_WEEKS[cadence];
  // Day-first plans repeat the week across the cycle; the cart hand-off is
  // one drop per cycle, so its meal count doesn't scale with cadence.
  const cycleMeals = effectivePlan ? weekMeals * cycleWeeks : weekMeals;

  // Price mirrors the server formula exactly (see routes/subscriptions.ts).
  const cyclePrice = isTrial
    ? Math.round(cycleMeals * PER_MEAL_PAISE * 0.75)
    : Math.round(cycleMeals * PER_MEAL_PAISE * (1 - CADENCE_DISCOUNT_PCT[cadence] / 100));
  const trialListPrice = Math.round(cycleMeals * PER_MEAL_PAISE);
  const weekPrice = cycleWeeks > 0 ? Math.round(cyclePrice / cycleWeeks) : cyclePrice;

  // Honest daily-energy readout: only sum verified macros; flag partials.
  const kcalInfo = useMemo(() => {
    if (schedule.length === 0) return null;
    let sum = 0;
    let daysWithReal = 0;
    let anyProvisional = false;
    for (const day of schedule) {
      let daySum = 0;
      let allReal = day.meals.length > 0;
      for (const m of day.meals) {
        if (macrosAreProvisional(m.dish)) {
          anyProvisional = true;
          allReal = false;
        } else {
          daySum += m.dish.macros?.calories ?? 0;
        }
      }
      if (allReal) {
        sum += daySum;
        daysWithReal += 1;
      }
    }
    if (daysWithReal === 0) return { avg: null as number | null, anyProvisional };
    return { avg: Math.round(sum / daysWithReal), anyProvisional };
  }, [schedule]);

  const firstDeliveryLabel = schedule.length > 0 ? DATE_FMT.format(schedule[0].date) : DATE_FMT.format(startDateObj);

  // Swap-sheet alternatives: same category, in stock, safe for saved prefs.
  const swapAlternatives = useMemo(() => {
    if (!swapSheet) return [];
    return catalogDishes.filter(
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

  // Returning customers shouldn't retype an address they've already saved —
  // prefill from the default saved address once, leaving edits untouched.
  useEffect(() => {
    let alive = true;
    addressesApi
      .list()
      .then((r) => {
        if (!alive || r.addresses.length === 0) return;
        const def = r.addresses.find((a) => a.isDefault) ?? r.addresses[0];
        setAddress((prev) => {
          if (prev.line.trim()) return prev; // user already typed something
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
      .catch(() => {
        // guest / unauthenticated — they'll type it in
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (preferences?.allergens && preferences.allergens.length > 0) {
      setMembers((prev) => {
        const first = prev[0] || blankMember();
        const merged = Array.from(new Set([...first.allergens, ...preferences.allergens]));
        if (merged.length === first.allergens.length) return prev;
        return [{ ...first, allergens: merged }, ...prev.slice(1)];
      });
    }
  }, [preferences?.allergens]);

  const updateMember = (idx: number, patch: Partial<MemberDraft>) => {
    setMembers((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)),
    );
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
        return {
          ...m,
          allergens: nextAllergens,
        };
      }),
    );
  };
  const addMember = () => setMembers((p) => [...p, blankMember()]);
  const removeMember = (idx: number) =>
    setMembers((p) => p.filter((_, i) => i !== idx));

  // Bring the offending card into view instead of leaving the user at a
  // sticky summary with only a toast to explain the failed click.
  const scrollToCard = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const pincodeCheck = useMemo(() => checkPincode(address.pincode), [address.pincode]);

  useEffect(() => {
    if (pincodeCheck.state === "unserviceable") {
      track("pincode_unserviceable", { pincode: address.pincode });
    }
    if (pincodeCheck.state === "serviceable" && !address.city.trim()) {
      setAddress((prev) => ({ ...prev, city: pincodeCheck.info.city }));
    }
  }, [pincodeCheck, address.city]);

  const isPincodeValid = pincodeCheck.state === "serviceable" || (address.pincode.trim().length === 6 && pincodeCheck.state !== "unserviceable");
  const addressComplete = Boolean(
    address.line.trim() &&
    address.phone.trim() &&
    address.pincode.trim() &&
    isPincodeValid
  );
  const eatersComplete = members.every((m) => m.name.trim());

  const applySwap = (dish: DishData) => {
    if (!swapSheet) return;
    setSwaps((prev) => ({
      ...prev,
      [`${swapSheet.rotationIdx}:${swapSheet.slot}`]: dish.slug,
    }));
    track("plan_dish_swapped", {
      plan: effectivePlan?.slug,
      slot: swapSheet.slot,
      from: swapSheet.current.slug,
      to: dish.slug,
    });
    toast.success(`${SLOT_META[swapSheet.slot].label} swapped to ${dish.name}`, {
      description: "Applies to this day every week.",
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
    if (!eatersComplete) {
      toast.error("Please name every eater");
      scrollToCard("sub-eaters");
      return;
    }
    if (!address.line.trim() || !address.phone.trim() || !address.pincode.trim()) {
      toast.error("Delivery address line, phone, and PIN code are required");
      scrollToCard("sub-address");
      return;
    }
    if (pincodeCheck.state === "unserviceable") {
      toast.error("PIN code currently unserviceable", {
        description: `We do not currently serve PIN code ${address.pincode} for subscription delivery.`,
      });
      scrollToCard("sub-address");
      return;
    }
    if (weekMeals === 0) {
      toast.error("Your plan has no meals — add a meal slot or pick dishes");
      return;
    }
    setSubmitting(true);
    try {
      // Day-first payload: the week pattern expands across the billing
      // cycle so every delivery day is explicit and dated.
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
        // Aggregated week list (with true quantities) for backward compat.
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
        cadence: isTrial ? "weekly" : cadence,
        mealsPerDelivery: cycleMeals,
        deliveryWindow,
        startDate: startDateObj.toISOString(),
        planType: isTrial ? "trial" : "standard",
        addressLabel: address.label,
        addressLine: address.line,
        city: address.city,
        pincode: address.pincode,
        phone: address.phone,
        notes: [
          effectivePlan ? `RD Plan: ${effectivePlan.name}` : undefined,
          searchParams.get("duration") ? `Duration: ${searchParams.get("duration")} weeks` : undefined,
        ].filter(Boolean).join(" · ") || undefined,
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

      // Collect payment for the first delivery (or the one-off trial pack)
      // before celebrating. The subscription row already exists so we can
      // roll it back cleanly if the customer dismisses the modal — no
      // half-activated unpaid plans. When the gateway isn't configured
      // (local/dev builds) we keep today's activate-now behaviour.
      const amountDue = result.subscription.pricePerDeliveryPaise;
      if (razorpayConfigured() && amountDue > 0) {
        const outcome = await payWithRazorpay({
          amountPaise: amountDue,
          receipt: `sub-${result.subscription.id}`,
          description: isTrial
            ? "Tanmatra 3-Day Trial Pack"
            : `Tanmatra ${CADENCE_LABEL[cadence]} plan — first cycle`,
          contact: address.phone,
        });
        if (outcome === "cancelled") {
          await subscriptionsApi
            .cancel(result.subscription.id)
            .catch(() => undefined);
          toast.info("Payment not completed — plan not activated", {
            description: "Your details are saved on this page. Try again whenever you're ready.",
          });
          setSubmitting(false);
          return;
        }
        if (outcome === "unavailable") {
          toast.warning(
            "Payment gateway unavailable — plan activated, payment will be collected on delivery.",
          );
        }
      }

      if (fromCart) {
        useCartStore.getState().clear();
      }

      track("subscription_activated", {
        planType: isTrial ? "trial" : "standard",
        cadence,
        amountPaise: amountDue,
        mealsPerWeek: weekMeals,
        dayFirst: Boolean(dayPlan),
      });
      toast.success(isTrial ? "Trial started" : "Subscription activated", {
        description: `First delivery: ${new Date(result.subscription.nextDeliveryAt).toLocaleDateString()}`,
      });
      navigate("/subscriptions");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message === "unauthorized") {
        toast.error("Please sign in to subscribe");
        navigate("/login?next=/subscribe");
      } else {
        toast.error("Could not create subscription", { description: message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isMounted) {
    return (
      <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "72px 20px", textAlign: "center" }}>
          <h1>Subscribe</h1>
          <div style={{ marginTop: 24 }}>
            <Link to="/menu" className="btn btn-p opacity-50 pointer-events-none">Browse Menu</Link>
          </div>
        </div>
      </div>
    );
  }

  const activeSlotCount = SLOT_ORDER.filter((s) => slots[s]).length;

  return (
    <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="appbar">
          <Link
            className="iconbtn"
            to="/plans"
            aria-label="Back to plans"
          >
            <i className="ph-bold ph-arrow-left" />
          </Link>
          <div className="abt">
            {isTrial
              ? "Start your 3-day trial"
              : showChooser
                ? "Choose your plan"
                : "Build your week"}
          </div>
        </div>

        <div className="content padx" style={{ paddingTop: 4 }}>
          {showChooser ? (
            <GoalPlanChooser
              preferences={preferences}
              onSelect={(slug) => {
                track("plan_selected", { plan: slug });
                const next = new URLSearchParams(searchParams);
                next.set("plan", slug);
                setSearchParams(next);
              }}
            />
          ) : (
          <>
          {/* Plan identity */}
          {effectivePlan && (
            <div className="card mb16" style={{ background: "var(--safd)", borderColor: "var(--saf)" }}>
              <div className="fx gap12" style={{ alignItems: "flex-start" }}>
                <div className="dic" style={{ background: "var(--safd)", color: "var(--safb)" }}>
                  <i className="ph-bold ph-stethoscope" />
                </div>
                <div className="f1" style={{ minWidth: 0 }}>
                  <div className="fx wrap ac gap8">
                    <span className="h2" style={{ color: "var(--text-primary)" }}>{effectivePlan.name}</span>
                    {effectivePlan.badges.slice(0, 2).map((b) => (
                      <span key={b} className="pill" style={{ background: "var(--safd)", color: "var(--safb)" }}>
                        {b}
                      </span>
                    ))}
                  </div>
                  <p className="mono mt6 safc" style={{ fontSize: 11 }}>
                    Plan target: {effectivePlan.calorieTargetPerDay} kcal/day across 3 meals · {effectivePlan.proteinTargetGrams}g protein
                  </p>
                  <p className="fine mt4">
                    {protocolPreset
                      ? protocolPreset.blurb
                      : effectivePlan.tagline}
                  </p>
                  {rdAuthor && (
                    <p className="fine mt4" style={{ fontSize: 11 }}>
                      By{" "}
                      <Link
                        to={`/team/${rdAuthor.slug}`}
                        className={`${ACCENT_CLASSES[rdAuthor.accent].text}`}
                        style={{ textDecoration: "underline" }}
                      >
                        {rdAuthor.name}, RD
                      </Link>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {fromCart && !effectivePlan && (
            <div className="card mb16" style={{ background: "var(--safd)", borderColor: "var(--saf)" }}>
              <div className="fx ac gap12">
                <div className="dic" style={{ background: "var(--safd)", color: "var(--safb)" }}>
                  <i className="ph-bold ph-basket" />
                </div>
                <div className="f1">
                  <p className="tt" style={{ color: "var(--text-primary)" }}>Repeat your cart weekly</p>
                  <p className="fine mt2">
                    {weekMeals} meal{weekMeals === 1 ? "" : "s"} from your cart, delivered on your schedule below.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 1 — shape the week */}
          {effectivePlan && (
            <div className="card mb16">
              <div className="lab fx ac gap8 mb12">
                <i className="ph-bold ph-fork-knife safc" /> Step 1 — Your rhythm
              </div>
              <div className="lab mb8">Meals each day</div>
              <div className="fx gap8 mb14">
                {SLOT_ORDER.map((slot) => {
                  const on = slots[slot];
                  return (
                    <button
                      key={slot}
                      onClick={() => toggleSlot(slot)}
                      className={on ? "chip on f1" : "chip f1"}
                      style={{ justifyContent: "center" }}
                    >
                      <i className={`ph-bold ${SLOT_META[slot].icon}`} />
                      {SLOT_META[slot].label}
                    </button>
                  );
                })}
              </div>
              {!isTrial && (
                <>
                  <div className="lab mb8">Days each week</div>
                  <div className="fx gap8">
                    <button
                      onClick={() => setDaysMode("everyday")}
                      className={daysMode === "everyday" ? "chip on f1" : "chip f1"}
                      style={{ justifyContent: "center" }}
                    >
                      Every day · 7
                    </button>
                    <button
                      onClick={() => setDaysMode("weekdays")}
                      className={daysMode === "weekdays" ? "chip on f1" : "chip f1"}
                      style={{ justifyContent: "center" }}
                    >
                      Weekdays · 5
                    </button>
                  </div>
                </>
              )}
              <div className="fx ac jb mt12" style={{ paddingTop: 10, borderTop: "1px solid var(--ln)" }}>
                <span className="fine">
                  {isTrial
                    ? `${daysCount} days × ${activeSlotCount} meal${activeSlotCount === 1 ? "" : "s"}`
                    : `${daysCount} days × ${activeSlotCount} meal${activeSlotCount === 1 ? "" : "s"}/day`}
                </span>
                <span className="mono safc" style={{ fontSize: 12, fontWeight: 600 }}>
                  {weekMeals} meals{isTrial ? "" : " a week"}
                </span>
              </div>
              {kcalInfo && activeSlotCount < 3 && kcalInfo.avg !== null && (
                <p className="fine mt6" style={{ fontSize: 11 }}>
                  Covers ~{kcalInfo.avg} kcal of the plan's {effectivePlan.calorieTargetPerDay} kcal/day target — the rest is on your own table.
                </p>
              )}
            </div>
          )}

          {/* Step 2 — start date + window */}
          <div className="card mb16">
            <div className="lab fx ac gap8 mb12">
              <i className="ph-bold ph-calendar-dots safc" /> Step 2 — Start & delivery
            </div>
            <div className="fx wrap gap12">
              <div className="f1" style={{ minWidth: 150 }}>
                <div className="lab mb8">First delivery</div>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="inp"
                />
              </div>
            </div>
            <div className="mt12">
              <div className="fx wrap ac jb gap8 mb8">
                <span className="lab fx ac g6">
                  <i className="ph-bold ph-clock" /> Delivery window
                </span>
                {pincodeCheck.state === "serviceable" ? (
                  <span className="fine sagec fw6" style={{ fontSize: 10 }}>
                    ✓ Slot guaranteed in {pincodeCheck.info.city}
                  </span>
                ) : pincodeCheck.state === "unserviceable" ? (
                  <span className="fine dgrc fw6" style={{ fontSize: 10 }}>
                    ⚠️ Slot restricted for PIN {address.pincode}
                  </span>
                ) : null}
              </div>
              <div className="fx wrap gap8">
                {TIME_WINDOWS.map((w) => (
                  <button
                    key={w}
                    onClick={() => setDeliveryWindow(w)}
                    className={deliveryWindow === w ? "chip on" : "chip"}
                  >
                    {w}
                  </button>
                ))}
              </div>
              <p className="fine mt8" style={{ fontSize: 11 }}>
                Each delivery day, that day's meals arrive together in one chilled drop within this window.
              </p>
            </div>
          </div>

          {/* Step 3 — the actual week, day by day */}
          {effectivePlan && schedule.length > 0 && (
            <div className="card mb16">
              <div className="fx ac jb mb4">
                <span className="lab fx ac gap8">
                  <i className="ph-bold ph-calendar-check safc" /> Step 3 — Your {schedule.length} days
                </span>
                {!isTrial && (
                  <span className="fine" style={{ fontSize: 10 }}>
                    repeats weekly
                  </span>
                )}
              </div>
              {(autoSwapCount > 0 || droppedCount > 0) && (
                <p className="fine mb8" style={{ fontSize: 11 }}>
                  {autoSwapCount > 0 && (
                    <span className="sagec">{autoSwapCount} dish{autoSwapCount === 1 ? "" : "es"} auto-swapped for your allergens & dislikes.</span>
                  )}
                  {droppedCount > 0 && (
                    <> {droppedCount} meal{droppedCount === 1 ? "" : "s"} skipped — no safe match; pick one via Swap.</>
                  )}
                </p>
              )}
              <div className="mt8">
                {schedule.map((day, idx) => (
                  <div key={idx} className="dcard" style={{ marginBottom: 10 }}>
                    <div className="fx ac jb mb10">
                      <span className="lab safc" style={{ background: "var(--safd)", padding: "3px 8px", borderRadius: 6 }}>
                        Day {idx + 1} · {DATE_FMT.format(day.date)}
                      </span>
                      <span className="mono fntc" style={{ fontSize: 10 }}>
                        {day.meals.length} meal{day.meals.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    {day.meals.map((m) => (
                      <div key={m.slot} className="fx ac gap10" style={{ padding: "7px 0", borderTop: "1px solid var(--ln)" }}>
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 9,
                            flex: "none",
                            overflow: "hidden",
                            position: "relative",
                            backgroundImage: m.dish.image ? `url(${m.dish.image})` : undefined,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            background: m.dish.image ? undefined : "var(--s2)",
                          }}
                        >
                          <span className={m.dish.isVeg ? "vd" : "vd nv"} style={{ position: "absolute", bottom: 3, left: 3 }} />
                        </div>
                        <div className="f1" style={{ minWidth: 0 }}>
                          <div className="fx ac gap6">
                            <span className="lab" style={{ fontSize: 8.5 }}>
                              <i className={`ph-bold ${SLOT_META[m.slot].icon}`} /> {SLOT_META[m.slot].label}
                            </span>
                            {m.autoSwapped && (
                              <span className="pill sg" style={{ fontSize: 9 }}>allergen-safe swap</span>
                            )}
                            {m.userSwapped && (
                              <span className="pill" style={{ fontSize: 9, background: "var(--safd)", color: "var(--safb)" }}>your pick</span>
                            )}
                          </div>
                          <p className="small clamp1 mt2" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                            {m.dish.name}
                          </p>
                          <p className="mono fntc" style={{ fontSize: 10 }}>
                            {macrosAreProvisional(m.dish)
                              ? "macros being verified"
                              : `${m.dish.macros?.calories ?? "—"} kcal · ${m.dish.macros?.protein ?? "—"}g protein`}
                          </p>
                        </div>
                        <div className="fx ac gap6" style={{ flex: "none" }}>
                          {m.userSwapped && (
                            <button
                              onClick={() => clearSwap(day.rotationIdx, m.slot)}
                              className="qbtn"
                              aria-label="Undo swap"
                              title="Back to the RD pick"
                            >
                              <i className="ph-bold ph-arrow-counter-clockwise" />
                            </button>
                          )}
                          <button
                            onClick={() =>
                              setSwapSheet({
                                rotationIdx: day.rotationIdx,
                                slot: m.slot,
                                current: m.dish,
                                dateLabel: DATE_FMT.format(day.date),
                              })
                            }
                            className="chip"
                            style={{ height: 30, fontSize: 11.5 }}
                          >
                            Swap
                          </button>
                        </div>
                      </div>
                    ))}
                    {day.droppedSlots.map((slot) => (
                      <div key={slot} className="fx ac gap10" style={{ padding: "7px 0", borderTop: "1px solid var(--ln)", opacity: 0.75 }}>
                        <div className="fx ac jc" style={{ width: 44, height: 44, borderRadius: 9, flex: "none", background: "var(--s2)", color: "var(--fnt)" }}>
                          <i className="ph-bold ph-warning" />
                        </div>
                        <div className="f1">
                          <span className="lab" style={{ fontSize: 8.5 }}>{SLOT_META[slot].label}</span>
                          <p className="fine mt2" style={{ fontSize: 11.5 }}>
                            No allergen-safe match in this rotation — pick your own.
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const rotationDish = resolvedWeek[day.rotationIdx]?.[slot];
                            if (rotationDish) {
                              setSwapSheet({
                                rotationIdx: day.rotationIdx,
                                slot,
                                current: rotationDish,
                                dateLabel: DATE_FMT.format(day.date),
                              });
                            }
                          }}
                          className="chip"
                          style={{ height: 30, fontSize: 11.5, flex: "none" }}
                        >
                          Pick
                        </button>
                      </div>
                    ))}
                    {day.rdTip && (
                      <p className="fine mt8" style={{ fontSize: 10.5, fontStyle: "italic", color: "var(--mut)" }}>
                        <i className="ph-bold ph-lightbulb safc" /> RD tip: {day.rdTip}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <p className="fine" style={{ fontSize: 10.5 }}>
                Flat plan rate: {F(PER_MEAL_PAISE)}/meal whichever dishes you pick. Swap any day up to 24h before its delivery — also later from My Plans.
              </p>
            </div>
          )}

          {/* Cart hand-off: show the actual items being repeated */}
          {fromCart && !effectivePlan && cartItems.length > 0 && (
            <div className="card mb16">
              <div className="lab fx ac gap8 mb10">
                <i className="ph-bold ph-basket safc" /> Your weekly items
              </div>
              {cartItems.map((ci) => (
                <div key={ci.dishId} className="fx ac gap10" style={{ padding: "7px 0", borderTop: "1px solid var(--ln)" }}>
                  <div
                    style={{
                      width: 40, height: 40, borderRadius: 8, flex: "none", overflow: "hidden",
                      backgroundImage: ci.image ? `url(${ci.image})` : undefined,
                      backgroundSize: "cover", backgroundPosition: "center",
                      background: ci.image ? undefined : "var(--s2)",
                    }}
                  />
                  <div className="f1" style={{ minWidth: 0 }}>
                    <p className="small clamp1" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{ci.name}</p>
                    <p className="mono fntc" style={{ fontSize: 10 }}>×{ci.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Step 4 — eaters */}
          <div id="sub-eaters" className="card mb16">
            <div className="fx ac jb mb12">
              <div className="lab fx ac gap8">
                <i className="ph-bold ph-users safc" /> Step {effectivePlan ? 4 : 3} — Who's eating?
              </div>
              <button
                onClick={addMember}
                className="chip"
              >
                <i className="ph-bold ph-plus" /> Add eater
              </button>
            </div>
            {members.map((m, idx) => (
              <div
                key={idx}
                className="mb12"
                style={{ border: "1px solid var(--ln)", borderRadius: 12, padding: 14 }}
              >
                <div className="fx ac jb gap8 mb12">
                  <input
                    placeholder="Member name"
                    value={m.name}
                    onChange={(e) => updateMember(idx, { name: e.target.value })}
                    className="inp"
                    style={{ maxWidth: 260 }}
                  />
                  {members.length > 1 && (
                    <button
                      onClick={() => removeMember(idx)}
                      className="qbtn"
                      aria-label="Remove eater"
                    >
                      <i className="ph-bold ph-x" />
                    </button>
                  )}
                </div>
                <div className="fx wrap gap12 mb12">
                  <div className="f1" style={{ minWidth: 120 }}>
                    <div className="lab mb4">Diet</div>
                    <div className="fx g6">
                      {(["any", "veg", "nonveg"] as const).map((d) => (
                        <button
                          key={d}
                          onClick={() => updateMember(idx, { diet: d })}
                          className={m.diet === d ? "chip on f1 upper" : "chip f1 upper"}
                          style={{ justifyContent: "center", fontSize: 11 }}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="f1" style={{ minWidth: 120 }}>
                    <div className="lab mb4">Spice</div>
                    <div className="fx g6">
                      {(["mild", "medium", "hot"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => updateMember(idx, { spiceLevel: s })}
                          className={m.spiceLevel === s ? "chip on f1 upper" : "chip f1 upper"}
                          style={{ justifyContent: "center", fontSize: 11 }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="f1" style={{ minWidth: 120 }}>
                    <div className="lab mb4">Lifestyle</div>
                    <select
                      value={m.lifestyle}
                      onChange={(e) => updateMember(idx, { lifestyle: e.target.value })}
                      style={{
                        width: "100%",
                        height: 46,
                        borderRadius: 10,
                        background: "var(--s1)",
                        border: "1px solid var(--ln2)",
                        color: "var(--tx)",
                        padding: "0 12px",
                        fontSize: 14,
                      }}
                    >
                      {LIFESTYLES.map((l) => (
                        <option key={l.value} value={l.value}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <div className="lab mb8">Allergens to avoid</div>
                  <div className="fx wrap g6">
                    {COMMON_ALLERGENS.map((a) => {
                      const on = m.allergens.includes(a);
                      return (
                        <button
                          key={a}
                          onClick={() => toggleAllergen(idx, a)}
                          className={on ? "chip on" : "chip"}
                          style={on ? { borderColor: "var(--dgr)", color: "var(--dgr)", background: "color-mix(in oklab, var(--color-error) 14%, transparent)", textTransform: "capitalize" } : { textTransform: "capitalize" }}
                        >
                          {a}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Step 5 — address */}
          <div id="sub-address" className="card mb16">
            <div className="fx ac jb gap8 mb12">
              <div className="lab fx ac gap8">
                <i className="ph-bold ph-map-pin safc" />
                Step {effectivePlan ? 5 : 4} — Delivery Address
              </div>
              {addressPrefilled && (
                <span className="fine sagec fx ac g6" style={{ fontSize: 10 }}>
                  <i className="ph-bold ph-check" /> Filled from your saved address
                </span>
              )}
            </div>
            <div className="fx wrap gap12">
              <div className="f1" style={{ minWidth: 140 }}>
                <div className="lab mb4">Label</div>
                <input
                  value={address.label}
                  onChange={(e) => setAddress({ ...address, label: e.target.value })}
                  className="inp"
                />
              </div>
              <div className="f1" style={{ minWidth: 140 }}>
                <div className="lab mb4">Phone</div>
                <input
                  value={address.phone}
                  onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                  className="inp"
                />
              </div>
              <div style={{ width: "100%" }}>
                <div className="lab mb4">Address line</div>
                <input
                  value={address.line}
                  onChange={(e) => setAddress({ ...address, line: e.target.value })}
                  className="inp"
                />
              </div>
              <div className="f1" style={{ minWidth: 140 }}>
                <div className="lab mb4">City</div>
                <input
                  value={address.city}
                  onChange={(e) => setAddress({ ...address, city: e.target.value })}
                  className="inp"
                />
              </div>
              <div className="f1" style={{ minWidth: 140 }}>
                <div className="fx ac jb mb4">
                  <span className="lab">PIN code</span>
                  {pincodeCheck.state === "serviceable" && (
                    <span className="fine sagec fw5" style={{ fontSize: 10 }}>
                      ✓ {pincodeCheck.info.area}
                    </span>
                  )}
                </div>
                <input
                  value={address.pincode}
                  onChange={(e) => setAddress({ ...address, pincode: e.target.value })}
                  placeholder="201301"
                  maxLength={6}
                  className="inp"
                  style={
                    pincodeCheck.state === "unserviceable"
                      ? { borderColor: "var(--dgr)" }
                      : pincodeCheck.state === "serviceable"
                      ? { borderColor: "var(--sage)" }
                      : undefined
                  }
                />
                {pincodeCheck.state === "unserviceable" && (
                  <p className="fine dgrc fw5 mt4" style={{ fontSize: 11, lineHeight: 1.3 }}>
                    ⚠️ PIN code unserviceable for subscription delivery. Currently serving Noida, Delhi & Gurgaon & East Delhi.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Summary: billing choice lives next to the price it changes */}
          <div className="card mb16" style={{ background: "var(--safd)", borderColor: "var(--saf)" }}>
            {!isTrial && (
              <div className="mb12">
                <div className="lab mb8">Billing cycle</div>
                {(["weekly", "fortnightly", "monthly"] as const).map((c) => {
                  const active = cadence === c;
                  return (
                    <button
                      key={c}
                      onClick={() => setCadence(c)}
                      className={active ? "opt on" : "opt"}
                      style={{ flexDirection: "column", alignItems: "stretch" }}
                    >
                      <div className="fx ac jb w100">
                        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                          {CADENCE_LABEL[c]}
                        </span>
                        <span className="pill sg">Save {CADENCE_DISCOUNT_PCT[c]}%</span>
                      </div>
                      <span className="fine mt2">
                        {CADENCE_BILLING_COPY[c]} · your week repeats each cycle
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="fx wrap ac jb gap16">
              <div>
                <p className="lab">
                  {isTrial
                    ? `3-day sampler · ${weekMeals} meals · ${members.length} eater${members.length === 1 ? "" : "s"}`
                    : `${weekMeals} meals${effectivePlan ? "/week" : " per delivery"} · ${members.length} eater${members.length === 1 ? "" : "s"}`}
                </p>
                <p className="price safc mt4 fx" style={{ fontSize: 26, alignItems: "baseline", gap: 8 }}>
                  {F(cyclePrice)}
                  {isTrial ? (
                    <>
                      <span className="fntc strike" style={{ fontSize: 14, fontWeight: 400 }}>
                        {F(trialListPrice)}
                      </span>
                      <span className="lab sagec">
                        25% off
                      </span>
                    </>
                  ) : (
                    <span className="fntc" style={{ fontSize: 14, fontWeight: 400 }}>
                      {!effectivePlan ? " / delivery" : cadence === "weekly" ? " / week" : cadence === "fortnightly" ? " / 2 weeks" : " / 4 weeks"}
                    </span>
                  )}
                </p>
                {/* Price math — no surprises at the payment modal. */}
                <div className="mt6">
                  <p className="fine" style={{ fontSize: 10 }}>
                    {isTrial
                      ? `${weekMeals} meals × ${F(PER_MEAL_PAISE)} − 25% trial offer · one-off, does not auto-renew`
                      : `${cycleMeals} meals × ${F(PER_MEAL_PAISE)} − ${CADENCE_DISCOUNT_PCT[cadence]}% saving${effectivePlan && cycleWeeks > 1 ? ` (${F(weekPrice)}/week)` : ""}`}
                  </p>
                  <p className="fine mt2" style={{ fontSize: 10 }}>
                    📅 First delivery {firstDeliveryLabel} · {deliveryWindow}
                    {!isTrial && effectivePlan && (daysMode === "weekdays" ? " · then every weekday" : " · then daily")}
                  </p>
                  {!isTrial && (
                    <p className="fine mt2" style={{ fontSize: 10 }}>
                      Your cycle is prepaid. We'll remind you before it ends — renew in one tap from My Plans.
                    </p>
                  )}
                  <p className="fine sagec fw5 mt2" style={{ fontSize: 10 }}>
                    🚚 Delivery fee: FREE (included on all subscription plans)
                  </p>
                </div>
              </div>
              <div className="col ac" style={{ alignItems: "flex-end", gap: 6 }}>
                <button
                  onClick={submit}
                  disabled={submitting}
                  className={submitting ? "btn btn-p dis" : "btn btn-p"}
                >
                  {submitting
                    ? isTrial
                      ? "Starting…"
                      : "Activating…"
                    : isTrial
                      ? "Start 3-day trial"
                      : "Activate Subscription"}
                  <i className="ph-bold ph-caret-right" />
                </button>
                {!addressComplete && (
                  <button
                    type="button"
                    onClick={() => scrollToCard("sub-address")}
                    className="fine fntc"
                    style={{ fontSize: 10, textDecoration: "underline", textDecorationStyle: "dotted" }}
                  >
                    {pincodeCheck.state === "unserviceable"
                      ? "⚠️ PIN code unserviceable — update delivery PIN"
                      : !address.pincode.trim() || !address.line.trim() || !address.phone.trim()
                      ? "1 step left — complete delivery address & PIN code"
                      : "1 step left — verify delivery details"}
                  </button>
                )}
              </div>
            </div>
            <div className="fx wrap ac gap16 mt10" style={{ paddingTop: 10, borderTop: "1px solid color-mix(in oklab, var(--color-clinical-gold) 25%, transparent)" }}>
              <span className="fine fx ac g6" style={{ fontSize: 10 }}>
                <i className="ph-bold ph-shield-check safc" /> Secured by Razorpay
              </span>
              <button
                type="button"
                onClick={() => setPolicyModal("pause")}
                className="fine fx ac g6"
                style={{ fontSize: 10, textDecoration: "underline", textDecorationStyle: "dotted" }}
              >
                <i className="ph-bold ph-check sagec" /> Pause or cancel anytime ℹ️
              </button>
              <button
                type="button"
                onClick={() => setPolicyModal("swap")}
                className="fine fx ac g6"
                style={{ fontSize: 10, textDecoration: "underline", textDecorationStyle: "dotted" }}
              >
                <i className="ph-bold ph-check sagec" /> Swap any dish before it's cooked ℹ️
              </button>
            </div>
          </div>

          <MedicalDisclaimer compact />
          </>
          )}
        </div>

        {/* Swap sheet */}
        {swapSheet !== null && (
          <div
            className="tnm2 bg-black/60"
            style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
            onClick={() => setSwapSheet(null)}
          >
            <div
              className="card"
              style={{ maxWidth: 480, width: "100%", maxHeight: "72vh", overflowY: "auto", borderRadius: "16px 16px 0 0", paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="fx ac jb mb4">
                <div>
                  <p className="lab safc">{SLOT_META[swapSheet.slot].label} · {swapSheet.dateLabel}</p>
                  <p className="tt mt2" style={{ color: "var(--text-primary)" }}>
                    Swap “{swapSheet.current.name}”
                  </p>
                </div>
                <button className="qbtn" onClick={() => setSwapSheet(null)} aria-label="Close">
                  <i className="ph-bold ph-x" />
                </button>
              </div>
              <p className="fine mb10" style={{ fontSize: 11 }}>
                Same flat {F(PER_MEAL_PAISE)}/meal rate whichever you pick.{preferences ? " Only allergen-safe options are shown." : ""}
              </p>
              {swapAlternatives.length === 0 ? (
                <p className="fine" style={{ padding: "16px 0" }}>
                  No safe alternatives in this category right now — try adjusting allergens in Step {effectivePlan ? 4 : 3}, or keep the RD pick.
                </p>
              ) : (
                swapAlternatives.map((d) => (
                  <button
                    key={d.slug}
                    onClick={() => applySwap(d)}
                    className="fx ac gap10 w100"
                    style={{ padding: "9px 0", borderTop: "1px solid var(--ln)", textAlign: "left" }}
                  >
                    <div
                      style={{
                        width: 44, height: 44, borderRadius: 9, flex: "none", overflow: "hidden", position: "relative",
                        backgroundImage: d.image ? `url(${d.image})` : undefined,
                        backgroundSize: "cover", backgroundPosition: "center",
                        background: d.image ? undefined : "var(--s2)",
                      }}
                    >
                      <span className={d.isVeg ? "vd" : "vd nv"} style={{ position: "absolute", bottom: 3, left: 3 }} />
                    </div>
                    <div className="f1" style={{ minWidth: 0 }}>
                      <p className="small clamp1" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{d.name}</p>
                      <p className="mono fntc" style={{ fontSize: 10 }}>
                        {macrosAreProvisional(d)
                          ? "macros being verified"
                          : `${d.macros?.calories ?? "—"} kcal · ${d.macros?.protein ?? "—"}g protein`}
                      </p>
                    </div>
                    <i className="ph-bold ph-plus-circle safc" style={{ fontSize: 18, flex: "none" }} />
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {policyModal !== null && (
          <div
            className="tnm2 bg-black/60"
            style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
            onClick={() => setPolicyModal(null)}
          >
            <div className="card" style={{ maxWidth: 448, width: "100%" }} onClick={(e) => e.stopPropagation()}>
              <div className="tt fx ac gap8 safc">
                {policyModal === "pause" ? "⏸️ Pause & Cancellation Policy" : "🔀 Flexible Dish Swap Guarantee"}
              </div>
              <div className="fine mt6" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {policyModal === "pause" ? (
                  <>
                    <p style={{ color: "var(--tx)" }}>
                      <strong>Pause up to 8 weeks:</strong> Need to skip a delivery or going on a trip? You can pause your plan directly from the <em>My Plans</em> dashboard up to 24 hours before any scheduled delivery window. Your delivery schedule and remaining credits are frozen instantly.
                    </p>
                    <p style={{ color: "var(--tx)" }}>
                      <strong>Cancel anytime:</strong> If you cancel mid-cycle, any remaining unfulfilled full weeks are refunded within 7 business days or kept as wallet credit for future one-off orders.
                    </p>
                  </>
                ) : (
                  <>
                    <p style={{ color: "var(--tx)" }}>
                      <strong>Swap before kitchen cutoff:</strong> Don't fancy tomorrow's recipe? Up to 24 hours before your scheduled slot, click <em>Swap</em> on any upcoming delivery day to select any alternative RD-certified meal on our active rotation at zero extra charge.
                    </p>
                    <p style={{ color: "var(--tx)" }}>
                      <strong>Allergen auto-filtering:</strong> Our kitchen automatically excludes your saved allergens and preferences every week so your menu is 100% safe by default.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
