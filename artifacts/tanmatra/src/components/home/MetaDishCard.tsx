import { Link } from "react-router";
import { F } from "@/tanmatra-v2/data";
import { macrosAreProvisional, type DishData } from "@/lib/menuData";
import { FREE_DELIVERY_THRESHOLD } from "@/lib/cartContext";

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

  return (
    <div className="mcard">
      <Link to={`/dish/${dish.slug}`} aria-label={dish.name} className="mcard-media plc">
        <div
          className="mcard-img"
          style={{ backgroundImage: `url(${dish.image})`, backgroundSize: "cover", backgroundPosition: "center" }}
        />
        <span className={dish.isVeg ? "mcard-vd" : "mcard-vd nv"} aria-label={dish.isVeg ? "Veg" : "Non-veg"} />
      </Link>

      <div className="mcard-body">
        <Link to={`/dish/${dish.slug}`} className="mcard-name clamp1">{dish.name}</Link>

        <div className="mcard-meta">
          <span><i className="ph-bold ph-clock" /> 25–40 min</span>
          <span className="mcard-dot">·</span>
          <span><i className="ph-bold ph-package" /> Free delivery over {F(FREE_DELIVERY_THRESHOLD)}</span>
        </div>

        <div className="macrobar">
          {provisional ? (
            <span className="macro-prov"><i className="ph-bold ph-flask" /> macros being verified</span>
          ) : (
            <>
              <b>{m.calories}</b> kcal <span className="mcard-dot">·</span> P <b>{m.protein}g</b>{" "}
              <span className="mcard-dot">·</span> C <b>{m.carbs}g</b>{" "}
              <span className="mcard-dot">·</span> F <b>{m.fat}g</b>
            </>
          )}
        </div>

        <div className="fx ac jb mt10">
          <span className="price" style={{ fontSize: 15, color: "var(--safb)" }}>{F(dish.price)}</span>
          <button className="mcard-add" onClick={() => onAdd(dish)} aria-label={`Add ${dish.name}`}>
            <i className="ph-bold ph-plus" /> ADD
          </button>
        </div>
      </div>
    </div>
  );
}
