
import { Link } from "react-router";
import { unsplashSrcset } from "@/lib/imgSrcset";
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
  onQuickAdd,
  onExpressBuy,
  onPremiumGate,
}: MenuCardProps) {
  const { items, updateQty } = useCart();
  const cartItem = items.find((it) => it.dishId === item.id);
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
      className={`group relative flex flex-row sm:flex-col rounded-2xl overflow-hidden bg-clinical-surface-elevated border border-clinical-border hover:border-clinical-gold/50 hover:shadow-[0_8px_30px_rgba(212,175,55,0.12)] transition-all duration-300 ${
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
          <Sparkle weight="fill" className="w-3.5 h-3.5 text-clinical-gold drop-shadow-[0_0_6px_rgba(212,175,55,0.6)]" />
        </motion.div>

        {/* Top-left: veg dot + RD + premium */}
        <div className="absolute top-3 left-3 z-20 flex gap-1.5 items-center">
          <span
            className={`w-3.5 h-3.5 rounded-sm border-2 flex items-center justify-center bg-[#050505]/80 ${
              item.isVeg ? "border-green-500" : "border-red-500"
            }`}
            title={item.isVeg ? "Vegetarian" : "Non-vegetarian"}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                item.isVeg ? "bg-green-500" : "bg-red-500"
              }`}
            />
          </span>
          {item.rdVerified && (
            <span className="text-[9px] px-1.5 py-0.5 rounded border border-clinical-sage/40 text-clinical-sage bg-clinical-sage/10 backdrop-blur-sm font-semibold tracking-wider uppercase">
              RD Verified
            </span>
          )}
          {isPremiumOnly && (
            <span className="text-[9px] px-1.5 py-0.5 rounded border border-clinical-gold/50 text-clinical-gold bg-[#050505]/80 backdrop-blur-sm font-bold tracking-wider uppercase flex items-center gap-1">
              <Crown className="w-2.5 h-2.5" /> Premium
            </span>
          )}
          {match.warnings.length > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded border border-orange-500/50 text-orange-400 bg-[#050505]/85 backdrop-blur-sm font-bold tracking-wider uppercase flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" /> Warning
            </span>
          )}
        </div>

        {/* Lifestyle tag (only when no premium overlay would conflict) */}
        {lifestyleTag && !showPremiumGate && (
          <div className="absolute top-3 right-3 z-10">
            <span className="text-[9px] px-2 py-1 rounded border border-clinical-gold/40 text-clinical-gold bg-[#050505]/70 backdrop-blur-sm font-bold tracking-[0.12em] uppercase">
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
              {formatPrice(item.price)}
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
        <div className="my-1.5 flex gap-3 border-y border-dashed border-clinical-border/40 py-1.5 font-mono text-[11px] text-clinical-zinc">
          <span className="font-semibold text-white">{item.macros.calories} Kcal</span>
          <span>·</span>
          <span>{item.macros.protein}g P</span>
          <span>·</span>
          <span>{item.macros.carbs}g C</span>
          <span>·</span>
          <span>{item.macros.fat}g F</span>
        </div>

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
          ) : cartItem ? (
            <div className="flex-1 flex items-center justify-between min-h-[44px] sm:min-h-[40px] rounded-btn border border-sage-300 dark:border-sage-700 bg-sage-100/60 dark:bg-sage-950/40 px-2 text-sage-800 dark:text-sage-300 font-sans text-[13px] font-semibold transition-all duration-200">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  updateQty(cartItem.lineId, -1);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-sage-200 dark:hover:bg-sage-900/60 active:scale-90 transition-all text-lg font-bold"
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="font-mono tabular-nums text-sm font-bold">{cartItem.quantity}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  updateQty(cartItem.lineId, 1);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-sage-200 dark:hover:bg-sage-900/60 active:scale-90 transition-all text-lg font-bold"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          ) : (
            <div className="flex-1 flex gap-1 min-w-0">
              <Button
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onQuickAdd(e, item);
                }}
                disabled={!item.isAvailable || !isLive}
                title={!isLive ? "Menu is updating — add to cart will be available shortly" : undefined}
                className="flex-1 h-11 sm:h-10 border border-border bg-surface-raised px-2 py-2 font-sans text-xs font-semibold text-text-primary transition hover:border-saffron-700 hover:bg-saffron-50 dark:hover:bg-saffron-400/10 active:scale-95 active:bg-action active:text-action-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action shadow-sm truncate"
              >
                <span aria-hidden="true">+</span> Add
              </Button>
              {hasSavedAddress && preferences && (
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onExpressBuy?.(item);
                  }}
                  className="flex-1 h-11 sm:h-10 bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90 text-[10px] sm:text-[11px] uppercase tracking-[0.08em] font-bold px-2 truncate"
                >
                  Buy Now
                </Button>
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
            <path d="M6 1l1.4 2.9 3.2.5-2.3 2.2.5 3.2L6 8.3 3.2 9.8l.5-3.2L1.4 4.4l3.2-.5z" fill="#D4AF37" />
          ) : i === full + 1 && half ? (
            <>
              <path d="M6 1l1.4 2.9 3.2.5-2.3 2.2.5 3.2L6 8.3V1z" fill="#D4AF37" />
              <path d="M6 1v7.3L3.2 9.8l.5-3.2L1.4 4.4l3.2-.5z" fill="#3a3a3a" />
            </>
          ) : (
            <path d="M6 1l1.4 2.9 3.2.5-2.3 2.2.5 3.2L6 8.3 3.2 9.8l.5-3.2L1.4 4.4l3.2-.5z" fill="#3a3a3a" />
          )}
        </svg>
      ))}
    </div>
  );
}


