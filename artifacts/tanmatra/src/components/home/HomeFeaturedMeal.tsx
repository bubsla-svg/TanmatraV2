import { useMemo } from "react";
import { Link } from "react-router";
import { Plus } from "@phosphor-icons/react";
import { useMenuCatalog } from "@/lib/menuData";
import { onDishImageError } from "@/lib/imgFallback";
import { localDishSrcset, getLocalDishFallback } from "@/lib/imgSrcset";

/**
 * Full-width teaser card showing one dietitian-verified dish.
 * Uses first available dish from the catalog — no hardcoded copy.
 */
export default function HomeFeaturedMeal() {
  const { dishes } = useMenuCatalog();

  const featured = useMemo(() => {
    return dishes.find(
      (d: any) =>
        d.isAvailable &&
        d.rdVerified &&
        d.image &&
        !d.slug.endsWith("-veg") &&
        !d.slug.endsWith("-chicken")
    ) ?? null;
  }, [dishes]);

  if (!featured) return null;

  const macroLine = featured.macros
    ? `${featured.macros.calories} kcal · ${featured.macros.protein}g protein`
    : null;

  return (
    <section className="padx mt-6">
      <Link
        to={`/dish/${featured.slug}`}
        className="relative block h-60 rounded-2xl overflow-hidden group"
        aria-label={`View ${featured.name}`}
      >
        {/* Food photo */}
        <picture>
          <source srcSet={localDishSrcset(featured.image, "avif")} type="image/avif" />
          <source srcSet={localDishSrcset(featured.image, "webp")} type="image/webp" />
          <img
            src={getLocalDishFallback(featured.image, 800)}
            srcSet={localDishSrcset(featured.image, "jpg")}
            sizes="(max-width: 480px) 100vw, 480px"
            alt={featured.name}
            loading="lazy"
            decoding="async"
            onError={onDishImageError}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
          />
        </picture>

        {/* Gradient scrim — bottom heavy */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

        {/* Bottom content */}
        <div className="absolute bottom-0 left-0 right-0 p-5 flex items-end justify-between">
          <div className="space-y-1.5 min-w-0 pr-4">
            {/* Chef's pick badge */}
            <span
              className="inline-block text-[10px] font-extrabold uppercase tracking-[0.1em] px-2 py-0.5 rounded text-black"
              style={{ background: "var(--tnm-action)" }}
            >
              Chef's Pick
            </span>
            {/* Dish name */}
            <h3 className="text-[18px] font-bold text-white leading-tight clamp2">
              {featured.name}
            </h3>
            {/* Macros */}
            {macroLine && (
              <p className="text-[12px] text-white/65 font-medium">{macroLine}</p>
            )}
          </div>

          {/* Add button */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300"
            style={{
              background: "var(--tnm-action)",
            }}
          >
            <Plus className="w-5 h-5 text-black" weight="bold" />
          </div>
        </div>
      </Link>
    </section>
  );
}
