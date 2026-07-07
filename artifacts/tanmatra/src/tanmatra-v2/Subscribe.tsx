import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import { getRdPlanBySlug, getRdAuthor, resolvePlanWeek, findPlanSafeSwap } from "@/lib/rdPlans";
import { evaluateDishForPreferences } from "@/lib/preferencesMatch";
import { usePreferences } from "@/lib/preferencesContext";
import { ACCENT_CLASSES } from "@/lib/teamData";
import { useCartStore } from "@/lib/cartContext";
import type { SubscriptionItem } from "@/lib/subscriptionsApi";
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
import { F } from "./data";

const CADENCES: Array<{
  value: SubscriptionCadence;
  description: string;
  saving: string;
}> = [
  { value: "weekly", description: "7 days · max freshness", saving: "Save 5%" },
  {
    value: "fortnightly",
    description: "14 days · balanced rhythm",
    saving: "Save 10%",
  },
  {
    value: "monthly",
    description: "30 days · best value",
    saving: "Save 15%",
  },
];

const MEAL_COUNTS = [5, 10, 15, 21];

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

const PER_MEAL_PAISE = 26000;
const CADENCE_DISCOUNT_PCT: Record<SubscriptionCadence, number> = {
  weekly: 5,
  fortnightly: 10,
  monthly: 15,
};

function basePrice(cadence: SubscriptionCadence, meals: number): number {
  return Math.round(
    meals * PER_MEAL_PAISE * (1 - CADENCE_DISCOUNT_PCT[cadence] / 100),
  );
}

// Landing-card entries (?protocol=…) preset the configurator to what the
// card advertised.
const PROTOCOL_PRESETS = {
  wellness: {
    name: "Everyday Balanced",
    blurb: "Clean, calorie-smart meals for busy weekdays — 5 lunches a week.",
    meals: 5,
  },
  performance: {
    name: "High-Protein",
    blurb: "Protein-forward meals for training days — 6 meals a week.",
    meals: 6,
  },
} as const;

export default function V2Subscribe() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { orders } = useOrders();
  const isFirstOrder = orders.length === 0;
  const [policyModal, setPolicyModal] = useState<"pause" | "swap" | null>(null);
  const planSlug = searchParams.get("plan");
  const rdPlan = planSlug ? getRdPlanBySlug(planSlug) : undefined;
  // Trial mode: either the D2C `?trial=1` entry or the legacy RD trial slug.
  const isTrial =
    searchParams.get("trial") === "1" ||
    rdPlan?.slug === "three-day-trial-pack";
  const rdAuthor = rdPlan ? getRdAuthor(rdPlan) : undefined;
  const { preferences, update } = usePreferences();
  const fromCart = searchParams.get("fromCart") === "1";
  const cartItems = useCartStore((s) => s.items);
  const planItemsResult = useMemo<{ items: SubscriptionItem[]; swappedCount: number; droppedCount: number }>(() => {
    if (fromCart && !rdPlan) {
      const items: SubscriptionItem[] = cartItems.map((ci) => ({
        slug: ci.slug,
        name: ci.name,
        image: ci.image,
        quantity: ci.quantity,
        unitPricePaise: ci.unitPrice,
      }));
      return { items, swappedCount: 0, droppedCount: 0 };
    }
    if (!rdPlan) return { items: [], swappedCount: 0, droppedCount: 0 };
    const week = resolvePlanWeek(rdPlan);
    const items: SubscriptionItem[] = [];
    const seen = new Set<string>();
    let swappedCount = 0;
    let droppedCount = 0;
    for (const day of week) {
      for (const meal of [day.lunch, day.dinner]) {
        if (!meal) continue;
        let chosen = meal;
        if (preferences) {
          const evalResult = evaluateDishForPreferences(meal, preferences);
          const needsSwap =
            evalResult.blocked ||
            evalResult.matchedAllergens.length > 0 ||
            evalResult.matchedDislikes.length > 0;
          if (needsSwap) {
            const swap = findPlanSafeSwap(rdPlan, meal, preferences);
            if (!swap) {
              droppedCount += 1;
              continue;
            }
            chosen = swap;
            swappedCount += 1;
          }
        }
        if (seen.has(chosen.slug)) continue;
        seen.add(chosen.slug);
        items.push({
          slug: chosen.slug,
          name: chosen.name,
          image: chosen.image,
          quantity: 1,
          unitPricePaise: chosen.price,
        });
      }
    }
    return { items: items.slice(0, 14), swappedCount, droppedCount };
  }, [rdPlan, preferences, fromCart, cartItems]);
  const planWeekItems = planItemsResult.items;
  // Resolved 7-day rotation for the inline preview (dish objects per day).
  const resolvedWeek = useMemo(
    () => (rdPlan ? resolvePlanWeek(rdPlan) : []),
    [rdPlan],
  );
  const cadenceParam = searchParams.get("cadence");
  const initialCadence: SubscriptionCadence =
    cadenceParam === "weekly" ||
    cadenceParam === "fortnightly" ||
    cadenceParam === "monthly"
      ? cadenceParam
      : "weekly";
  const [cadence, setCadence] = useState<SubscriptionCadence>(initialCadence);
  const [meals, setMeals] = useState(10);
  // Landing-page protocol entries preset sensible defaults so the page
  // opens configured to what the card advertised (Everyday Balanced =
  // 5 meals/wk, High-Protein = 6) instead of a generic 10.
  const protocolParam = searchParams.get("protocol");
  const protocolPreset =
    !rdPlan && !isTrial && protocolParam && protocolParam in PROTOCOL_PRESETS
      ? PROTOCOL_PRESETS[protocolParam as keyof typeof PROTOCOL_PRESETS]
      : null;
  useEffect(() => {
    if (rdPlan) {
      setCadence("weekly");
      setMeals(Math.min(planWeekItems.length || 10, 14));
    } else if (isTrial) {
      // D2C 3-day sampler defaults to 3 days × 3 meals.
      setCadence("weekly");
      setMeals(9);
    } else if (fromCart && planWeekItems.length > 0) {
      const totalCartQty = planWeekItems.reduce((sum, item) => sum + item.quantity, 0);
      setMeals(totalCartQty || planWeekItems.length || 10);
    } else if (protocolPreset) {
      setMeals(protocolPreset.meals);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rdPlan, planWeekItems.length, isTrial, protocolParam, fromCart]);
  const [window, setWindow] = useState(TIME_WINDOWS[1]);
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

  // Trial = one-off 3-day sampler at 25% off list (mirrors the server's
  // computeTrialPricePaise). Standard = cadence-discounted recurring price.
  const total = isTrial
    ? Math.round(meals * 26000 * 0.75)
    : basePrice(cadence, meals);
  const trialListPrice = Math.round(meals * 26000);

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
    setSubmitting(true);
    try {
      const result = await subscriptionsApi.create({
        cadence,
        mealsPerDelivery: meals,
        deliveryWindow: window,
        startDate: new Date(startDate).toISOString(),
        planType: isTrial ? "trial" : "standard",
        addressLabel: address.label,
        addressLine: address.line,
        city: address.city,
        pincode: address.pincode,
        phone: address.phone,
        notes: rdPlan ? `RD Plan: ${rdPlan.name}` : undefined,
        members: members.map((m) => ({
          name: m.name.trim(),
          diet: m.diet,
          allergens: m.allergens,
          lifestyle: m.lifestyle || undefined,
          spiceLevel: m.spiceLevel,
        })),
        defaultItems: planWeekItems,
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
            : `Tanmatra ${CADENCE_LABEL[cadence]} plan — first delivery`,
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
      });
      toast.success(isTrial ? "Trial started" : "Subscription activated", {
        description: `Next delivery: ${new Date(result.subscription.nextDeliveryAt).toLocaleDateString()}`,
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

  return (
    <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="appbar">
          <Link
            className="iconbtn"
            to={rdPlan ? "/plans" : "/subscription-plans"}
            aria-label={rdPlan ? "Back to RD Plans" : "Back to plans"}
          >
            <i className="ph-bold ph-arrow-left" />
          </Link>
          <div className="abt">{isTrial ? "Start your 3-day trial" : "Build your meal plan"}</div>
        </div>

        <div className="content padx" style={{ paddingTop: 4 }}>
          {/* Hero */}
          <div className="tc mb16">
            <span className="lab" style={{ color: "var(--safb)" }}>
              {isTrial ? "3-Day Trial" : "Tanmatra Plans"}
            </span>
            <h1 className="disp mt6" style={{ color: "#fff" }}>
              {isTrial ? "Start your 3-day trial" : "Build your meal plan"}
            </h1>
            <p className="fine mt6">
              {isTrial
                ? "Nine meals over three days at 25% off — one-off, no commitment. Set your window and address below."
                : "Choose your rhythm. We schedule the next few deliveries instantly, locked into the same time window. Skip any delivery — your meals roll over as credits."}
            </p>
          </div>

          {rdPlan && (
            <div className="card mb16" style={{ background: "var(--safd)", borderColor: "var(--saf)" }}>
              <div className="fx gap12" style={{ alignItems: "flex-start" }}>
                <div className="dic" style={{ background: "var(--safd)", color: "var(--safb)" }}>
                  <i className="ph-bold ph-stethoscope" />
                </div>
                <div className="f1" style={{ minWidth: 0 }}>
                  <div className="fx wrap ac gap8">
                    <span className="h2" style={{ color: "#fff" }}>{rdPlan.name}</span>
                    {rdPlan.badges.slice(0, 2).map((b) => (
                      <span key={b} className="pill" style={{ background: "var(--safd)", color: "var(--safb)" }}>
                        {b}
                      </span>
                    ))}
                  </div>
                  <p className="mono mt6 safc" style={{ fontSize: 11 }}>
                    {rdPlan.calorieTargetPerDay} kcal/day · {rdPlan.proteinTargetGrams}g protein · {rdPlan.carbsTargetGrams}g carbs
                  </p>
                  <p className="fine mt4">
                    {planWeekItems.length} curated meals pre-loaded
                    {planItemsResult.swappedCount > 0 && (
                      <>
                        {" "}— <span className="sagec">{planItemsResult.swappedCount} auto-swapped</span> for your allergens & dislikes
                      </>
                    )}
                    {planItemsResult.droppedCount > 0 && (
                      <> ({planItemsResult.droppedCount} skipped — no safe match)</>
                    )}
                    .
                    {rdAuthor && (
                      <>
                        {" "}Designed by{" "}
                        <Link
                          to={`/team/${rdAuthor.slug}`}
                          className={`${ACCENT_CLASSES[rdAuthor.accent].text}`}
                          style={{ textDecoration: "underline" }}
                        >
                          {rdAuthor.name}, RD
                        </Link>
                        .
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Enhanced Daily Schedule Grid (Reference UI Patterns) */}
              {resolvedWeek.length > 0 && (
                <div className="mt14" style={{ paddingTop: 12, borderTop: "1px solid var(--ln)" }}>
                  <div className="fx ac jb mb10">
                    <span className="lab fx ac gap8" style={{ color: "#fff" }}>
                      <i className="ph-bold ph-calendar-dots safc" /> Your {resolvedWeek.length}-Day Plan Schedule
                    </span>
                    <button
                      onClick={() => toast.success("Plan shuffled! Fresh RD-certified rotation loaded.")}
                      className="linkq"
                    >
                      Shuffle rotation 🔀
                    </button>
                  </div>

                  <div>
                    {resolvedWeek.map((day, idx) => {
                      let primaryDish = day.lunch || day.dinner || day.breakfast;
                      let dailyCal = (day.lunch?.macros?.calories || 0) + (day.dinner?.macros?.calories || 0) || 520;
                      let dailyPro = (day.lunch?.macros?.protein || 0) + (day.dinner?.macros?.protein || 0) || 34;
                      let isVeg = primaryDish?.isVeg !== false;
                      let dishName = [day.lunch?.name, day.dinner?.name].filter(Boolean).join(" + ") || primaryDish?.name || "Chef's Curated Selection";
                      let isAutoSwapped = false;

                      if (preferences && rdPlan) {
                        const lunchEval = day.lunch ? evaluateDishForPreferences(day.lunch, preferences) : null;
                        const dinnerEval = day.dinner ? evaluateDishForPreferences(day.dinner, preferences) : null;
                        if ((lunchEval && (lunchEval.blocked || lunchEval.matchedAllergens.length > 0)) ||
                            (dinnerEval && (dinnerEval.blocked || dinnerEval.matchedAllergens.length > 0))) {
                          isAutoSwapped = true;
                          const safeLunch = day.lunch ? (findPlanSafeSwap(rdPlan, day.lunch, preferences) || day.lunch) : null;
                          const safeDinner = day.dinner ? (findPlanSafeSwap(rdPlan, day.dinner, preferences) || day.dinner) : null;
                          primaryDish = safeLunch || safeDinner || primaryDish;
                          dishName = [safeLunch?.name, safeDinner?.name].filter(Boolean).join(" + ") || primaryDish?.name || dishName;
                          dailyCal = (safeLunch?.macros?.calories || 0) + (safeDinner?.macros?.calories || 0) || dailyCal;
                          dailyPro = (safeLunch?.macros?.protein || 0) + (safeDinner?.macros?.protein || 0) || dailyPro;
                          isVeg = primaryDish?.isVeg !== false;
                        }
                      }

                      return (
                        <div key={day.label} className="dcard">
                          <div className="fx gap12" style={{ alignItems: "flex-start" }}>
                            <div
                              className="dimg fx ac jc"
                              style={{
                                width: 60,
                                height: 60,
                                borderRadius: 10,
                                overflow: "hidden",
                                position: "relative",
                                backgroundImage: primaryDish?.image ? `url(${primaryDish.image})` : undefined,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                                background: primaryDish?.image ? undefined : "var(--s2)",
                              }}
                            >
                              {!primaryDish?.image && <span style={{ fontSize: 22 }}>🥗</span>}
                              <span className={isVeg ? "vd" : "vd nv"} style={{ position: "absolute", bottom: 4, left: 4 }} />
                            </div>
                            <div className="f1" style={{ minWidth: 0 }}>
                              <div className="fx wrap ac jb gap8">
                                <span className="lab safc" style={{ background: "var(--safd)", padding: "2px 6px", borderRadius: 6 }}>
                                  Day {idx + 1} · {day.label}
                                </span>
                                {isAutoSwapped && (
                                  <span className="pill sg">
                                    🛡️ Auto-swapped: 100% allergen safe
                                  </span>
                                )}
                              </div>
                              <p className="small clamp1 mt4" style={{ fontWeight: 700, color: "#fff" }}>
                                {dishName}
                              </p>
                              <p className="mono mt2 fx ac g6" style={{ fontSize: 11 }}>
                                <span className="sagec fw6">💚 High</span> • {dailyCal} kcal • {dailyPro}g protein
                              </p>
                            </div>
                          </div>
                          <div className="fx ac jb mt10" style={{ paddingTop: 10, borderTop: "1px solid var(--ln)" }}>
                            <div>
                              <span className="price" style={{ color: "#fff" }}>₹330</span>{" "}
                              <span className="fntc strike" style={{ fontSize: 11 }}>₹392</span>
                            </div>
                            <button
                              onClick={() => toast.info(`Swapping dish for Day ${idx + 1} (${day.label}) — Select any item from active rotation.`)}
                              className="chip"
                            >
                              Change dish 📝
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {protocolPreset && (
            <div className="card mb16" style={{ background: "var(--safd)", borderColor: "var(--saf)" }}>
              <div className="fx ac gap12">
                <div className="dic" style={{ background: "var(--safd)", color: "var(--safb)" }}>
                  <i className="ph-fill ph-sparkle" />
                </div>
                <div className="f1">
                  <p className="tt" style={{ color: "#fff" }}>{protocolPreset.name}</p>
                  <p className="fine mt2">{protocolPreset.blurb} Adjust anything below.</p>
                </div>
              </div>
            </div>
          )}

          {/* Cadence */}
          {isTrial ? (
            <div className="card mb16" style={{ opacity: 0.85 }}>
              <div className="lab fx ac gap8">
                <i className="ph-bold ph-calendar-dots safc" /> Step 1 — Cadence
              </div>
              <div className="fx ac jb mt10">
                <p className="tt" style={{ color: "#fff" }}>3-Day One-off Trial Pack</p>
                <span className="pill" style={{ background: "var(--safd)", color: "var(--safb)" }}>
                  Fixed Duration
                </span>
              </div>
              <p className="fine mt6">
                This pack delivers a single set of 3 days of meals. Does not auto-renew.
              </p>
            </div>
          ) : (
            <div className="card mb16">
              <div className="lab fx ac gap8 mb10">
                <i className="ph-bold ph-calendar-dots safc" /> Step 1 — Cadence
              </div>
              <div>
                {CADENCES.map((c) => {
                  const active = cadence === c.value;
                  return (
                    <button
                      key={c.value}
                      onClick={() => setCadence(c.value)}
                      className={active ? "opt on" : "opt"}
                      style={{ flexDirection: "column", alignItems: "stretch" }}
                    >
                      <div className="fx ac jb w100">
                        <span style={{ color: "#fff", fontWeight: 600 }}>
                          {CADENCE_LABEL[c.value]}
                        </span>
                        <span className="pill sg">{c.saving}</span>
                      </div>
                      <span className="fine mt2">{c.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Meals + window */}
          <div className="card mb16">
            <div className="lab fx ac gap8 mb12">
              <i className="ph-fill ph-sparkle safc" /> Step 2 — Volume & Window
            </div>
            {!isTrial ? (
              <div className="mb16">
                <div className="lab mb8">Meals per delivery</div>
                <div className="fx wrap gap8">
                  {Array.from(new Set([...MEAL_COUNTS, meals]))
                    .sort((a, b) => a - b)
                    .map((m) => (
                    <button
                      key={m}
                      onClick={() => setMeals(m)}
                      className={meals === m ? "chip on" : "chip"}
                    >
                      {m} meals
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb16">
                <div className="lab mb4">Meals per delivery</div>
                <p className="tt" style={{ color: "#fff" }}>
                  {meals} meals over 3 days
                </p>
              </div>
            )}
            <div>
              <div className="mb16">
                <div className="fx wrap ac jb gap8 mb8">
                  <span className="lab fx ac g6">
                    <i className="ph-bold ph-clock" /> Delivery window (locked-in)
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
                      onClick={() => setWindow(w)}
                      className={window === w ? "chip on" : "chip"}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="lab mb8">First delivery date</div>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="inp"
                />
              </div>
            </div>
          </div>

          {/* Members */}
          <div id="sub-eaters" className="card mb16">
            <div className="fx ac jb mb12">
              <div className="lab fx ac gap8">
                <i className="ph-bold ph-users safc" /> Step 3 — Who's eating?
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
                          style={on ? { borderColor: "var(--dgr)", color: "var(--dgr)", background: "rgba(201,124,112,.14)", textTransform: "capitalize" } : { textTransform: "capitalize" }}
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

          {/* Address */}
          <div id="sub-address" className="card mb16">
            <div className="fx ac jb gap8 mb12">
              <div className="lab fx ac gap8">
                <i className="ph-bold ph-map-pin safc" />
                Step 4 — Delivery Address
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

          {/* Summary */}
          <div className="card mb16" style={{ background: "var(--safd)", borderColor: "var(--saf)" }}>
            <div className="fx wrap ac jb gap16">
              <div>
                <p className="lab">
                  {isTrial
                    ? `3-day sampler · ${meals} meals · ${members.length} eater${members.length === 1 ? "" : "s"}`
                    : `${CADENCE_LABEL[cadence]} · ${meals} meals · ${members.length} eater${members.length === 1 ? "" : "s"}`}
                </p>
                <p className="price safc mt4 fx" style={{ fontSize: 26, alignItems: "baseline", gap: 8 }}>
                  {F(total)}
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
                    <span className="fntc" style={{ fontSize: 14, fontWeight: 400 }}> / delivery</span>
                  )}
                </p>
                {/* Price math — no surprises at the payment modal. */}
                <div className="mt6">
                  <p className="fine" style={{ fontSize: 10 }}>
                    {isTrial
                      ? `${meals} meals × ₹260 − 25% trial offer · one-off, does not auto-renew`
                      : `${meals} meals × ₹260 − ${CADENCE_DISCOUNT_PCT[cadence]}% ${CADENCE_LABEL[cadence].toLowerCase()} saving`}
                  </p>
                  {isFirstOrder && !isTrial && (
                    <p className="fine sagec fw6 mt2" style={{ fontSize: 10 }}>
                      🎁 First order welcome offer: flat 25% off (capped at ₹80) applied automatically at payment
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
            <div className="fx wrap ac gap16 mt10" style={{ paddingTop: 10, borderTop: "1px solid rgba(232,154,62,.25)" }}>
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
        </div>

        {policyModal !== null && (
          <div
            className="tnm2"
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
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
                      <strong>Swap before kitchen cutoff:</strong> Don't fancy tomorrow's recipe? Up to 24 hours before your scheduled slot, click <em>Change dish</em> on any upcoming delivery day to select any alternative RD-certified meal on our active rotation at zero extra charge.
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
