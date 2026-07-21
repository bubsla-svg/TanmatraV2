import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import { DISHES, type DishData } from "@workspace/menu-catalog";
import { useMenuCatalog } from "@/lib/menuData";
import { getRdPlanBySlug, getRdAuthor, resolvePlanWeek, findPlanSafeSwap, type RdPlan } from "@/lib/rdPlans";
import { evaluateDishForPreferences } from "@/lib/preferencesMatch";
import { usePreferences } from "@/lib/preferencesContext";
import { useCartStore } from "@/lib/cartContext";
import type { SubscriptionItem, SubscriptionDayPlanEntry } from "@/lib/subscriptionsApi";
import { payWithRazorpay, razorpayConfigured } from "@/lib/razorpayClient";
import { track } from "@/lib/analytics";
import { toast } from "sonner";
import { addressesApi } from "@/lib/userAddressesApi";
import {
  subscriptionsApi,
  CADENCE_LABEL,
  type SubscriptionCadence,
} from "@/lib/subscriptionsApi";
import {
  CADENCE_WEEKS as CYCLE_WEEKS,
  weeklyEquivalentPaise,
  cadenceBilledLabel,
} from "@/lib/subscriptionPricing";
import { blankMember, type MemberDraft } from "@/lib/memberDraft";
import {
  computeDeliveryPricePaise,
  computeTrialPricePaise,
  cadenceDiscountPct,
} from "@workspace/subscription-rules";
import { checkPincode } from "@/lib/serviceablePincodes";
import { useWizardState } from "@/lib/useWizardState";
import { LocationPickerFlow } from "@/components/location/LocationPickerFlow";
import GoalPlanChooser from "@/components/subscribe/GoalPlanChooser";
import { F } from "./data";
import MedicalDisclaimer from "@/components/v2/MedicalDisclaimer";
import StickyBottomBar from "@/components/layout/StickyBottomBar";
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Warning,
  CheckCircle,
  Info,
  CreditCard,
  MapPin,
} from "@phosphor-icons/react";

const TIME_WINDOWS = [
  "07:00 - 08:00",
  "12:00 - 13:00",
  "13:00 - 14:00",
  "19:00 - 20:00",
  "20:00 - 21:00",
];

// CYCLE_WEEKS (cadence → billed weeks) is a single source of truth in
// @/lib/subscriptionPricing, imported above under the same name.

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

// Human step titles for the plan-builder header — no dev-speak ("Stepper —
// Step 0"), so the buyer always knows where they are and what's next.
// Duration and billing cadence were the same axis (weekly/fortnightly/monthly),
// so the old 8-step flow made the buyer pick it twice. Merged into one
// "Choose your plan" step → 7 steps total, one cadence decision.
const STEP_TITLES = [
  "Your plan",
  "Meals per week",
  "Choose your plan",
  "Delivery schedule",
  "Week-1 preview",
  "Review order",
  "Payment",
] as const;

// Persist the in-progress subscription build so the browser Back button, a
// reload, or navigating away and returning does not wipe the buyer's config
// (State-Amnesia remediation). Scoped to the tab session; cleared on success.
// The plumbing now lives in the shared wizard contract (playbook R1):
// useWizardState owns the versioned sessionStorage key
// (`tanmatra:subscribe-draft:v1` — unchanged, in-flight drafts survive),
// the `?step=` URL mirroring, popstate back-walking and rehydration. This
// type lists the fields snapshotted into that draft (step is stored by the
// hook itself, alongside these).
const TRIAL_SLUG = "three-day-trial-pack";

type SubscribeDraft = {
  slots?: Record<MealSlot, boolean>;
  daysMode?: DaysMode;
  cadence?: SubscriptionCadence;
  selectedBillingCadence?: SubscriptionCadence | null;
  startDate?: string;
  address?: { label: string; line: string; city: string; pincode: string; phone: string };
  // The plan the draft's slots/daysMode were built on. Lets the basis-
  // adoption effect tell "user returning to the same plan with their own
  // customizations" (draft wins) apart from "stale draft from a different
  // plan/bare entry" (the plan's advertised basis wins).
  planSlug?: string;
};

export default function V2Subscribe() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Stepper step state — owned by the shared wizard contract (R1):
  // sessionStorage draft, `?step=` URL mirroring, popstate back-walking and
  // rehydrate-on-mount all live in useWizardState.
  // 0: S1 Recommendation
  // 1: S2 Frequency
  // 2: S3 Duration (plan + billing, merged)
  // 3: S5 Schedule
  // 4: S6 Week-1 Preview
  // 5: S7 Price Review
  // 6: S8 Payment
  // 7: Success Screen
  const wizard = useWizardState<SubscribeDraft>({
    flow: "subscribe",
    totalSteps: 8,
    initialDraft: {},
  });
  const step = wizard.step;

  const planSlug = searchParams.get("plan");
  const directPlan = planSlug ? getRdPlanBySlug(planSlug) : undefined;

  // Trial mode
  const [isTrial, setIsTrial] = useState(() => {
    return searchParams.get("trial") === "1" || directPlan?.slug === TRIAL_SLUG;
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
    (isTrial ? getRdPlanBySlug(TRIAL_SLUG) : undefined);

  const rdAuthor = effectivePlan ? getRdAuthor(effectivePlan) : undefined;
  const { preferences, update } = usePreferences();
  const cartItems = useCartStore((s) => s.items);
  const { dishes: catalogDishes } = useMenuCatalog();

  // Chooser gates EVERY plan-less entry, fromCart included: Cart's
  // "Subscribe to weekly delivery" link carries no ?plan=, and the old
  // `!fromCart` guard made renderS1Recommendation fall through both of its
  // branches — a completely blank step 0 behind Cart's own upsell link.
  const showChooser = !effectivePlan;

  // ---- Builder configs state ----
  // Seed the builder from the SAME basis the entry surface advertised.
  // Priority: explicit protocol preset → the plan's advertisedBasis (fixes
  // the ₹3,800-card → ₹10,474-wizard jump: ?plan= used to discard the
  // plan's meal basis and fall to a generic lunch+dinner × everyday = 14
  // meals default) → the canonical 3-meal trial → the legacy default.
  // Everything stays user-editable at step 1; only the STARTING point now
  // matches what the card quoted.
  const [slots, setSlots] = useState<Record<MealSlot, boolean>>(
    protocolPreset?.slots ??
      effectivePlan?.advertisedBasis?.slots ??
      (isTrial
        ? { breakfast: false, lunch: true, dinner: false }
        : { breakfast: false, lunch: true, dinner: true }),
  );
  const [daysMode, setDaysMode] = useState<DaysMode>(
    protocolPreset?.daysMode ?? effectivePlan?.advertisedBasis?.daysMode ?? "everyday",
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
  // Search/GPS address picker (same self-contained overlay Checkout uses).
  // `pickerSaved` gates the quiet confirmation row under the pincode field —
  // it only appears after an explicit pick, never for a prefilled saved
  // address, so the row always reflects a deliberate selection.
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [pickerSaved, setPickerSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);
  // Honest error state for the Payment step: set whenever Razorpay resolves
  // anything other than "paid" (dismissed modal OR gateway/network
  // unavailable) so the buyer never sees the success screen for a
  // subscription that was never actually charged.
  const [paymentIssue, setPaymentIssue] = useState<{
    reason: "cancelled" | "unavailable";
    message: string;
  } | null>(null);

  // ---- State-Amnesia remediation ------------------------------------------
  // Rehydrate the saved build once on mount (the buyer's earlier selections);
  // useWizardState read the stored draft during init, so wizard.draft here is
  // the persisted snapshot. The URL mirroring and popstate back-walking the
  // old inline effects did are owned by the hook now.
  useEffect(() => {
    const d = wizard.draft;
    if (d.slots) setSlots(d.slots);
    if (d.daysMode) setDaysMode(d.daysMode);
    if (d.cadence) setCadence(d.cadence);
    if (d.selectedBillingCadence !== undefined) setSelectedBillingCadence(d.selectedBillingCadence);
    if (typeof d.startDate === "string") setStartDate(d.startDate);
    if (d.address) setAddress(d.address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The wizard's meal basis must FOLLOW the chosen plan — mount-time
  // seeding alone cannot guarantee that. Picking a plan in the chooser (or
  // any /subscribe→/subscribe link) changes ?plan= without remounting, so
  // the useState initializers above never re-run; and the draft rehydrate
  // above can stomp a correct seed with slots saved from a different
  // context. Both resurrect the ₹3,800-card → ₹10,474-wizard bug for
  // chooser users. Adopt the advertised basis exactly when the plan
  // IDENTITY changes; manual slot edits (slug unchanged) are never touched,
  // and a draft built on this same plan (draft.planSlug matches) keeps the
  // user's own customizations.
  const adoptedPlanRef = useRef<string | null>(null);
  useEffect(() => {
    const slug = isTrial ? TRIAL_SLUG : (effectivePlan?.slug ?? null);
    if (!slug || adoptedPlanRef.current === slug) return;
    const isFirstAdoption = adoptedPlanRef.current === null;
    adoptedPlanRef.current = slug;
    // Returning to the plan this draft was built on → the rehydrated
    // customizations are the user's own; don't overwrite them.
    if (isFirstAdoption && wizard.draft.planSlug === slug) return;
    if (slug === TRIAL_SLUG) {
      // The marketed trial: one lunch a day for 3 days — the flat ₹1,499
      // pack every surface advertises. Extra slots remain a user-chosen
      // upgrade at step 1, never a silent default.
      if (!isTrial) setIsTrial(true);
      setSlots({ breakfast: false, lunch: true, dinner: false });
      setDaysMode("everyday");
      return;
    }
    const basis = effectivePlan?.advertisedBasis;
    if (basis) {
      setSlots({ ...basis.slots });
      setDaysMode(basis.daysMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePlan, isTrial]);

  // Mirror the builder's field state into the wizard draft; the hook
  // serializes it (with the current step) to sessionStorage on every change.
  // planSlug records which plan the slots/daysMode belong to, so the
  // adoption effect above can tell a same-plan return from a stale draft.
  useEffect(() => {
    wizard.patchDraft({
      slots,
      daysMode,
      cadence,
      selectedBillingCadence,
      startDate,
      address,
      planSlug: isTrial ? TRIAL_SLUG : effectivePlan?.slug,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, daysMode, cadence, selectedBillingCadence, startDate, address, isTrial, effectivePlan]);

  // Clear-on-success: order placed (success screen) — the draft has served
  // its purpose. Walking back from success re-creates it, same as before.
  useEffect(() => {
    if (step === 7) wizard.clearDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

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

  // Estimate shown while the server quote is loading (or unreachable). Uses
  // the exact pricing module the server bills with (@workspace/subscription-
  // rules), so the estimate can never disagree with the payable amount —
  // the previous local copy drifted on both the trial price and the weekly
  // discount.
  const getCalculatedPricePaise = (cad: SubscriptionCadence, meals: number, trial: boolean): number =>
    trial ? computeTrialPricePaise(meals) : computeDeliveryPricePaise(cad, meals);

  const goToStep = (next: number) => {
    if (next > step) {
      // Paired step event (playbook Part 8): the step being left, completed
      // by moving forward. 0-based (0–6), matching subscribe_step_viewed.
      track("subscribe_step_completed", { step });
    }
    wizard.goToStep(next);
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

  // Paired step event (playbook Part 8): fire once per step ENTRY — mount,
  // forward/back navigation and popstate walks all land here; the ref
  // dedupes re-renders within the same step. Step is 0-based (0–6) per the
  // Part 8 dictionary; the success screen (7) is covered by order_confirmed /
  // subscription_activated instead.
  const stepViewedRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isMounted) return;
    if (step > 6) return;
    if (stepViewedRef.current === step) return;
    stepViewedRef.current = step;
    track("subscribe_step_viewed", {
      step,
      plan: effectivePlan?.slug,
      cadence: activeCadence,
      trial: isTrial,
      entry: fromCart ? "fromCart" : planSlug || protocolParam ? "lp" : "bare",
    });
    // Only a step change (or the mount gate) may fire this — the descriptive
    // props are read fresh from the closure at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, isMounted]);

  // ---- Dynamic quote details from backend quote API ----
  const [quoteDetails, setQuoteDetails] = useState<{
    subtotal: number;
    taxes: number;
    savings: number;
    total: number;
    nextBillingAmount: number;
  } | null>(null);
  // Transparent-ledger guard: distinguish "still loading" from "failed to
  // load" so the Review/Payment screens can show an honest skeleton or a
  // retryable error instead of a plausible-but-wrong hardcoded price at the
  // exact moment the buyer is about to commit to paying.
  const [quoteError, setQuoteError] = useState(false);
  const [quoteRetryTick, setQuoteRetryTick] = useState(0);
  const retryQuote = () => setQuoteRetryTick((t) => t + 1);

  useEffect(() => {
    let alive = true;
    setQuoteError(false);
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
        // Part 8: every server-quote resolution the buyer can see — feeds
        // the quote-latency vs step-drop analysis in the F3 funnel.
        track("subscribe_quote_shown", {
          payable_today_paise: q.totalPaise,
          cadence: activeCadence,
        });
      })
      .catch((err) => {
        console.error("Quote fetch error", err);
        if (alive) setQuoteError(true);
      });
    return () => {
      alive = false;
    };
  }, [activeCadence, cycleMeals, isTrial, members.length, quoteRetryTick]);

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

  // Best-effort rollback for a subscription created but never paid for
  // (dismissed Razorpay modal, or the gateway/order-create call failing).
  // Retries once — a client-side cancel can never be fully reliable (closed
  // tab, lost network, crash), so this is intentionally not more elaborate:
  // the server-side subscription-abandonment sweep is the load-bearing
  // backstop that catches whatever this misses.
  const cancelAbandonedSubscription = async (subscriptionId: number): Promise<void> => {
    try {
      await subscriptionsApi.cancel(subscriptionId);
      return;
    } catch (err) {
      console.error(
        `Failed to cancel abandoned subscription ${subscriptionId} (attempt 1/2)`,
        err,
      );
    }
    try {
      await subscriptionsApi.cancel(subscriptionId);
    } catch (err) {
      console.error(
        `Failed to cancel abandoned subscription ${subscriptionId} (attempt 2/2) — ` +
          "relying on the server-side abandonment sweep to clean this up",
        err,
      );
    }
  };

  const submit = async () => {
    // Re-entry guard: step 6 mounts two controls that can charge (the
    // in-content pay button and the sticky bar). A fast double-tap must
    // never create two subscriptions / two Razorpay orders.
    if (submitting) return;
    if (!addressComplete) {
      toast.error("Please complete delivery details and verification");
      return;
    }
    setSubmitting(true);
    setPaymentIssue(null);
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

      // Phase C3 — funnel rung: the trial/subscription was created. Pairs with
      // `alacarte_order_placed` so à-la-carte-buyer → trial conversion is
      // queryable against cold-visitor conversion.
      track(isTrial ? "trial_started" : "subscription_started", {
        subscriptionId: result.subscription.id,
        cadence: activeCadence,
      });

      // Phase C2 — à la carte → trial bridge credit. The server redeems the
      // credit atomically inside POST /subscriptions and returns the paise it
      // applied; the client subtracts it from the charge as an explicit line
      // item (never folded into the base trial price). 0 when none redeemed.
      const bridgeCreditPaise = result.bridgeCreditPaise ?? 0;
      if (bridgeCreditPaise > 0) {
        track("trial_credit_redeemed", {
          subscriptionId: result.subscription.id,
          creditPaise: bridgeCreditPaise,
        });
      }

      const amountDue = Math.max(
        0,
        result.subscription.pricePerDeliveryPaise - bridgeCreditPaise,
      );
      // Gateway integers only: Razorpay rejects a non-integer / NaN / negative
      // amount with an opaque "internal error". Validate the pricing here so a
      // bad payload surfaces as a precise, logged message instead of a
      // dead-end red toast at the final gatekeeper.
      const perDeliveryPaise = result.subscription.pricePerDeliveryPaise;
      if (
        !Number.isInteger(perDeliveryPaise) ||
        perDeliveryPaise < 0 ||
        !Number.isInteger(amountDue) ||
        amountDue < 0
      ) {
        throw new Error(
          `Invalid subscription pricing — paise must be a non-negative integer ` +
            `(pricePerDeliveryPaise=${perDeliveryPaise}, bridgeCreditPaise=${bridgeCreditPaise}, amountDue=${amountDue}).`,
        );
      }
      if (razorpayConfigured() && amountDue > 0) {
        track("payment_initiated", { total_amount: amountDue });
        const outcome = await payWithRazorpay({
          amountPaise: amountDue,
          receipt: `sub-${result.subscription.id}`,
          description: isTrial
            ? "Tanmatra 3-Day Trial Pack"
            : `Tanmatra ${CADENCE_LABEL[activeCadence]} plan — first cycle`,
          contact: address.phone,
          // Required so the server can attach a recurring UPI Autopay token
          // to this gateway order for weekly/fortnightly plans — without it
          // POST /payments/razorpay/order never enters its recurring branch
          // and no autopay mandate is ever registered.
          subscriptionId: result.subscription.id,
        });
        if (outcome !== "paid") {
          // Neither a dismissed modal ("cancelled") nor a gateway/network
          // failure ("unavailable" — misconfigured keys, the order-create
          // call failing/404ing, the checkout script failing to load) ever
          // captured a payment. Either way the subscription just created
          // above must not be left "active" and must not be shown as a
          // success — that would be lying to the user about being charged.
          await cancelAbandonedSubscription(result.subscription.id);
          track("mandate_authorization_failed", {
            error_code: outcome === "cancelled" ? "user_cancelled" : "gateway_unavailable",
          });
          setPaymentIssue(
            outcome === "cancelled"
              ? {
                  reason: "cancelled",
                  message:
                    "Payment was cancelled before it completed. Your plan was not activated and you were not charged.",
                }
              : {
                  reason: "unavailable",
                  message:
                    "We couldn't reach the payment gateway. Your plan was not activated and you were not charged.",
                },
          );
          toast.error(
            outcome === "cancelled"
              ? "Payment cancelled — plan not active"
              : "Payment didn't go through — plan not active",
            { description: "You can try completing checkout again." },
          );
          setSubmitting(false);
          return;
        }

        if (!isTrial && activeCadence !== "monthly") {
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
      goToStep(7); // success screen step
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message === "unauthorized") {
        // Nothing in this multi-step builder ever checked auth state before
        // now — an anonymous or session-expired visitor could configure an
        // entire plan and reach the final Pay step before discovering they
        // need to sign in, with only a raw "unauthorized" string to explain
        // why. Same fix as Checkout.tsx's equivalent 401 handling: a plain-
        // language toast with a Sign In action that preserves the fully
        // configured plan (it lives in the URL query string) via `next`.
        toast.error("Sign in to finish setting up your plan", {
          description: "Your plan configuration is saved — you'll be right back here.",
          action: {
            label: "Sign in",
            onClick: () =>
              navigate(`/login?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`),
          },
        });
      } else {
        // Aggressive diagnostics for the "Could not create subscription"
        // gatekeeper failure — enough context to pinpoint a bad payload or
        // pricing bug, with NO PII (never name / phone / address).
        console.error("[SUBSCRIPTION_CREATE_FAILED]", {
          message,
          stack: err instanceof Error ? err.stack : null,
          cadence: activeCadence,
          planType: isTrial ? "trial" : "standard",
          planName: effectivePlan?.name ?? null,
          razorpayConfigured: razorpayConfigured(),
        });
        track("subscription_create_failed", {
          cadence: activeCadence,
          planType: isTrial ? "trial" : "standard",
          reason: message,
        });
        toast.error("Could not create subscription", { description: message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isMounted) {
    // Server-rendered shell. A1 (money-path rendering doctrine): every
    // manifest route must paint an h1 + a real progressive CTA anchor before
    // hydration — never a blank JS-required screen. The interactive stepper
    // replaces this on mount; the client's first render also hits this branch
    // (isMounted starts false), so server and client markup match — no
    // hydration mismatch.
    return (
      <div className="tnm2 nn min-h-screen bg-[var(--tnm-surface-ink)] text-white">
        <div className="max-w-[480px] mx-auto min-h-screen flex flex-col px-4 pt-16">
          <h1 className="text-xl font-bold text-white/95 leading-tight">
            Build your subscription
          </h1>
          <p className="fine text-white/60 mt-2 leading-relaxed">
            Choose a dietitian-designed plan, set your delivery schedule, and
            review the full price before you pay.
          </p>
          <Link
            to="/plans"
            className="btn btn-p btn-blk mt-6"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
          >
            Choose your plan
          </Link>
          <div className="mt-8 space-y-3" aria-hidden="true">
            <div className="h-24 rounded-lg bg-white/5" />
            <div className="h-24 rounded-lg bg-white/5" />
          </div>
        </div>
      </div>
    );
  }

  // Render S1 Recommendation (Step 0)
  const renderS1Recommendation = () => {
    // Bare entry (no ?plan= and no ?fromCart=1): a goal-first plan chooser
    // instead of a blank step 0 — was computed (`showChooser`) but never
    // rendered, so anyone landing on /subscribe directly saw nothing.
    if (showChooser) {
      return (
        <GoalPlanChooser
          preferences={preferences}
          onSelect={(slug) =>
            setSearchParams((prev) => {
              const p = new URLSearchParams(prev);
              p.set("plan", slug);
              return p;
            })
          }
        />
      );
    }
    if (!effectivePlan) return null;
    return (
      <div className="flex flex-col gap-6">
        <div className="card border border-white/5" style={{ background: "var(--tnm-surface-ink-2)" }}>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] uppercase font-bold tracking-wider bg-[var(--tnm-action)]/15 text-[var(--tnm-action)] border border-[var(--tnm-action)]/20 px-2 py-0.5 rounded">
              Recommended Plan
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
            {/* Optimistic: show the client estimate — which is the exact
                billing math (getCalculatedPricePaise), asserted equal to the
                payable amount — the instant slots/cadence change, instead of
                flashing "Verifying price…" or a stale server value on every
                toggle. The authoritative server quote still gates the Review
                and Payment steps below (the transparent-ledger guard). */}
            <span className="tnm-data text-lg font-bold text-[var(--tnm-action)] font-mono">
              {F_Paise(getCalculatedPricePaise(activeCadence, cycleMeals, isTrial))}
            </span>
          </div>
          {/* The basis line is the anti-sticker-shock contract: a price is
              never shown without the meal count it prices, so this screen
              can never silently disagree with the card that linked here. */}
          <p className="fine text-white/45 leading-relaxed">
            {isTrial
              ? `For ${cycleMeals} meal${cycleMeals === 1 ? "" : "s"} over 3 days · one-time`
              : `For ${cycleMeals} meals per ${activeCadence === "weekly" ? "week" : activeCadence === "fortnightly" ? "2 weeks" : "6 weeks"} (${[slots.breakfast && "breakfast", slots.lunch && "lunch", slots.dinner && "dinner"].filter(Boolean).join(" + ")} · ${daysMode === "everyday" ? "every day" : "weekdays"})`}
            {cycleMeals > 0
              ? ` · ≈${F_Paise(Math.round(getCalculatedPricePaise(activeCadence, cycleMeals, isTrial) / cycleMeals))} per meal`
              : ""}
            {" · incl. GST · free delivery. Adjust everything in the next steps."}
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
              // Just flip to trial — the basis-adoption effect configures the
              // marketed 3-lunch pack. The old inline setSlots forced all
              // three slots (9 meals ≈ ₹3,544) under this very button's
              // ₹1,499 label — register §A3's "three trial prices" bug.
              setIsTrial(true);
              goToStep(3); // Land straight on scheduling/checkout for Trial
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
                    aria-pressed={on}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-semibold transition-all active:scale-[0.98]"
                    style={{
                      background: on ? "var(--saf)" : "var(--s3)",
                      borderColor: on ? "var(--saf)" : "var(--ln2)",
                      color: on ? "var(--onsaf)" : "var(--mut)",
                    }}
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
              {([
                ["everyday", "Every day (7 days)"],
                ["weekdays", "Weekdays only (5 days)"],
              ] as const).map(([mode, label]) => {
                const on = daysMode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => setDaysMode(mode)}
                    aria-pressed={on}
                    className="py-2.5 rounded-xl border text-xs font-semibold transition-all active:scale-[0.98]"
                    style={{
                      background: on ? "var(--saf)" : "var(--s3)",
                      borderColor: on ? "var(--saf)" : "var(--ln2)",
                      color: on ? "var(--onsaf)" : "var(--mut)",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
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
    const OPTIONS: {
      cad: SubscriptionCadence;
      title: string;
      desc: string;
      best: boolean;
      badge: string | null;
    }[] = [
      { cad: "weekly", title: "1-Week Plan", desc: "Billed weekly · stops after Week 1 unless you continue.", best: false, badge: null },
      { cad: "fortnightly", title: "2-Week Plan", desc: `Billed bi-weekly · save ${cadenceDiscountPct("fortnightly")}% · stops after Week 2.`, best: false, badge: null },
      { cad: "monthly", title: "6-Week Plan", desc: `Prepaid · save ${cadenceDiscountPct("monthly")}% · stops after Week 6.`, best: true, badge: "Best Value" },
    ];
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h3 className="text-sm font-bold text-white/95">Choose your plan</h3>
          <p className="fine text-white/50 mt-1 leading-relaxed">
            Your commitment length sets your billing cadence — one choice, no surprises. Longer plans save more.
          </p>
        </div>

        {/* Commitment-anxiety disclosure verbatim */}
        <div className="card bg-[var(--tnm-action)]/5 border border-[var(--tnm-action)]/20 p-4 rounded-xl flex gap-3">
          <Info className="w-5 h-5 text-[var(--tnm-action)] shrink-0 mt-0.5" />
          <p className="fine text-white/80 leading-relaxed font-medium">
            You are in full control. Pause, skip, or cancel your plan at any time in one tap. No contracts, no penalties. Unused weeks are refunded instantly.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {OPTIONS.map((o) => {
            const on = selectedBillingCadence === o.cad;
            return (
              <button
                key={o.cad}
                aria-pressed={on}
                onClick={() => {
                  setCadence(o.cad);
                  setSelectedBillingCadence(o.cad);
                  goToStep(3);
                }}
                className="text-left flex justify-between items-center gap-3 p-4 rounded-xl transition-all w-full border active:scale-[0.99]"
                style={{
                  borderColor: on ? "var(--saf)" : o.best ? "color-mix(in srgb, var(--saf) 30%, transparent)" : "var(--ln2)",
                  background: on || o.best ? "var(--safd)" : "var(--s2)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="text-sm font-bold text-white/95">{o.title}</h4>
                    {o.badge && (
                      <span className="text-[9px] uppercase font-bold text-black bg-[var(--tnm-action)] px-1.5 py-0.5 rounded tracking-wide">
                        {o.badge}
                      </span>
                    )}
                  </div>
                  <p className="fine text-white/55 mt-1">{o.desc}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="tnm-data text-sm font-bold text-white/95 font-mono">
                    {F_Paise(weeklyEquivalentPaise(getCalculatedPricePaise(o.cad, cycleMeals, false), o.cad))}
                    <span className="text-[10px] font-medium text-white/45"> /week</span>
                  </div>
                  <div className="fine text-[10px] text-white/45">
                    {cadenceBilledLabel(getCalculatedPricePaise(o.cad, cycleMeals, false), o.cad, F_Paise)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* UPI Autopay mandate disclosure verbatim (carried from the merged billing step) */}
        <div className="card bg-white/[0.02] border border-white/5 p-4 rounded-xl flex gap-3 text-xs leading-relaxed text-white/80">
          <Info className="w-5 h-5 text-[var(--tnm-action)] shrink-0 mt-0.5" />
          <p className="fine">
            Weekly and bi-weekly plans use UPI Autopay. You'll get a notification at least 24 hours before each charge, and you can pause or cancel anytime in one tap. Setting up Autopay is free.
          </p>
        </div>

        <div className="flex gap-3 mt-2">
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

  // Render S5 Schedule (now Step 3 — Duration+Billing merged into Step 2)
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
            {/* Preferred path: search/GPS picker (same flow as Checkout). The
                manual pincode input below stays as the untouched fallback. */}
            <button
              type="button"
              onClick={() => setShowLocationPicker(true)}
              className="btn btn-s btn-blk w-full flex items-center justify-center gap-1.5 text-xs font-semibold focus-ring-clinical mb-3"
              style={{ height: 44 }}
            >
              <MapPin className="w-4 h-4" />
              Search address or use my location
            </button>
            <span className="text-[10px] uppercase font-bold text-white/45 mb-2 block">Pincode check</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={address.pincode}
              onChange={(e) => setAddress({ ...address, pincode: e.target.value.replace(/\D/g, "") })}
              placeholder="e.g. 201301"
              className="inp w-full font-mono focus-ring-clinical"
            />
            {address.pincode.length === 6 && pincodeCheck.state === "unserviceable" && (
              <p className="fine text-[var(--tnm-alert)] font-semibold mt-1.5 leading-snug flex items-start gap-1.5">
                <Warning className="w-3.5 h-3.5 shrink-0 mt-0.5" weight="fill" />
                Pincode unserviceable. Currently delivering to selected sectors in Noida.
              </p>
            )}
            {pincodeCheck.state === "serviceable" && (
              <p className="fine text-[var(--tnm-sage)] font-semibold mt-1.5 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Servicing confirmed: {pincodeCheck.info.area} ({pincodeCheck.info.city})
              </p>
            )}
            {/* Quiet confirmation of the picked address so the buyer sees what
                was selected without scrolling to the later details step. */}
            {pickerSaved && address.line.trim() && (
              <p className="fine text-white/50 mt-1.5 leading-snug flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Delivering to: {address.line}
                {address.city.trim() ? `, ${address.city}` : ""}
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
              className="inp w-full focus-ring-clinical"
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
            onClick={() => goToStep(isTrial ? 0 : 2)}
            className="btn btn-s btn-blk px-5"
            style={{ height: 44 }}
          >
            Back
          </button>
          <button
            disabled={!address.pincode || pincodeCheck.state !== "serviceable"}
            onClick={() => goToStep(4)}
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
                      style={{ height: 44, minWidth: 44 }}
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
            onClick={() => goToStep(3)}
            className="btn btn-s btn-blk px-5"
            style={{ height: 44 }}
          >
            Back
          </button>
          <button
            onClick={() => goToStep(5)}
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
    const subtotal = quoteDetails ? F_Paise(quoteDetails.subtotal) : null;
    const taxes = quoteDetails ? F_Paise(quoteDetails.taxes) : null;
    const savings = quoteDetails ? F_Paise(quoteDetails.savings) : null;
    const total = quoteDetails ? F_Paise(quoteDetails.total) : null;

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

        {/* Itemized bill panel — transparent ledger: never show a fabricated
            breakdown. Skeleton while the server quote loads, a retryable
            error if it fails, real numbers only once verified. */}
        {quoteError ? (
          <div className="card flex flex-col gap-2.5" style={{ background: "var(--s2)", borderColor: "var(--tnm-alert)" }}>
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--tnm-alert)]">
              <Warning className="w-4 h-4 shrink-0" />
              Couldn't load your price
            </div>
            <p className="fine text-white/60">We couldn't reach our pricing service. Nothing has been charged.</p>
            <button
              type="button"
              onClick={retryQuote}
              className="btn btn-s self-start"
              style={{ height: 36, paddingLeft: 14, paddingRight: 14 }}
            >
              Retry
            </button>
          </div>
        ) : !quoteDetails ? (
          <div className="card flex flex-col gap-3" style={{ background: "var(--s2)", borderColor: "var(--ln)" }}>
            <h4 className="text-xs font-bold text-white/90">Pre-checkout invoice</h4>
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between items-center pt-2 border-t border-white/5">
                <div className="h-3 rounded bg-white/5" style={{ width: 120 }} />
                <div className="h-3 rounded bg-white/5" style={{ width: 60 }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="card flex flex-col gap-3" style={{ background: "var(--s2)", borderColor: "var(--ln)" }}>
            <h4 className="text-xs font-bold text-white/90">Pre-checkout invoice</h4>
            <div className="flex justify-between text-xs text-white/60 pt-2 border-t border-white/5">
              <span>{cycleMeals} meal deliveries</span>
              <span className="font-mono text-white/80">{subtotal}</span>
            </div>
            <div className="flex justify-between text-xs text-white/60">
              <span>GST Taxes (5%)</span>
              <span className="font-mono text-white/80">{taxes}</span>
            </div>
            <div className="flex justify-between text-xs text-white/60">
              <span>Delivery service charge</span>
              <span className="text-[var(--color-alert-safe)] font-semibold">FREE</span>
            </div>
            {quoteDetails.savings > 0 && (
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
        )}

        {/* Next payment details immediately below */}
        {!isTrial && (
          <div className="card bg-white/[0.01] border border-white/5 p-3.5 rounded-xl flex flex-col gap-2 text-xs">
            <div className="flex justify-between text-white/50">
              <span>Next Renewal Date:</span>
              <span className="font-medium text-white/80">{nextDateLabel}</span>
            </div>
            <div className="flex justify-between text-white/50">
              <span>Next Renewal Charge:</span>
              <span className="font-medium text-[var(--tnm-action)]">{total ?? "—"}</span>
            </div>
            <div className="flex justify-between text-white/50">
              <span>Commitment Length:</span>
              <span className="font-medium text-white/80">
                {activeCadence === "monthly" ? "6 Weeks" : activeCadence === "fortnightly" ? "2 Weeks" : "1 Week"}
              </span>
            </div>
            <p className="text-[10px] text-white/40 mt-1 leading-snug">
              Your plan stops after Week {activeCadence === "monthly" ? "6" : activeCadence === "fortnightly" ? "2" : "1"} unless you choose to continue.
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

        <MedicalDisclaimer compact />

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
              className="inp w-full focus-ring-clinical"
            />
          </div>
          <div className="flex flex-col gap-1.5 mt-2">
            <span className="text-[10px] text-white/45 font-mono">Mobile Contact Phone</span>
            <input
              type="tel"
              inputMode="tel"
              value={address.phone}
              onChange={(e) => setAddress({ ...address, phone: e.target.value })}
              placeholder="e.g. +91 92892 13115"
              className="inp w-full focus-ring-clinical"
            />
          </div>
          <div className="flex flex-col gap-1.5 mt-2">
            <span className="text-[10px] text-white/45 font-mono">Full Street/House Address</span>
            <input
              type="text"
              value={address.line}
              onChange={(e) => setAddress({ ...address, line: e.target.value })}
              placeholder="e.g. Sector 62, Noida"
              className="inp w-full focus-ring-clinical"
            />
          </div>
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
            disabled={submitting || !addressComplete || !quoteDetails}
            onClick={() => goToStep(6)} // Payment Step
            className={`btn btn-p flex-1 flex items-center justify-center gap-1.5 font-bold ${
              submitting || !addressComplete || !quoteDetails ? "opacity-50 cursor-not-allowed" : ""
            }`}
            style={{ height: 44 }}
          >
            {quoteDetails ? `Proceed to Payment (${total})` : "Verifying price…"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  // Render S8 Payment (Step 7)
  const renderS8Payment = () => {
    const payableAmount = quoteDetails?.total
      ? F_Paise(quoteDetails.total)
      : F_Paise(getCalculatedPricePaise(activeCadence, cycleMeals, isTrial));
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

        {/* Honest error state (never a silent fallthrough to the success screen):
            shown when Razorpay resolved "cancelled" or "unavailable" — no
            payment was captured, so the plan was rolled back. */}
        {paymentIssue && (
          <div className="card flex flex-col gap-2" style={{ background: "var(--s2)", borderColor: "var(--tnm-alert)" }}>
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--tnm-alert)]">
              <Warning className="w-4 h-4 shrink-0" />
              Payment didn't go through
            </div>
            <p className="fine text-white/60">{paymentIssue.message}</p>
          </div>
        )}

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
                {/* payableAmount is the full-cycle charge — for fortnightly
                    that is a 2-week amount, so a hardcoded "/week" unit
                    misstated the authorization. */}
                <span className="tnm-data font-semibold text-white/95">
                  Up to {payableAmount}
                  {activeCadence === "fortnightly" ? " / 2 weeks" : " / week"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>First Debit Date:</span>
                <span className="tnm-data font-mono text-white/95">{firstDeliveryLabel}</span>
              </div>
              <div className="flex justify-between">
                <span>Mandate Expiry:</span>
                <span className="tnm-data font-mono text-white/95">At plan end ({cycleWeeks} weeks)</span>
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
            onClick={() => goToStep(5)}
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
    const paidVal = quoteDetails?.total
      ? F_Paise(quoteDetails.total)
      : F_Paise(getCalculatedPricePaise(activeCadence, cycleMeals, isTrial));
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
            <span className="tnm-data text-white/90 font-bold">{successOrderId || "—"}</span>
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
              goToStep(5); // Return to review to update fields
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
    <div className="tnm2 nn min-h-screen bg-[var(--tnm-surface-ink)] text-white select-none">
      <div className="max-w-[480px] mx-auto min-h-screen flex flex-col pb-24">
        {/* Stepper App Header */}
        <div className="appbar shrink-0">
          {step > 0 && step < 7 ? (
            <button className="iconbtn" onClick={() => wizard.goToStep(step - 1)} aria-label="Previous step">
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <Link className="iconbtn" to="/plans" aria-label="Back to plans">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          )}
          <div className="abt">
            <span style={{ display: "block" }}>
              {step === 7 ? "Order confirmed" : STEP_TITLES[step]}
            </span>
            {step < 7 && (
              <span className="lab" style={{ display: "block", marginTop: 2 }}>
                Step {step + 1} of 7{isTrial ? " · Trial" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Wizard progress — always-visible sense of place (CRO: reduces
            abandonment from "how much longer?" uncertainty). */}
        {step < 7 && (
          <div className="segs padx shrink-0" aria-hidden="true" style={{ marginTop: 2 }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <span key={i} className={i <= step ? "seg on" : "seg"} />
            ))}
          </div>
        )}

        <div className="content padx flex-1 pt-4">
          {step === 0 && renderS1Recommendation()}
          {step === 1 && renderS2Frequency()}
          {step === 2 && renderS3Duration()}
          {step === 3 && renderS5Schedule()}
          {step === 4 && renderS6Preview()}
          {step === 5 && renderS7Review()}
          {step === 6 && renderS8Payment()}
          {step === 7 && renderSuccess()}
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
                  aria-label="Close"
                  className="w-11 h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white"
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

        {/* Address search/GPS picker — self-contained overlay, same pattern as
            Checkout. The merge below feeds the existing `address` state, so the
            pincode gate (checkPincode useMemo) and the later details step's
            street/phone inputs pick the result up with no extra wiring. */}
        {/* No initialData, deliberately (Checkout's precedent): Subscribe
            stores the address as ONE joined line, but the picker's
            initialData contract is a SPLIT line1 (flat) / line2 (locality) —
            round-tripping the joined string as line1 leaves locality empty
            (save hard-blocks) and nests the address deeper on every cycle.
            A truthy initialData also skips the picker's search/GPS step,
            which would make this trigger's label a lie. */}
        <LocationPickerFlow
          open={showLocationPicker}
          onOpenChange={setShowLocationPicker}
          onSave={async (addressData) => {
            const pickedPincode = String(addressData.pincode ?? "")
              .replace(/\D/g, "")
              .slice(0, 6);
            setAddress((prev) => ({
              ...prev,
              label: addressData.label || prev.label,
              line: [addressData.line1, addressData.line2].filter(Boolean).join(", "),
              city: addressData.city || prev.city,
              pincode: pickedPincode,
              // A phone the buyer already typed wins — the picker's recipient
              // phone only fills the gap.
              phone: prev.phone.trim() ? prev.phone : (addressData.phone ?? ""),
            }));
            setPickerSaved(true);
            // Cast: analytics.ts owns a closed EventName union and is outside
            // this change's blast radius — add the literal there when that
            // file is next touched.
            track("subscribe_location_picker_saved" as Parameters<typeof track>[0], {
              pincode: pickedPincode,
            });
          }}
        />
      </div>

      {/* Global StickyBottomBar integration (Step-locked wizard modes).
          Unmounted while the location picker overlay is open: the bar sits at
          z-[900], the shared picker at zIndex 60 (Checkout's own bar is 30) —
          left mounted it would cover the picker's Save footer on mobile and
          keep its Continue CTA clickable above the modal backdrop. */}
      {step < 7 && !showLocationPicker && (
        <StickyBottomBar
          context="builder"
          step={step}
          planSummaryText={
            step === 0
              ? "Recommended starting protocol"
              : step === 1
              ? `${weekMeals} meals configured`
              : step === 2
              ? `Plan & billing selected`
              : step === 3
              ? `Delivery starting ${firstDeliveryLabel}`
              : step === 4
              ? `Review meal customizations`
              : `Payable details checklist`
          }
          pricePaise={quoteDetails?.total || getCalculatedPricePaise(activeCadence, cycleMeals, isTrial)}
          ctaText={
            // The word "Pay" appears ONLY on the step whose action charges
            // (step 6 → submit()). Step 5 is Review — its action just
            // advances, so it must say so. The old mapping had these
            // reversed: "Pay & start" on the non-charging Review step and a
            // generic "Continue" on the actual charge.
            step === 0
              ? "Build plan"
              : step === 5
              ? "Continue to payment"
              : step === 6
              ? `Pay ${quoteDetails?.total ? F_Paise(quoteDetails.total) : ""} & start`.replace("  ", " ")
              : "Continue"
          }
          onContinue={() => {
            // Routed through goToStep (not the hook's raw setter) so the
            // sticky bar fires the same per-step analytics as the in-content
            // Continue buttons — they were silently unpaired before.
            if (step === 0) goToStep(1);
            else if (step === 1) goToStep(2);
            else if (step === 2) goToStep(3);
            else if (step === 3) goToStep(4);
            else if (step === 4) goToStep(5);
            else if (step === 5) goToStep(6);
            else if (step === 6) submit();
          }}
          disabled={
            (step === 1 && weekMeals < 3) ||
            (step === 2 && !selectedBillingCadence) ||
            (step === 3 && pincodeCheck.state !== "serviceable") ||
            (step === 5 && (!addressComplete || !quoteDetails))
          }
          loading={submitting}
        />
      )}
    </div>
  );
}
