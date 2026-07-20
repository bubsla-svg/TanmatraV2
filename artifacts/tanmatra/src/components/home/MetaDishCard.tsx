import { Link } from "react-router";
import { F } from "@/tanmatra-v2/data";
import { macrosAreProvisional, type DishData } from "@/lib/menuData";
import { FREE_DELIVERY_THRESHOLD } from "@/lib/cartContext";
import { localDishSrcset, unsplashSrcset, getLocalDishFallback } from "@/lib/imgSrcset";
import { onDishImageError } from "@/lib/imgFallback";
import { DELIVERY_ETA_TEXT } from "@/lib/deliveryPromise";

/* Viewport 5 — Zomato-style meta card.
 * Cropped image (fixed height → CLS-safe) with a corner veg/non-veg dot. Real
 * delivery meta. Macro bar respects macrosAreProvisional — provisional dishes
 * never show fabricated numbers. The [ + ADD ] button reuses the caller's cart
 * handler. */

export default function MetaDishCard({
  dish,
  onAdd,
}: {
  dish: DishData;
  onAdd: (dish: DishData) => void;
}) {
  const provisional = macrosAreProvisional(dish);
  const m = dish.macros;
  const srcset = localDishSrcset(dish.image) ?? unsplashSrcset(dish.image);

  return (
    <div className="p-1.5 rounded-[2rem] bg-white/[0.04] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-white/20 hover:shadow-[0_12px_40px_rgba(0,0,0,0.6)] group">
      <div className="rounded-[calc(2rem-0.375rem)] bg-gradient-to-b from-[var(--tnm-surface-ink-2)] to-black/80 border border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] overflow-hidden flex flex-col justify-between h-full">
        <div>
          <Link to={`/dish/${dish.slug}`} aria-label={dish.name} className="relative block h-48 w-full overflow-hidden">
            <img
              src={getLocalDishFallback(dish.image, 400)}
              srcSet={srcset}
              sizes="(max-width: 480px) 100vw, (max-width: 1024px) 50vw, 33vw"
              alt={dish.name}
              loading="lazy"
              decoding="async"
              onError={onDishImageError}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
            />
            <span className={dish.isVeg ? "mcard-vd" : "mcard-vd nv"} aria-label={dish.isVeg ? "Veg" : "Non-veg"} />
          </Link>

          <div className="p-5">
            <Link to={`/dish/${dish.slug}`} className="text-base font-bold text-white group-hover:text-[var(--tnm-action)] transition-colors line-clamp-1">
              {dish.name}
            </Link>

            <div className="mt-2 flex items-center gap-2 text-xs text-white/60">
              <span className="flex items-center gap-1"><i className="ph-bold ph-clock text-[var(--tnm-action)]" /> {DELIVERY_ETA_TEXT}</span>
              <span className="text-white/30">·</span>
              <span className="flex items-center gap-1"><i className="ph-bold ph-package text-[var(--tnm-action)]" /> Free &gt; {F(FREE_DELIVERY_THRESHOLD)}</span>
            </div>

            <div className="mt-3.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-white/70">
              {provisional ? (
                <span className="text-amber-300 flex items-center gap-1 font-medium"><i className="ph-bold ph-flask" /> Macros being verified</span>
              ) : (
                <div className="flex items-center justify-between font-medium">
                  <span><b className="text-white font-bold">{m.calories}</b> kcal</span>
                  <span className="text-white/30">|</span>
                  <span>P <b className="text-white font-bold">{m.protein}g</b></span>
                  <span className="text-white/30">|</span>
                  <span>C <b className="text-white font-bold">{m.carbs}g</b></span>
                  <span className="text-white/30">|</span>
                  <span>F <b className="text-white font-bold">{m.fat}g</b></span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 pt-0 flex items-center justify-between border-t border-white/5 mt-2">
          <span className="text-lg font-extrabold text-[var(--tnm-action)] tracking-tight">{F(dish.price)}</span>
          <button
            type="button"
            onClick={() => onAdd(dish)}
            aria-label={`Add ${dish.name}`}
            className="px-4 py-2 rounded-full bg-[var(--tnm-action)] text-black text-xs font-bold hover:brightness-110 active:scale-95 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] flex items-center gap-1.5 shadow-[0_4px_16px_rgba(251,191,36,0.2)]"
          >
            <i className="ph-bold ph-plus text-xs" />
            <span>ADD</span>
          </button>
        </div>
      </div>
    </div>
  );
}
