import { useMemo } from "react";
import { Link } from "react-router";
import { unsplashSrcset } from "@/lib/imgSrcset";
import { onDishImageError } from "@/lib/imgFallback";
import { motion } from "framer-motion";
import { Sparkle } from "@phosphor-icons/react";
import {
  AlertTriangle,
  Crown,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/api/adapter";
import {
  CATEGORY_LABELS,
  type DishData,
  useMenuCatalog,
} from "@/lib/menuData";
import { clinicalCategoryLabel, useClinicalMode } from "@/lib/clinicalDiet";
import type { DishMatchResult } from "@/lib/preferencesMatch";
import type { UserPreferences } from "@/lib/preferencesApi";
import { useCart } from "@/lib/cartContext";
import { cn } from "@/lib/utils";

type MenuCardProps = {
  item: DishData;
  match: DishMatchResult;
  index: number;
  isPremium: boolean;
  premiumSlugs: Set<string>;
  preferences: UserPreferences | null;
  lifestyleTag: string | null;
  hasSavedAddress?: boolean;
  hasVariants?: boolean;
  onQuickAdd: (e: React.MouseEvent, item: DishData) => void;
  onExpressBuy?: (item: DishData) => void;
  onPremiumGate: () => void;
};

export default function MenuCard({
  item,
  match,
  index,
  isPremium,
  premiumSlugs,
  preferences,
  lifestyleTag,
  hasSavedAddress = false,
  hasVariants = false,
  onQuickAdd,
  onExpressBuy,
  onPremiumGate,
}: MenuCardProps) {
  const { items, updateQty } = useCart();
  const cartItem = items.find((it) => it.dishId === item.id);

  const familyCartCount = useMemo(() => {
    if (!hasVariants) return 0;
    const baseSlug = item.slug.replace(/-(veg|chicken|prawns|white-bread|brown-bread)$/, "");
    return items
      .filter((it) => it.slug.startsWith(baseSlug))
      .reduce((sum, it) => sum + it.quantity, 0);
  }, [items, item.slug, hasVariants]);
  const isPremiumOnly = premiumSlugs.has(item.slug);
  const showPremiumGate = isPremiumOnly && !isPremium;
  const { enabled: clinicalMode } = useClinicalMode();
  const { isLive } = useMenuCatalog();
  // In clinical mode the body line under each card swaps the consumer
  // category label ("Power Bowls") for EHR vocabulary ("Composite plate")
  // and drops the kitchen brand entirely so the card reads like a tray.
  const categoryLine = clinicalMode
    ? clinicalCategoryLabel(item.category, CATEGORY_LABELS[item.category])
    : `${CATEGORY_LABELS[item.category]} · ${item.kitchen}`;

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.04 }}
      whileHover={{ y: -4 }}
      className={`group relative flex flex-row sm:flex-col rounded-2xl overflow-hidden bg-clinical-surface-elevated border border-clinical-border hover:border-clinical-gold/50 hover:shadow-[0_8px_30px_rgba(244,196,48,0.12)] transition-all duration-300 ${
        !item.isAvailable ? "opacity-50 grayscale" : ""
      } ${match.blocked ? "ring-1 ring-orange-500/40" : ""}`}
    >
      {/* Image — square thumbnail on mobile, 4:3 full-width on sm+ */}
      <Link to={`/dish/${item.slug}`} className="relative shrink-0 w-28 aspect-square sm:w-full sm:aspect-[4/3] overflow-hidden block">
        <img
          src={item.image}
          srcSet={unsplashSrcset(item.image)}
          sizes="(max-width: 640px) 112px, (max-width: 1024px) calc(50vw - 1.5rem), 25vw"
          alt={item.name}
          loading="lazy"
          onError={onDishImageError}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {/* Gradient fade only meaningful in vertical (sm+) card layout */}
        <div className="hidden sm:block absolute inset-0 bg-gradient-to-t from-clinical-surface-elevated via-clinical-surface-elevated/30 to-transparent z-10" />

        {/* Sparkle hover flourish */}
        <motion.div
          className="absolute top-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity"
          initial={{ scale: 0 }}
          whileHover={{ scale: 1, rotate: 12 }}
          aria-hidden="true"
        >
          <Sparkle weight="fill" className="w-3.5 h-3.5 text-clinical-gold drop-shadow-[0_0_6px_rgba(244,196,48,0.6)]" />
        </motion.div>

        {/* Top-left: sophisticated modern pill-badges + RD + premium */}
        <div className="absolute top-3 left-3 z-20 flex gap-1.5 items-center flex-wrap">
          <span
            className={`px-2 py-0.5 rounded-full border flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-wider bg-clinical-dark/90 backdrop-blur-md shadow-sm ${
              item.isVeg ? "alert-safe-border alert-safe-text" : "alert-allergen-border alert-allergen-text"
            }`}
            title={item.isVeg ? "100% Vegetarian" : "Non-vegetarian"}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                item.isVeg ? "bg-[var(--color-alert-safe)] shadow-[0_0_6px_rgba(74,222,128,0.8)]" : "bg-[var(--color-alert-allergen)] shadow-[0_0_6px_rgba(255,107,107,0.8)]"
              }`}
            />
            {item.isVeg ? "VEG" : "NON-VEG"}
          </span>
          {item.rdVerified && (
            <span className="text-[9px] px-2 py-0.5 rounded-full border alert-safe-border alert-safe-text bg-clinical-dark/90 backdrop-blur-md font-extrabold tracking-wider uppercase shadow-sm">
              ★ RD Verified
            </span>
          )}
          {isPremiumOnly && (
            <span className="text-[9px] px-1.5 py-0.5 rounded border border-clinical-gold/50 text-clinical-gold bg-clinical-dark/80 backdrop-blur-sm font-bold tracking-wider uppercase flex items-center gap-1">
              <Crown className="w-2.5 h-2.5" /> Premium
            </span>
          )}
          {match.blocked ? (
            <span className="text-[9px] px-1.5 py-0.5 rounded border border-red-500 text-red-400 bg-clinical-dark/95 backdrop-blur-sm font-extrabold tracking-wider uppercase flex items-center gap-1 shadow-[0_0_8px_color-mix(in_srgb,var(--color-error)_50%,transparent)]">
              <ShieldAlert className="w-3.5 h-3.5 text-red-400" /> Blocked
            </span>
          ) : match.warnings.length > 0 ? (
            <span className="text-[9px] px-1.5 py-0.5 rounded border border-orange-500/50 text-orange-400 bg-clinical-dark/85 backdrop-blur-sm font-bold tracking-wider uppercase flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" /> Warning
            </span>
          ) : null}
        </div>

        {/* Lifestyle tag (only when no premium overlay would conflict) */}
        {lifestyleTag && !showPremiumGate && (
          <div className="absolute top-3 right-3 z-10">
            <span className="text-[9px] px-2 py-1 rounded border border-clinical-gold/40 text-clinical-gold bg-clinical-dark/70 backdrop-blur-sm font-bold tracking-[0.12em] uppercase">
              {lifestyleTag}
            </span>
          </div>
        )}
      </Link>

      {/* Content — compact on mobile (horizontal card), full on sm+ (vertical card) */}
      <div className="relative z-20 sm:-mt-10 flex-1 flex flex-col p-3 sm:p-5 gap-1.5 sm:gap-2.5 min-w-0">
        <div className="flex justify-between items-start gap-2">
          <Link to={`/dish/${item.slug}`} className="hover:underline flex-1 min-w-0">
            <h3 className="font-serif text-sm sm:text-lg font-medium leading-tight text-white hover:text-clinical-gold transition-colors">
              {item.name}
            </h3>
          </Link>
          <div className="flex flex-col items-end shrink-0">
            <span className="font-serif text-sm sm:text-lg font-medium text-clinical-gold tabular-nums">
              {hasVariants ? "from " : ""}{formatPrice(item.price)}
            </span>
            {!isLive && (
              <span className="text-[9px] text-amber-400/70">Price may vary</span>
            )}
          </div>
        </div>
        {item.averageRating != null && (item.reviewCount ?? 0) >= 5 && (
          <div className="hidden sm:flex items-center gap-1.5">
            <StarRating value={item.averageRating} />
            <span className="text-[10px] text-clinical-zinc">
              {item.averageRating.toFixed(1)} · {item.reviewCount} reviews
            </span>
          </div>
        )}
        <p className="text-[11px] sm:text-xs text-clinical-zinc/80 line-clamp-1 sm:line-clamp-2 leading-relaxed">
          {item.description}
        </p>

        {/* Macro readout band (dashed top+bottom hairline) */}
        {(() => {
          const proteinCalories = item.macros.protein * 4;
          const carbsCalories = item.macros.carbs * 4;
          const fatCalories = item.macros.fat * 9;
          const totalMacroCalories = proteinCalories + carbsCalories + fatCalories || 1;
          const proteinPct = Math.round((proteinCalories / totalMacroCalories) * 100);
          const carbsPct = Math.round((carbsCalories / totalMacroCalories) * 100);
          const fatPct = Math.round((fatCalories / totalMacroCalories) * 100);

          return (
            <div className="my-3.5 flex gap-4 border-y border-dashed border-clinical-border/40 py-2.5 font-mono text-clinical-data text-white">
              <div className="flex flex-col">
                <span className="text-[12.5px] font-semibold">{item.macros.calories}</span>
                <span className="text-[9px] tracking-wider text-clinical-zinc uppercase">Kcal</span>
              </div>
              <div className="flex flex-1 flex-col">
                <span className="text-[12.5px] font-semibold">{item.macros.protein}g</span>
                <span className="text-[9px] tracking-wider text-clinical-zinc uppercase">Prot {proteinPct}%</span>
                <span className="mt-0.5 h-[3px] rounded-sm bg-macro-protein" style={{ width: `${proteinPct}%` }} />
              </div>
              <div className="flex flex-1 flex-col">
                <span className="text-[12.5px] font-semibold">{item.macros.carbs}g</span>
                <span className="text-[9px] tracking-wider text-clinical-zinc uppercase">Carb {carbsPct}%</span>
                <span className="mt-0.5 h-[3px] rounded-sm bg-macro-carbs" style={{ width: `${carbsPct}%` }} />
              </div>
              <div className="flex flex-1 flex-col">
                <span className="text-[12.5px] font-semibold">{item.macros.fat}g</span>
                <span className="text-[9px] tracking-wider text-clinical-zinc uppercase">Fat {fatPct}%</span>
                <span className="mt-0.5 h-[3px] rounded-sm bg-macro-fat" style={{ width: `${fatPct}%` }} />
              </div>
            </div>
          );
        })()}

        <div className="hidden sm:flex text-[9px] uppercase tracking-[0.12em] text-clinical-zinc/60 font-semibold items-center gap-1.5 flex-wrap">
          <span>{categoryLine}</span>
          <span>·</span>
          <span className={cn(
            "font-bold",
            item.glycaemicIndex === "low" && "text-clinical-sage",
            item.glycaemicIndex === "medium" && "text-amber-400",
            item.glycaemicIndex === "high" && "text-red-400"
          )}>
            GI: {item.glycaemicIndex.toUpperCase()}
          </span>
        </div>

        <div className="mt-auto pt-1 sm:pt-2 flex gap-1.5 sm:gap-2">
          <Link to={`/dish/${item.slug}`} className="flex-1">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-11 sm:h-10 border border-border bg-transparent text-text-secondary hover:bg-surface-raised hover:text-text-primary hover:border-border-strong text-[10px] sm:text-[11px] uppercase tracking-[0.12em] font-semibold"
            >
              Details
            </Button>
          </Link>
          {showPremiumGate ? (
            <Button
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onPremiumGate();
              }}
              className="flex-1 h-11 sm:h-10 bg-clinical-gold/10 border border-clinical-gold/50 text-clinical-gold hover:bg-clinical-gold/20 text-[10px] sm:text-[11px] uppercase tracking-[0.12em] font-bold gap-1"
            >
              <Crown className="w-3 h-3" />
              Upgrade to Premium
            </Button>
          ) : cartItem && !hasVariants ? (
            <div className="flex-1 flex items-center justify-between min-h-[44px] sm:min-h-[40px] rounded-xl border border-clinical-gold bg-clinical-gold px-2 text-action-text font-sans text-xs font-extrabold shadow-[0_4px_15px] shadow-clinical-gold/35 transition-all duration-200">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  updateQty(cartItem.lineId, -1);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/15 active:scale-90 transition-all text-base font-black"
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="font-mono tabular-nums text-sm font-black">{cartItem.quantity}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  updateQty(cartItem.lineId, 1);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/15 active:scale-90 transition-all text-base font-black"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          ) : (
            <div className="flex-1 flex gap-1.5 min-w-0">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onQuickAdd(e, item);
                }}
                disabled={!item.isAvailable || !isLive || match.blocked}
                title={match.blocked ? "Cannot add dish: Allergen/Contraindication conflict" : !isLive ? "Menu is updating — add to cart will be available shortly" : undefined}
                className="flex-1 h-11 sm:h-10 rounded-xl border border-clinical-gold bg-clinical-gold/10 hover:bg-clinical-gold/25 text-clinical-gold px-3 py-2 font-sans text-xs font-extrabold uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(244,196,48,0.15)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed truncate flex items-center justify-center gap-1"
              >
                <span className="text-sm font-black leading-none" aria-hidden="true">+</span> ADD{familyCartCount > 0 ? ` (${familyCartCount})` : ""}
              </button>
              {hasSavedAddress && preferences && !hasVariants && (
                <button
                  type="button"
                  disabled={!item.isAvailable || !isLive || match.blocked}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onExpressBuy?.(item);
                  }}
                  className="flex-1 h-11 sm:h-10 rounded-xl bg-clinical-gold text-action-text hover:bg-clinical-gold/90 text-[10px] sm:text-[11px] uppercase tracking-[0.08em] font-extrabold px-2 shadow-[0_4px_12px] shadow-clinical-gold/30 active:scale-95 transition-all truncate disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Buy Now
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {!item.isAvailable && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 pointer-events-none">
          <span className="text-xs flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 font-semibold">
            <AlertTriangle className="w-3 h-3" />
            Out of Stock
          </span>
        </div>
      )}
    </motion.article>
  );
}



function StarRating({ value }: { value: number }) {
  const full = Math.floor(value);
  const half = value - full >= 0.4;
  return (
    <div className="flex items-center gap-0.5" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} className="w-3 h-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          {i <= full ? (
            <path d="M6 1l1.4 2.9 3.2.5-2.3 2.2.5 3.2L6 8.3 3.2 9.8l.5-3.2L1.4 4.4l3.2-.5z" fill="var(--color-clinical-gold)" />
          ) : i === full + 1 && half ? (
            <>
              <path d="M6 1l1.4 2.9 3.2.5-2.3 2.2.5 3.2L6 8.3V1z" fill="var(--color-clinical-gold)" />
              <path d="M6 1v7.3L3.2 9.8l.5-3.2L1.4 4.4l3.2-.5z" fill="var(--color-clinical-slate)" />
            </>
          ) : (
            <path d="M6 1l1.4 2.9 3.2.5-2.3 2.2.5 3.2L6 8.3 3.2 9.8l.5-3.2L1.4 4.4l3.2-.5z" fill="var(--color-clinical-slate)" />
          )}
        </svg>
      ))}
    </div>
  );
}

