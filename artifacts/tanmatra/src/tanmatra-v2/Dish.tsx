import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { track } from "@/lib/analytics";
import { getDishBySlug, F } from "./data";
import { useMenuCatalog } from "@/lib/menuData";
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
} from "@/lib/dishEnrichment";
import { buildNutritionLabel } from "@/lib/nutritionLabel";
import { getChefForDish, getRdForDish } from "@/lib/teamData";
import CoachAgentWidget from "@/components/ai/CoachAgent";
import { API_BASE } from "@/lib/apiBase";

/* ------------------------------------------------------------------ *
 * Full-parity re-port of the original System-A Dish PDP into the v2   *
 * (.tnm2) design language. Every CUJ the original had is preserved,   *
 * reusing the exact hooks / handlers / endpoints — only presentation  *
 * changes. Reference: git 2507084 src/pages/Dish.tsx (903 lines).     *
 * ------------------------------------------------------------------ */

// Compact re-implementation of WhyThisMealPanel's private narrative builder.
const GOAL_LABEL: Record<string, string> = {
  lose_weight: "weight-loss",
  gain_muscle: "muscle-gain",
  maintain: "maintenance",
  general_wellness: "general-wellness",
};
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
  const { dishes: catalogDishes, isLive } = useMenuCatalog();
  const { enabled: clinicalMode } = useClinicalMode();

  const meal: any = useMemo(() => {
    if (!slug) return undefined;
    return catalogDishes.find((d: any) => d.slug === slug) ?? getDishBySlug(slug);
  }, [slug, catalogDishes]);

  const match = useMemo(() => (meal ? evaluateDishForPreferences(meal, preferences) : null), [meal, preferences]);
  const smartSwap = useMemo(() => (meal ? findSmartSwap(meal, preferences) : null), [meal, preferences]);
  const customizations = useMemo(() => (meal ? getCustomizationsForDish(meal) : []), [meal]);
  const variants = useMemo(() => (meal ? getDishVariants(meal.slug, catalogDishes) : []), [meal, catalogDishes]);

  const [quantity, setQuantity] = useState(1);
  const [selections, setSelections] = useState<Record<number, string | string[]>>({});
  const [showFacts, setShowFacts] = useState(false);

  // Reset selection/quantity whenever the dish changes (navigating between
  // variants keeps this component mounted, so a once-only init would go stale).
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meal?.slug]);

  useEffect(() => {
    if (meal) track("view_product", { dishId: meal.id, name: meal.name, price: meal.price });
  }, [meal]);

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

  const calculatedTotal = calculatedUnitPrice * quantity;

  if (!meal) {
    return (
      <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div className="appbar">
            <Link className="iconbtn" to="/menu"><i className="ph-bold ph-arrow-left" /></Link>
            <div className="abt">Dish</div>
          </div>
          <div className="padx tc" style={{ paddingTop: 48 }}>
            <i className="ph-bold ph-warning" style={{ fontSize: 34, color: "var(--saf)" }} />
            <div className="tt mt20">Dish not found</div>
            <div className="fine mt6">No dish with slug “{slug}”.</div>
            <Link className="btn btn-g btn-blk mt20" to="/menu">Back to menu</Link>
          </div>
        </div>
      </div>
    );
  }

  const isVeg = !!meal.isVeg;
  const gi: string = meal.glycaemicIndex || "medium";
  const giCls = gi === "low" ? "gi gi-low" : "gi gi-med";
  const giLabel = gi === "low" ? "GI LOW" : gi === "high" ? "GI HIGH" : "GI MED";
  const isPremiumOnly = premiumSlugs.has(meal.slug);
  const label = buildNutritionLabel(meal);
  const kitchenNote = getKitchenNoteForDish(meal);
  const rdNote = getRdNoteForDish(meal);
  const chef = getChefForDish(meal);
  const rd = getRdForDish(meal);
  const upsells = getUpsellsForDish(meal, 3);
  const pairing = meal.pairingSlug ? getDishBySlug(meal.pairingSlug) : undefined;
  const balancedDoshas = (["vata", "pitta", "kapha"] as const).filter((d) => matchesDosha(meal, d));

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
          const sign = opt.priceModifier > 0 ? "+" : opt.priceModifier < 0 ? "−" : "";
          const amt = opt.priceModifier !== 0 ? ` (${sign}Rs.${Math.abs(opt.priceModifier) / 100})` : "";
          labels.push(`${opt.name}${amt}`);
        }
      } else if (group.type === "multiple" && Array.isArray(sel)) {
        sel.forEach((name) => {
          const opt = group.options.find((o: any) => o.name === name);
          if (opt) labels.push(`${opt.name} (+Rs.${opt.priceModifier / 100})`);
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
      toast.error("Cannot add dish: Allergen/Contraindication conflict");
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
      quantity,
      kitchen: meal.kitchen,
      isVeg: meal.isVeg,
      rdVerified: meal.rdVerified,
      macros: meal.macros,
      customizations: custom,
    });
    track("add_to_cart", { dishId: meal.id, name: meal.name, price: calculatedUnitPrice, quantity });
    openCart();
    toast.success(`Added ${meal.name} to your order`, {
      description: `${F(calculatedTotal)} · Qty: ${quantity}${custom.length ? ` · ${custom.length} custom` : ""}`,
    });
  };

  const quickAdd = (u: any) => {
    addItem({
      dishId: u.id, slug: u.slug, name: u.name, image: u.image,
      basePrice: u.price, unitPrice: u.price, quantity: 1,
      kitchen: u.kitchen, isVeg: u.isVeg, rdVerified: u.rdVerified,
      macros: u.macros, customizations: [],
    });
    track("add_to_cart", { dishId: u.id, name: u.name, price: u.price, quantity: 1 });
    openCart();
    toast.success(`Added ${u.name}`);
  };

  const modColor = (m: number) => (m > 0 ? "var(--sage)" : m < 0 ? "var(--safb)" : "var(--mut)");

  return (
    <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div className="content">
          {/* Hero */}
          <div className="plc" style={{ height: 300, backgroundImage: `url(${meal.image})`, backgroundSize: "cover", backgroundPosition: "center" }}>
            <div className="herograd" />
            <div className="posabs w100 fx ac jb" style={{ top: 0, left: 0, padding: "12px 16px", zIndex: 2 }}>
              <Link className="glass" to="/menu" aria-label="Back to menu"><i className="ph-bold ph-arrow-left" /></Link>
              <span className="pill" style={{ background: "rgba(10,12,13,.55)", backdropFilter: "blur(8px)", textTransform: "capitalize" }}>
                <i className="ph-bold ph-cooking-pot" />
                {clinicalMode ? clinicalCategoryLabel(meal.category, meal.kitchen) : meal.kitchen}
              </span>
            </div>
          </div>

          <div className="padx" style={{ paddingTop: 16 }}>
            {/* Signal row */}
            <div className="fx ac g6 wrap">
              <span className="vtag"><span className={isVeg ? "vd" : "vd nv"} />{isVeg ? "VEG" : "NON-VEG"}</span>
              <span className={giCls}>{giLabel}</span>
              {isPremiumOnly && (
                <span className="pill" style={{ background: "var(--safd)", color: "var(--safb)" }}>
                  <i className="ph-fill ph-crown" />PREMIUM
                </span>
              )}
              {meal.rdVerified && (
                <span className="pill sg" style={{ marginLeft: "auto" }}><i className="ph-fill ph-seal-check" />RD-signed</span>
              )}
            </div>

            <h1 className="h2 mt10">{meal.name}</h1>
            <div className="fine mt6" style={{ textTransform: "capitalize" }}>
              {meal.category} · <span className="mono">{meal.prepTime}</span> · GI {gi} · sugar {meal.sugarPerServing}
            </div>

            <div className="fx ac jb mt10">
              <span className="price" style={{ fontSize: 21, color: "var(--safb)" }}>{F(meal.price)}</span>
              <span className="fine">per serving</span>
            </div>

            {/* Variant switcher */}
            {variants.length > 1 && (
              <div className="mt14">
                <div className="lab mb6">Option</div>
                <div className="fx ac g6 wrap">
                  {variants.map((v: any) => {
                    const active = v.slug === meal.slug;
                    return (
                      <Link key={v.slug} to={`/dish/${v.slug}`} className={active ? "chip on" : "chip"}>
                        <span className={v.isVeg ? "vd" : "vd nv"} style={{ width: 7, height: 7 }} />
                        {v.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="small mut mt10" style={{ lineHeight: 1.5 }}>{meal.description}</p>

            {/* Macro ribbon */}
            <div className="ribbon mt14" role="group" aria-label={`Nutrition: ${meal.macros.calories} kcal, ${meal.macros.protein}g protein, ${meal.macros.carbs}g carbs, ${meal.macros.fat}g fat`}>
              <div className="rc"><span className="rl">KCAL</span><span className="rv sf">{meal.macros.calories}</span></div>
              <div className="rc"><span className="rl">PROTEIN</span><span className="rv">{meal.macros.protein}<i className="ru">g</i></span></div>
              <div className="rc"><span className="rl">CARBS</span><span className="rv">{meal.macros.carbs}<i className="ru">g</i></span></div>
              <div className="rc"><span className="rl">FAT</span><span className="rv">{meal.macros.fat}<i className="ru">g</i></span></div>
            </div>
            <div className="fine mt6">
              Fibre <span className="mono">{meal.macros.fiber} g</span> · sodium{" "}
              <span className="mono">{label.macros.sodiumMg} mg</span>{" "}
              ({Math.round((label.macros.sodiumMg / 2300) * 100)}% DV) · sat fat{" "}
              <span className="mono">{label.macros.saturatedFat} g</span>
            </div>

            {/* Nutrition-fact claims + full facts toggle */}
            {label.containsClaims.length > 0 && (
              <div className="fx ac g6 wrap mt10">
                {label.containsClaims.map((c: string) => (
                  <span key={c} className="pill sg"><i className="ph-fill ph-check" />{c}</span>
                ))}
              </div>
            )}
            <div className="acc mt10" style={{ borderTop: "none" }}>
              <button className={showFacts ? "arow on" : "arow"} onClick={() => setShowFacts((s) => !s)}>
                Full nutrition facts<i className="ph-bold ph-caret-down" />
              </button>
              {showFacts && (
                <div className="abody">
                  <div className="fine">Serving: {label.servingSize}</div>
                  {label.freeFromClaims?.length > 0 && (
                    <div className="mt6">{label.freeFromClaims.map((c: string) => `• ${c}`).join("  ")}</div>
                  )}
                  <div className="mt6">Sugar <span className="mono">{label.macros.sugar} g</span></div>
                  <div className="mt6">Allergens: {meal.allergens?.length ? meal.allergens.join(", ") : "None declared"}</div>
                </div>
              )}
            </div>
          </div>

          {/* Targets vs daily */}
          {preferences && (preferences.calorieTarget || preferences.proteinTargetGrams) && (
            <div className="padx mt16">
              <div className="card">
                <div className="lab mb10">Vs. your daily targets</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {preferences.calorieTarget && (
                    <TargetRow label="Calories" val={meal.macros.calories} target={preferences.calorieTarget} pct />
                  )}
                  {preferences.proteinTargetGrams && (
                    <TargetRow label="Protein" val={meal.macros.protein} target={preferences.proteinTargetGrams} unit="g" pct />
                  )}
                  {preferences.carbsTargetGrams && (
                    <TargetRow label="Carbs" val={meal.macros.carbs} target={preferences.carbsTargetGrams} unit="g" />
                  )}
                  {preferences.fatTargetGrams && (
                    <TargetRow label="Fat" val={meal.macros.fat} target={preferences.fatTargetGrams} unit="g" />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Why this meal (preference match) */}
          {match && (match.warnings.length > 0 || (preferences && match.reasons.length >= 0)) && (
            <div className="padx mt16">
              {match.warnings.length > 0 ? (
                <div className="note" style={{ background: "rgba(201,124,112,.12)", borderColor: "rgba(201,124,112,.35)", color: "var(--dgr)" }}>
                  <i className="ph-fill ph-warning" />
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Heads up — based on your preferences</div>
                    {match.warnings.map((w: string) => <div key={w}>• {w}</div>)}
                  </div>
                </div>
              ) : preferences ? (
                <div className="note">
                  <i className="ph-fill ph-sparkle" />
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Why this meal for you</div>
                    <div style={{ color: "var(--mut)" }}>{buildNarrative(meal, preferences)}</div>
                    {match.reasons.map((r: string) => <div key={r} style={{ color: "var(--mut)" }}>• {r}</div>)}
                    {balancedDoshas.length > 0 && (
                      <div className="fx ac g6 wrap mt6">
                        <span className="fine">Ayurvedic balance:</span>
                        {balancedDoshas.map((d) => (
                          <span key={d} className="pill" style={{ textTransform: "capitalize" }}>{d} dosha</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {smartSwap && (
                <Link to={`/dish/${smartSwap.slug}`} className="fx ac gap12 mt10" style={{ padding: 10, border: "1px solid var(--saf)", background: "var(--safd)", borderRadius: 12 }}>
                  <img src={smartSwap.image} alt={smartSwap.name} style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }} />
                  <div className="f1" style={{ minWidth: 0 }}>
                    <div className="lab" style={{ color: "var(--safb)" }}>Smart swap for your profile</div>
                    <div className="small clamp1">{smartSwap.name}</div>
                  </div>
                  <i className="ph-bold ph-arrow-right" style={{ color: "var(--safb)" }} />
                </Link>
              )}
            </div>
          )}

          {/* Ask the coach (reused AI widget) */}
          {match && (
            <div className="padx mt16">
              <div className="sh mb10">Ask the coach</div>
              <CoachAgentWidget dishSlug={meal.slug} inline />
            </div>
          )}

          {/* RD advisory note */}
          <div className="padx mt16">
            <div className="note">
              <i className="ph-fill ph-shield-check" />
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>RD advisory note</div>
                <div style={{ color: "var(--mut)" }}>{rdNote}</div>
                {rd && (
                  <Link to={`/team/${rd.slug}`} className="fx ac gap8 mt6">
                    <span className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{rd.initials}</span>
                    <span className="fine">Signed off by <span style={{ color: "var(--sage)" }}>{rd.name}</span> · {rd.title}</span>
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* From the kitchen */}
          <div className="padx mt10">
            <div className="banner" style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <i className="ph-fill ph-flame" style={{ color: "var(--safb)", fontSize: 16, marginTop: 1, flex: "none" }} />
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--safb)", fontSize: 12.5 }}>From the kitchen</div>
                <div className="fine">{kitchenNote}</div>
                {chef && (
                  <Link to={`/team/${chef.slug}`} className="fx ac gap8 mt6">
                    <span className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{chef.initials}</span>
                    <span className="fine">Cooked by <span style={{ color: "var(--safb)" }}>{chef.name}</span> · {chef.title}</span>
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Ingredients */}
          <div className="padx mt16">
            <div className="lab mb10"><i className="ph-bold ph-carrot" /> Ingredients</div>
            <div className="fx ac g6 wrap">
              {meal.ingredients.map((ing: string, i: number) => (
                <span key={i} className="pill" style={{ textTransform: "capitalize" }}>{stripIngredientAmount(ing)}</span>
              ))}
            </div>
          </div>

          {/* Customize your order */}
          {customizations.length > 0 && (
            <div className="padx mt16">
              <div className="sh mb10"><i className="ph-bold ph-sliders-horizontal" /> Customise your order</div>
              {customizations.map((group: any, idx: number) => (
                <div key={group.groupName} className="mb14">
                  <div className="fx ac jb mb6">
                    <span className="tt" style={{ fontSize: 14 }}>{group.groupName}</span>
                    <span className="lab">{group.type === "single" ? "Pick one" : "Add any"}</span>
                  </div>
                  {group.options.map((opt: any) => {
                    const selected =
                      group.type === "single"
                        ? selections[idx] === opt.name
                        : ((selections[idx] as string[]) ?? []).includes(opt.name);
                    return (
                      <button
                        key={opt.name}
                        className={selected ? "opt on" : "opt"}
                        onClick={() =>
                          group.type === "single" ? handleSingleSelect(idx, opt.name) : handleMultipleToggle(idx, opt.name)
                        }
                        aria-pressed={selected}
                      >
                        <i className={
                          group.type === "single"
                            ? selected ? "ph-fill ph-radio-button" : "ph-bold ph-circle"
                            : selected ? "ph-fill ph-check-square" : "ph-bold ph-square"
                        } />
                        <span className="f1">
                          {opt.name}
                          {opt.default && <span className="pill" style={{ marginLeft: 8, fontSize: 10 }}>{group.type === "single" ? "Chef’s pick" : "Recommended"}</span>}
                        </span>
                        <span className="mono" style={{ fontSize: 13, color: modColor(opt.priceModifier) }}>
                          {opt.priceModifier > 0 ? "+" : ""}{opt.priceModifier !== 0 ? F(opt.priceModifier) : "—"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Reviews */}
          <div className="padx mt16">
            <V2Reviews slug={meal.slug} />
          </div>

          {/* Often added together */}
          {upsells.length > 0 && (
            <div className="padx mt16">
              <div className="sh mb10"><i className="ph-bold ph-sparkle" /> Often added together</div>
              {upsells.map((u: any) => (
                <div key={u.id} className="fx ac gap12 mb10" style={{ padding: 10, border: "1px solid var(--ln)", background: "var(--s1)", borderRadius: 12 }}>
                  <Link to={`/dish/${u.slug}`} style={{ flex: "none" }}>
                    <img src={u.image} alt={u.name} loading="lazy" style={{ width: 52, height: 52, borderRadius: 10, objectFit: "cover" }} />
                  </Link>
                  <div className="f1" style={{ minWidth: 0 }}>
                    <Link to={`/dish/${u.slug}`} className="small clamp1" style={{ fontWeight: 500, display: "block" }}>{u.name}</Link>
                    <div className="mono fntc" style={{ fontSize: 11 }}>{u.macros.calories} kcal · {F(u.price)}</div>
                  </div>
                  <button className="qbtn" onClick={() => quickAdd(u)} aria-label={`Add ${u.name}`}><i className="ph-bold ph-plus" /></button>
                </div>
              ))}
            </div>
          )}

          {/* Suggested pairing */}
          {pairing && (
            <div className="padx mt10">
              <div className="lab mb6">Suggested pairing</div>
              <Link className="fx ac gap12" to={`/dish/${pairing.slug}`} style={{ padding: "9px 0", borderTop: "1px solid var(--ln)" }}>
                <img src={pairing.image} alt={pairing.name} style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover" }} />
                <div className="f1" style={{ minWidth: 0 }}>
                  <div className="small clamp1" style={{ fontWeight: 500 }}>{pairing.name}</div>
                  <div className="mono fntc" style={{ fontSize: 10.5 }}>Adds {pairing.macros.protein}g protein · {pairing.macros.calories} kcal</div>
                </div>
                <span className="price" style={{ fontSize: 13, color: "var(--safb)" }}>+{F(pairing.price)}</span>
              </Link>
            </div>
          )}

          <div style={{ height: 16 }} />
        </div>

        {/* Sticky CTA */}
        <div className="dock">
          <div className="fx ac jb gap12">
            <div style={{ flex: "none" }}>
              <div className="lab">Total</div>
              <div className="price" style={{ fontSize: 19, color: "var(--safb)" }}>{F(calculatedTotal)}</div>
            </div>
            <div className="fx ac gap12">
              {!(isPremiumOnly && !isPremium) && (
                <div className="fx ac gap10">
                  <button className="qbtn" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Decrease quantity"><i className="ph-bold ph-minus" /></button>
                  <span className="mono" style={{ fontSize: 16, fontWeight: 600, width: 20, textAlign: "center" }}>{quantity}</span>
                  <button className="qbtn" onClick={() => setQuantity((q) => q + 1)} aria-label="Increase quantity"><i className="ph-bold ph-plus" /></button>
                </div>
              )}
              {isPremiumOnly && !isPremium ? (
                <button className="btn btn-g btn-lg" onClick={() => navigate("/premium")}><i className="ph-bold ph-crown" /> Premium only</button>
              ) : (
                <button className="btn btn-p btn-lg" onClick={handleAddToOrder}><i className="ph-bold ph-shopping-cart-simple" /> Add to order</button>
              )}
            </div>
          </div>
          {!isLive && <div className="fine tc mt6" style={{ fontSize: 10 }}>Offline mode — displaying cached prices</div>}
        </div>
      </div>
    </div>
  );
}

function TargetRow({ label, val, target, unit = "", pct = false }: any) {
  const p = Math.round((val / target) * 100);
  return (
    <div className="fx ac jb">
      <span className="fine">{label}</span>
      <span className="mono" style={{ fontSize: 12 }}>
        {val}{unit} / <span className="fntc">{target}{unit}</span>
        {pct && <span style={{ color: "var(--safb)" }}> ({p}%)</span>}
      </span>
    </div>
  );
}

/* ---- Reviews: same endpoints as the original DishReviews, v2 markup ---- */
async function fj<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text().catch(() => "")) || res.statusText}`);
  return res.json() as Promise<T>;
}
function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const day = Math.floor(diff / 86_400_000);
  if (day < 1) { const hr = Math.floor(diff / 3_600_000); return hr < 1 ? "just now" : `${hr}h ago`; }
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  return mo < 12 ? `${mo}mo ago` : `${Math.floor(mo / 12)}y ago`;
}
function Stars({ value, onChange, size = 14 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <span className="fx ac" style={{ gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} onClick={() => onChange?.(n)} aria-label={`${n} star${n === 1 ? "" : "s"}`}>
          <i className={n <= value ? "ph-fill ph-star" : "ph-bold ph-star"} style={{ fontSize: size, color: n <= value ? "var(--safb)" : "var(--fnt)" }} />
        </button>
      ))}
    </span>
  );
}
function V2Reviews({ slug }: { slug: string }) {
  const qc = useQueryClient();
  const auth = useQuery<any>({ queryKey: ["auth", "user"], queryFn: () => fj(`/auth/user`), staleTime: 300_000 });
  const isLoggedIn = !!auth.data?.user?.id;
  const data = useQuery<any>({
    queryKey: ["dish-reviews", slug, auth.data?.user?.id ?? null],
    queryFn: () => fj(`/dish-reviews/${encodeURIComponent(slug)}`),
    staleTime: 30_000,
  });
  const hasOrdered = !!data.data?.eligibleToReview;
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const submit = useMutation({
    mutationFn: () => fj(`/dish-reviews`, { method: "POST", body: JSON.stringify({ slug, rating, body: body.trim() }) }),
    onSuccess: () => { toast.success("Thanks for your review"); setRating(0); setBody(""); qc.invalidateQueries({ queryKey: ["dish-reviews", slug] }); },
    onError: (e: any) => toast.error(e?.message || "Could not submit review"),
  });
  const reviews: any[] = data.data?.reviews ?? [];
  const summary: any = data.data?.summary ?? null;
  const canReview = isLoggedIn && hasOrdered;

  return (
    <div>
      <div className="fx ac jb mb10">
        <span className="sh"><i className="ph-bold ph-chat-circle-dots" /> Customer reviews</span>
        {summary && (
          <span className="pill"><i className="ph-fill ph-star" style={{ color: "var(--safb)" }} />{(summary.averageRating / 10).toFixed(1)} · {summary.sampleSize}</span>
        )}
      </div>

      {summary && (summary.mostLoved || summary.commonGripe) && (
        <div className="card mb10">
          <div className="lab mb6">What customers say · <span style={{ textTransform: "capitalize" }}>{summary.trend}</span></div>
          {summary.mostLoved && <div className="fine mt2"><span style={{ color: "var(--sage)" }}>Loved:</span> {summary.mostLoved}</div>}
          {summary.commonGripe && <div className="fine mt2"><span style={{ color: "var(--safb)" }}>Gripe:</span> {summary.commonGripe}</div>}
        </div>
      )}

      {canReview ? (
        <div className="card mb10">
          <div className="fx ac gap12 mb6"><span className="small fw6">Leave a review</span><Stars value={rating} onChange={setRating} size={20} /></div>
          <textarea
            className="w100"
            placeholder="Tell other customers what you thought (optional)"
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 2000))}
            rows={3}
            style={{ background: "var(--s2)", border: "1px solid var(--ln2)", borderRadius: 10, padding: 10, color: "var(--tx)", fontSize: 13.5, resize: "vertical", outline: "none" }}
          />
          <div className="fx ac jb mt6">
            <span className="fine">{body.length}/2000</span>
            <button className="btn btn-p" style={{ height: 38 }} disabled={rating < 1 || submit.isPending} onClick={() => submit.mutate()}>
              {submit.isPending ? "Posting…" : "Post review"}
            </button>
          </div>
        </div>
      ) : (
        <div className="fine mb10">{isLoggedIn ? "Order this dish once to leave a review." : "Log in and order this dish to leave a review."}</div>
      )}

      {reviews.length > 0 ? (
        reviews.slice(0, 5).map((r: any) => (
          <div key={r.id} style={{ padding: "10px 0", borderTop: "1px solid var(--ln)" }}>
            <div className="fx ac gap8">
              <span className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                {(r.reviewer?.label || "?").split(/\s+/).filter(Boolean).map((p: string) => p[0]).slice(0, 2).join("").toUpperCase()}
              </span>
              <div className="f1" style={{ minWidth: 0 }}>
                <div className="small clamp1" style={{ fontWeight: 500 }}>{r.reviewer?.label}</div>
                <div className="fx ac gap8"><Stars value={r.rating} size={11} /><span className="mono fntc" style={{ fontSize: 10 }}>{relTime(r.createdAt)}</span></div>
              </div>
            </div>
            {r.body && <div className="fine mt6">{r.body}</div>}
            {r.photoUrl && <img src={r.photoUrl} alt="Reviewer" loading="lazy" style={{ marginTop: 6, borderRadius: 10, maxHeight: 160, border: "1px solid var(--ln)" }} />}
          </div>
        ))
      ) : (
        <div className="fine">No reviews yet — be the first to share your experience.</div>
      )}
    </div>
  );
}
