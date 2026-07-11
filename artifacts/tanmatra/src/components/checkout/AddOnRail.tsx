import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Minus, Sparkles, Crown } from "lucide-react";
import { addonsApi, type Addon } from "@/lib/marketplaceApi";
import { formatPrice } from "@/lib/api/adapter";
import { onDishImageError } from "@/lib/imgFallback";

interface Props {
  cartTags: string[];
  selected: Map<number, number>;
  onChange: (next: Map<number, number>) => void;
}

export default function AddOnRail({ cartTags, selected, onChange }: Props) {
  const tagsKey = useMemo(() => cartTags.slice().sort().join(","), [cartTags]);
  const q = useQuery({
    queryKey: ["addons", tagsKey],
    queryFn: () => addonsApi.list(cartTags),
    staleTime: 60_000,
  });

  const setQty = (id: number, qty: number) => {
    const next = new Map(selected);
    if (qty <= 0) next.delete(id);
    else next.set(id, qty);
    onChange(next);
  };

  if (q.isLoading) {
    return (
      <div className="card" style={{ padding: 16 }}>
        <div className="fine" style={{ color: "var(--mut)" }}>Loading add-ons…</div>
      </div>
    );
  }
  const addons = q.data?.addons ?? [];
  if (addons.length === 0) return null;

  const totalPaise = Array.from(selected.entries()).reduce((sum, [id, qty]) => {
    const a = addons.find((x) => x.id === id);
    return sum + (a ? a.pricePaise * qty : 0);
  }, 0);

  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="flex items-center justify-between">
        <h2 className="tt flex items-center gap-2" style={{ color: "var(--tx)" }}>
          <Sparkles className="w-4 h-4" style={{ color: "var(--saf)" }} />
          Add a little extra
        </h2>
        {totalPaise > 0 && (
          <span className="mono" style={{ color: "var(--safb)", fontSize: 11 }}>
            +{formatPrice(totalPaise)}
          </span>
        )}
      </div>
      <p className="fine mt6" style={{ color: "var(--mut)" }}>
        RD-curated drinks, snacks &amp; supplements that pair with your meal.
      </p>
      <div className="flex gap-3 overflow-x-auto -mx-1 px-1 pb-1 mt12">
        {addons.map((a) => (
          <AddonTile
            key={a.id}
            addon={a}
            qty={selected.get(a.id) ?? 0}
            onQty={(qty) => setQty(a.id, qty)}
          />
        ))}
      </div>
    </div>
  );
}

function AddonTile({
  addon,
  qty,
  onQty,
}: {
  addon: Addon;
  qty: number;
  onQty: (qty: number) => void;
}) {
  return (
    <div
      className="w-44 shrink-0 overflow-hidden"
      style={{ borderRadius: 12, border: "1px solid var(--ln2)", background: "var(--s1)" }}
    >
      <div className="relative h-24" style={{ background: "var(--s3)" }}>
        {addon.image && (
          <img
            src={addon.image}
            alt={addon.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={onDishImageError}
          />
        )}
        {addon.premiumOnly && (
          <span
            className="pill absolute top-1.5 left-1.5 flex items-center gap-1"
            style={{ background: "var(--saf)", color: "var(--onsaf)", fontSize: 9, fontWeight: 700 }}
          >
            <Crown className="w-2.5 h-2.5" /> PREMIUM
          </span>
        )}
        {addon.rdVerified && !addon.premiumOnly && (
          <span className="pill absolute top-1.5 left-1.5" style={{ fontSize: 9 }}>
            RD
          </span>
        )}
      </div>
      <div className="p-2.5 space-y-1.5">
        <p className="text-[11px] font-medium leading-snug line-clamp-2 h-8" style={{ color: "var(--tx)" }}>
          {addon.name}
        </p>
        {addon.macros && (
          <p className="text-[9px]" style={{ color: "var(--mut)" }}>
            {addon.macros.kcal} kcal · {addon.macros.proteinG}g protein
          </p>
        )}
        <div className="flex items-center justify-between pt-1">
          <span className="mono" style={{ color: "var(--safb)", fontSize: 11 }}>
            {formatPrice(addon.pricePaise)}
          </span>
          {qty === 0 ? (
            <button
              type="button"
              onClick={() => onQty(1)}
              aria-label={`Add ${addon.name}`}
              className="btn btn-p"
              style={{ minWidth: 44, minHeight: 36, padding: "0 12px", fontSize: 10, fontWeight: 700 }}
            >
              ADD
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onQty(qty - 1)}
                aria-label="Decrease quantity"
                className="qbtn"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="mono w-5 text-center" style={{ color: "var(--tx)", fontSize: 11 }}>
                {qty}
              </span>
              <button
                type="button"
                onClick={() => onQty(qty + 1)}
                aria-label="Increase quantity"
                className="qbtn"
                style={{ background: "var(--saf)", color: "var(--onsaf)" }}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
