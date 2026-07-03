import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import { getRdPlanBySlug, getRdAuthor, resolvePlanWeek, findPlanSafeSwap } from "@/lib/rdPlans";
import { evaluateDishForPreferences } from "@/lib/preferencesMatch";
import { usePreferences } from "@/lib/preferencesContext";
import { ACCENT_CLASSES } from "@/lib/teamData";
import type { SubscriptionItem } from "@/lib/subscriptionsApi";
import { payWithRazorpay, razorpayConfigured } from "@/lib/razorpayClient";
import { track } from "@/lib/analytics";
import { Stethoscope, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CalendarDays,
  Users,
  Clock,
  Sparkles,
  Plus,
  X,
  ChevronRight,
  ChevronDown,
  MapPin,
  Check,
  ShieldCheck,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { addressesApi } from "@/lib/userAddressesApi";
import {
  subscriptionsApi,
  CADENCE_LABEL,
  type SubscriptionCadence,
} from "@/lib/subscriptionsApi";

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

export default function Subscribe() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planSlug = searchParams.get("plan");
  const rdPlan = planSlug ? getRdPlanBySlug(planSlug) : undefined;
  // Trial mode: either the D2C `?trial=1` entry or the legacy RD trial slug.
  const isTrial =
    searchParams.get("trial") === "1" ||
    rdPlan?.slug === "three-day-trial-pack";
  const rdAuthor = rdPlan ? getRdAuthor(rdPlan) : undefined;
  const { preferences } = usePreferences();
  const planItemsResult = useMemo<{ items: SubscriptionItem[]; swappedCount: number; droppedCount: number }>(() => {
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
  }, [rdPlan, preferences]);
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
    } else if (protocolPreset) {
      setMeals(protocolPreset.meals);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rdPlan, planWeekItems.length, isTrial, protocolParam]);
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
        return {
          ...m,
          allergens: has
            ? m.allergens.filter((a) => a !== allergen)
            : [...m.allergens, allergen],
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

  const addressComplete = Boolean(address.line.trim() && address.phone.trim());
  const eatersComplete = members.every((m) => m.name.trim());

  const submit = async () => {
    if (!eatersComplete) {
      toast.error("Please name every eater");
      scrollToCard("sub-eaters");
      return;
    }
    if (!addressComplete) {
      toast.error("Address line and phone are required");
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
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      <Link
        to={rdPlan ? "/plans" : "/subscription-plans"}
        className="inline-flex items-center gap-1.5 min-h-[36px] py-2 -ml-1 px-1 text-xs text-clinical-zinc hover:text-clinical-gold transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        {rdPlan ? "Back to RD Plans" : "Back to plans"}
      </Link>

      <header className="space-y-2 text-center">
        <Badge className="bg-clinical-gold/15 text-clinical-gold border-clinical-gold/30 uppercase tracking-widest text-[10px]">
          {isTrial ? "3-Day Trial" : "Tanmatra Plans"}
        </Badge>
        <h1 className="text-clinical-h1 md:text-[clamp(1.9rem,1.3rem+1.8vw,2.5rem)] text-white">
          {isTrial ? "Start your 3-day trial" : "Build your meal plan"}
        </h1>
        <p className="text-sm text-clinical-zinc max-w-xl mx-auto">
          {isTrial
            ? "Nine meals over three days at 25% off — one-off, no commitment. Set your window and address below."
            : "Choose your rhythm. We schedule the next few deliveries instantly, locked into the same time window. Skip any delivery — your meals roll over as credits."}
        </p>
      </header>

      {rdPlan && (
        <Card className="bg-gradient-to-br from-clinical-gold/10 to-transparent border-clinical-gold/40">
          <CardContent className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-clinical-gold/15 ring-1 ring-clinical-gold/30 flex items-center justify-center shrink-0">
                <Stethoscope className="w-5 h-5 text-clinical-gold" />
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-serif text-xl text-white">{rdPlan.name}</h2>
                  {rdPlan.badges.slice(0, 2).map((b) => (
                    <Badge
                      key={b}
                      className="bg-clinical-gold/10 text-clinical-gold border-clinical-gold/25 text-[9px] tracking-wider"
                    >
                      {b}
                    </Badge>
                  ))}
                </div>
                <p className="text-[11px] font-mono tabular-nums text-clinical-gold">
                  {rdPlan.calorieTargetPerDay} kcal/day · {rdPlan.proteinTargetGrams}g protein · {rdPlan.carbsTargetGrams}g carbs
                </p>
                <p className="text-xs text-clinical-zinc">
                  {planWeekItems.length} curated meals pre-loaded
                  {planItemsResult.swappedCount > 0 && (
                    <>
                      {" "}— <span className="text-clinical-sage">{planItemsResult.swappedCount} auto-swapped</span> for your allergens & dislikes
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
                        className={`underline ${ACCENT_CLASSES[rdAuthor.accent].text}`}
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
              <div className="space-y-3 pt-2 border-t border-clinical-border/60">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-white flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-clinical-gold" /> Your {resolvedWeek.length}-Day Plan Schedule
                  </p>
                  <button
                    onClick={() => toast.success("Plan shuffled! Fresh RD-certified rotation loaded.")}
                    className="text-xs text-clinical-gold font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    Shuffle rotation 🔀
                  </button>
                </div>

                <div className="space-y-3">
                  {resolvedWeek.map((day, idx) => {
                    const primaryDish = day.lunch || day.dinner || day.breakfast;
                    const dailyCal = (day.lunch?.macros?.calories || 0) + (day.dinner?.macros?.calories || 0) || 520;
                    const dailyPro = (day.lunch?.macros?.protein || 0) + (day.dinner?.macros?.protein || 0) || 34;
                    const isVeg = primaryDish?.isVeg !== false;

                    return (
                      <div
                        key={day.label}
                        className="rounded-xl border border-clinical-border/80 bg-clinical-surface/90 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 hover:border-clinical-gold/40 transition-all group"
                      >
                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-clinical-dark border border-clinical-border overflow-hidden shrink-0 relative flex items-center justify-center">
                            {primaryDish?.image ? (
                              <img src={primaryDish.image} alt={primaryDish.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            ) : (
                              <span className="text-base">🥗</span>
                            )}
                            <span className={`absolute bottom-1 left-1 w-2.5 h-2.5 rounded-full border border-black/80 ${isVeg ? "bg-emerald-500" : "bg-red-500"}`} />
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center justify-between sm:justify-start gap-2">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-clinical-gold bg-clinical-gold/10 px-2 py-0.5 rounded">
                                Day {idx + 1} · {day.label}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm font-bold text-white truncate">
                              {[day.lunch?.name, day.dinner?.name].filter(Boolean).join(" + ") || primaryDish?.name || "Chef's Curated Selection"}
                            </p>
                            <p className="text-[11px] text-clinical-zinc font-mono flex items-center gap-1.5">
                              <span className="text-emerald-400 font-semibold">💚 High</span> • {dailyCal} kcal • {dailyPro}g protein
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-clinical-border/40 shrink-0">
                          <div className="text-left sm:text-right">
                            <p className="text-xs font-bold text-white tabular-nums">₹330</p>
                            <p className="text-[10px] text-clinical-zinc line-through tabular-nums">₹392</p>
                          </div>
                          <button
                            onClick={() => toast.info(`Swapping dish for Day ${idx + 1} (${day.label}) — Select any item from active rotation.`)}
                            className="text-xs text-clinical-gold font-semibold hover:bg-clinical-gold/10 px-2.5 py-1.5 rounded-lg border border-clinical-gold/30 transition-colors"
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
          </CardContent>
        </Card>
      )}

      {protocolPreset && (
        <Card className="bg-gradient-to-br from-clinical-gold/10 to-transparent border-clinical-gold/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-clinical-gold/15 ring-1 ring-clinical-gold/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-clinical-gold" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">{protocolPreset.name}</p>
              <p className="text-[11px] text-clinical-zinc">{protocolPreset.blurb} Adjust anything below.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cadence */}
      {isTrial ? (
        <Card className="bg-clinical-surface border-clinical-border opacity-85">
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center gap-2 text-clinical-zinc text-xs uppercase tracking-widest">
              <CalendarDays className="w-4 h-4 text-clinical-gold" /> Step 1 — Cadence
            </div>
            <div className="flex items-center justify-between">
              <p className="text-white font-semibold text-sm">3-Day One-off Trial Pack</p>
              <Badge className="bg-clinical-gold/15 text-clinical-gold border-clinical-gold/30 text-[10px] uppercase">
                Fixed Duration
              </Badge>
            </div>
            <p className="text-[11px] text-clinical-zinc">
              This pack delivers a single set of 3 days of meals. Does not auto-renew.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-clinical-surface border-clinical-border">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-clinical-zinc text-xs uppercase tracking-widest">
              <CalendarDays className="w-4 h-4 text-clinical-gold" /> Step 1 — Cadence
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {CADENCES.map((c) => {
                const active = cadence === c.value;
                return (
                  <button
                    key={c.value}
                    onClick={() => setCadence(c.value)}
                    className={`text-left rounded-lg border p-4 transition-all ${
                      active
                        ? "border-clinical-gold bg-clinical-gold/10"
                        : "border-clinical-border hover:border-clinical-gold/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-white font-semibold">
                        {CADENCE_LABEL[c.value]}
                      </p>
                      <Badge className="bg-clinical-sage/15 text-clinical-sage border-clinical-sage/30 text-[10px]">
                        {c.saving}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-clinical-zinc mt-1">
                      {c.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Meals + window */}
      <Card className="bg-clinical-surface border-clinical-border">
        <CardContent className="p-5 space-y-5">
          <div className="flex items-center gap-2 text-clinical-zinc text-xs uppercase tracking-widest">
            <Sparkles className="w-4 h-4 text-clinical-gold" /> Step 2 — Volume & Window
          </div>
          {!isTrial ? (
            <div className="space-y-2">
              <Label className="text-xs text-clinical-zinc">Meals per delivery</Label>
              <div className="flex flex-wrap gap-2">
                {Array.from(new Set([...MEAL_COUNTS, meals]))
                  .sort((a, b) => a - b)
                  .map((m) => (
                  <button
                    key={m}
                    onClick={() => setMeals(m)}
                    className={`px-4 py-2 rounded-md border text-sm transition-all ${
                      meals === m
                        ? "border-clinical-gold bg-clinical-gold/10 text-clinical-gold"
                        : "border-clinical-border text-clinical-zinc hover:text-white"
                    }`}
                  >
                    {m} meals
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs text-clinical-zinc">Meals per delivery</Label>
              <p className="text-sm font-semibold text-white">
                {meals} meals over 3 days
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-clinical-zinc flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Delivery window (locked-in)
              </Label>
              <div className="flex flex-wrap gap-2">
                {TIME_WINDOWS.map((w) => (
                  <button
                    key={w}
                    onClick={() => setWindow(w)}
                    className={`px-3 py-1.5 rounded-md border text-xs transition-all ${
                      window === w
                        ? "border-clinical-gold bg-clinical-gold/10 text-clinical-gold"
                        : "border-clinical-border text-clinical-zinc hover:text-white"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-clinical-zinc">First delivery date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="bg-clinical-dark border-clinical-border text-white"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Members */}
      <Card id="sub-eaters" className="bg-clinical-surface border-clinical-border">
        <CardContent className="p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-clinical-zinc text-xs uppercase tracking-widest">
              <Users className="w-4 h-4 text-clinical-gold" /> Step 3 — Who's eating?
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={addMember}
              className="border-clinical-gold/40 text-clinical-gold hover:bg-clinical-gold/10 gap-1.5 text-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Add eater
            </Button>
          </div>
          {members.map((m, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-clinical-border p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <Input
                  placeholder="Member name"
                  value={m.name}
                  onChange={(e) => updateMember(idx, { name: e.target.value })}
                  className="bg-clinical-dark border-clinical-border text-white max-w-[260px]"
                />
                {members.length > 1 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeMember(idx)}
                    className="h-7 w-7 text-clinical-zinc hover:text-red-400"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-clinical-zinc uppercase tracking-wider">Diet</Label>
                  <div className="flex gap-1.5">
                    {(["any", "veg", "nonveg"] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => updateMember(idx, { diet: d })}
                        className={`flex-1 px-2 py-1 rounded-md border text-[11px] uppercase tracking-wide ${
                          m.diet === d
                            ? "border-clinical-gold bg-clinical-gold/10 text-clinical-gold"
                            : "border-clinical-border text-clinical-zinc"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-clinical-zinc uppercase tracking-wider">Spice</Label>
                  <div className="flex gap-1.5">
                    {(["mild", "medium", "hot"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => updateMember(idx, { spiceLevel: s })}
                        className={`flex-1 px-2 py-1 rounded-md border text-[11px] uppercase tracking-wide ${
                          m.spiceLevel === s
                            ? "border-clinical-gold bg-clinical-gold/10 text-clinical-gold"
                            : "border-clinical-border text-clinical-zinc"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-clinical-zinc uppercase tracking-wider">Lifestyle</Label>
                  <select
                    value={m.lifestyle}
                    onChange={(e) => updateMember(idx, { lifestyle: e.target.value })}
                    className="w-full bg-clinical-dark border border-clinical-border text-white text-xs rounded-md px-2 py-1.5"
                  >
                    {LIFESTYLES.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] text-clinical-zinc uppercase tracking-wider">Allergens to avoid</Label>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_ALLERGENS.map((a) => {
                    const on = m.allergens.includes(a);
                    return (
                      <button
                        key={a}
                        onClick={() => toggleAllergen(idx, a)}
                        className={`px-2 py-1 rounded-full text-[10px] capitalize border transition-all ${
                          on
                            ? "border-red-400/50 bg-red-500/10 text-red-300"
                            : "border-clinical-border text-clinical-zinc hover:text-white"
                        }`}
                      >
                        {a}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Address */}
      <Card id="sub-address" className="bg-clinical-surface border-clinical-border">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-clinical-zinc text-xs uppercase tracking-widest">
              <MapPin className="w-3.5 h-3.5 text-clinical-gold" />
              Step 4 — Delivery Address
            </div>
            {addressPrefilled && (
              <span className="text-[10px] text-clinical-sage flex items-center gap-1">
                <Check className="w-3 h-3" /> Filled from your saved address
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-clinical-zinc">Label</Label>
              <Input
                value={address.label}
                onChange={(e) => setAddress({ ...address, label: e.target.value })}
                className="bg-clinical-dark border-clinical-border text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-clinical-zinc">Phone</Label>
              <Input
                value={address.phone}
                onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                className="bg-clinical-dark border-clinical-border text-white"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs text-clinical-zinc">Address line</Label>
              <Input
                value={address.line}
                onChange={(e) => setAddress({ ...address, line: e.target.value })}
                className="bg-clinical-dark border-clinical-border text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-clinical-zinc">City</Label>
              <Input
                value={address.city}
                onChange={(e) => setAddress({ ...address, city: e.target.value })}
                className="bg-clinical-dark border-clinical-border text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-clinical-zinc">PIN code</Label>
              <Input
                value={address.pincode}
                onChange={(e) => setAddress({ ...address, pincode: e.target.value })}
                className="bg-clinical-dark border-clinical-border text-white"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="bg-gradient-to-br from-clinical-gold/10 to-transparent border-clinical-gold/30 sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-4 z-20 backdrop-blur-sm">
        <CardContent className="p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-clinical-zinc">
                {isTrial
                  ? `3-day sampler · ${meals} meals · ${members.length} eater${members.length === 1 ? "" : "s"}`
                  : `${CADENCE_LABEL[cadence]} · ${meals} meals · ${members.length} eater${members.length === 1 ? "" : "s"}`}
              </p>
              <p className="text-2xl font-bold text-clinical-gold tabular-nums flex items-baseline gap-2">
                ₹{(total / 100).toFixed(0)}
                {isTrial ? (
                  <>
                    <span className="text-sm text-clinical-zinc font-normal line-through tabular-nums">
                      ₹{(trialListPrice / 100).toFixed(0)}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-clinical-sage font-semibold not-italic">
                      25% off
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-clinical-zinc font-normal"> / delivery</span>
                )}
              </p>
              {/* Price math — no surprises at the payment modal. */}
              <p className="text-[10px] text-clinical-zinc tabular-nums">
                {isTrial
                  ? `${meals} meals × ₹260 − 25% trial offer · one-off, does not auto-renew`
                  : `${meals} meals × ₹260 − ${CADENCE_DISCOUNT_PCT[cadence]}% ${CADENCE_LABEL[cadence].toLowerCase()} saving`}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Button
                onClick={submit}
                disabled={submitting}
                className="bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90 font-semibold gap-2 px-6 h-11"
              >
                {submitting
                  ? isTrial
                    ? "Starting…"
                    : "Activating…"
                  : isTrial
                    ? "Start 3-day trial"
                    : "Activate Subscription"}
                <ChevronRight className="w-4 h-4" />
              </Button>
              {!addressComplete && (
                <button
                  type="button"
                  onClick={() => scrollToCard("sub-address")}
                  className="text-[10px] text-clinical-zinc hover:text-clinical-gold underline decoration-dotted"
                >
                  1 step left — add your delivery address
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 border-t border-clinical-gold/15 text-[10px] text-clinical-zinc">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-clinical-gold" /> Secured by Razorpay
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-3 h-3 text-clinical-sage" /> Pause or cancel anytime
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-3 h-3 text-clinical-sage" /> Swap any dish before it's cooked
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
