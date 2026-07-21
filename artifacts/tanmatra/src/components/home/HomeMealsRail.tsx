import { useMemo } from "react";
import { Link } from "react-router";
import { useMenuCatalog, type DishData } from "@/lib/menuData";
import { localDishSrcset, getLocalDishFallback } from "@/lib/imgSrcset";
import { onDishImageError } from "@/lib/imgFallback";

export default function HomeMealsRail() {
  const { dishes: catalogDishes } = useMenuCatalog();

  // Filter for available, dietitian-verified dishes. Exclude secondary variants to avoid duplicate main courses.
  const dietitianDishes = useMemo(() => {
    return catalogDishes
      .filter(
        (d: any) =>
          d.isAvailable &&
          d.rdVerified &&
          !d.slug.endsWith("-veg") &&
          !d.slug.endsWith("-chicken") &&
          !d.slug.endsWith("-prawns")
      )
      .slice(0, 6);
  }, [catalogDishes]);

  if (dietitianDishes.length === 0) return null;

  return (
    <section id="dietitian-meals" className="padx mt-10">
      <div className="secrow px-0">
        <span className="sh text-base font-bold text-white/95">Dietitian-selected meals</span>
        <Link to="/menu" className="fine text-xs text-[var(--tnm-action)] hover:underline">
          View All
        </Link>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none snap-x snap-mandatory">
        {dietitianDishes.map((dish) => (
          <DishSwipeCard key={dish.id} dish={dish} />
        ))}
      </div>
    </section>
  );
}

function DishSwipeCard({ dish }: { dish: DishData }) {
  // Determine at most 2 badges to display.
  // Badge 1: Veg / Non-Veg (Veg is green/sage, Non-Veg is neutral)
  // Badge 2: Low-GI / RD-Reviewed (neutral gray)
  const badges = useMemo(() => {
    const list = [];
    // Veg badge is colored using sage
    if (dish.isVeg) {
      list.push(
        <span
          key="veg"
          className="text-[9px] px-1.5 py-0.5 rounded-full font-extrabold uppercase tracking-wide bg-[var(--color-alert-safe-bg)] text-[var(--color-alert-safe-text)] border border-[var(--color-alert-safe-border)] flex items-center gap-1"
        >
          <span className="w-1 h-1 rounded-full bg-[var(--color-alert-safe)] shadow-[0_0_4px_rgba(74,222,128,0.8)]" />
          Veg
        </span>
      );
    } else {
      list.push(
        <span
          key="non-veg"
          className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide bg-white/10 text-white/80"
        >
          Non-Veg
        </span>
      );
    }

    return list.slice(0, 2); // Cap at 2 badges
  }, [dish]);

  // Derive tabular numbers macro values line
  const macrosLine = useMemo(() => {
    if (!dish.macros) return null;
    const { calories, protein, carbs, fat } = dish.macros;
    return (
      <div className="tnm-data text-[10px] text-white/50 tracking-wide font-mono flex items-center gap-1 mt-2.5">
        <span>{calories} kcal</span>
        <span className="text-white/20">·</span>
        <span>{protein}g P</span>
        <span className="text-white/20">·</span>
        <span>{carbs}g C</span>
        <span className="text-white/20">·</span>
        <span>{fat}g F</span>
      </div>
    );
  }, [dish.macros]);

  // Pre-assessment fallback tag for "Why this fits" copy
  const suitabilityText = useMemo(() => {
    if (dish.macros && dish.macros.protein >= 28) return "High-protein recovery pick";
    if (dish.category === "bowls") return "Fiber-rich balanced bowl";
    return "Dietitian-approved formula";
  }, [dish.macros, dish.category]);

  return (
    <div
      className="snap-start shrink-0 w-[250px] p-2.5 rounded-2xl bg-neutral-900/80 border border-white/[0.06] backdrop-blur-xl flex flex-col justify-between shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all duration-300 hover:border-white/10 group"
    >
      <div>
        <Link to={`/dish/${dish.slug}`} className="relative aspect-[4/3] rounded-xl overflow-hidden block border border-white/[0.06]">
          <picture>
            <source srcSet={localDishSrcset(dish.image, "avif")} type="image/avif" />
            <source srcSet={localDishSrcset(dish.image, "webp")} type="image/webp" />
            <img
              src={getLocalDishFallback(dish.image, 400)}
              srcSet={localDishSrcset(dish.image, "jpg")}
              sizes="240px"
              alt={dish.name}
              loading="lazy"
              decoding="async"
              onError={onDishImageError}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
            />
          </picture>
          {/* Badge overlays */}
          <div className="absolute top-2 left-2 flex gap-1 items-center flex-wrap z-10">
            {badges}
          </div>
        </Link>

        <div className="mt-3 px-1">
          <Link to={`/dish/${dish.slug}`} className="block">
            <h4 className="text-sm font-semibold tracking-tight text-white/95 leading-snug clamp2 group-hover:text-amber-400 transition-colors">
              {dish.name}
            </h4>
          </Link>
          {macrosLine}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-white/[0.06] flex flex-col gap-2.5 px-1 pb-1">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-white/45 font-medium">{suitabilityText}</span>
        </div>
        <Link
          to={`/dish/${dish.slug}`}
          className="w-full min-h-[38px] rounded-xl bg-white/5 hover:bg-white/10 border border-white/[0.06] text-center text-xs font-semibold text-white/90 flex items-center justify-center active:scale-[0.98] transition-transform duration-200"
        >
          View Details
        </Link>
      </div>
    </div>
  );
}
