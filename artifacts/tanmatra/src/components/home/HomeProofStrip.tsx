import { useMemo, useRef } from "react";
import { useNavigate } from "react-router";
import { SealCheck, Drop, Certificate, type Icon } from "@phosphor-icons/react";
import { useMenuCatalog, type DishData } from "@/lib/menuData";
import NutritionLabelModal from "@/components/dish/NutritionLabelModal";
import { track } from "@/lib/analytics";
import { useSectionViewed } from "./useSectionViewed";

/**
 * S3 — Proof-of-precision strip (playbook §1.1). Three measurable claims,
 * tabular numerals, each backed by a real artifact: the first two tiles open
 * the existing per-dish NutritionLabelModal on a representative dish from the
 * live catalog (falling back to /menu when no qualifying dish exists), the
 * third is the kitchen certification (non-interactive — no fake affordance).
 *
 * Copy stays inside the FSSAI lane (§7.6): measurable nutrient claims
 * ("32g protein", "GI under 55" — Schedule I permitted forms) and process
 * claims ("ISO 22000:2018 kitchen") — never disease claims.
 */

const PROTEIN_CLAIM_GRAMS = 32;

interface ProofTileSpec {
  icon: Icon;
  metric: string;
  caption: string;
}

const MODAL_TILES: ProofTileSpec[] = [
  {
    icon: SealCheck,
    metric: `${PROTEIN_CLAIM_GRAMS}g protein`,
    caption: "verified per plate",
  },
  {
    icon: Drop,
    metric: "GI under 55",
    caption: "Low-GI, measured",
  },
];

const KITCHEN_TILE: ProofTileSpec = {
  icon: Certificate,
  metric: "ISO 22000:2018",
  caption: "kitchen",
};

export default function HomeProofStrip() {
  const navigate = useNavigate();
  const { dishes } = useMenuCatalog();
  const sectionRef = useSectionViewed<HTMLElement>("proof_strip");

  // Representative dishes with real, non-provisional data — the tile's tap
  // target must land on a label that substantiates the claim it makes.
  const proteinDish = useMemo(
    () =>
      dishes.find(
        (d) =>
          d.isAvailable &&
          d.rdVerified &&
          !d.macrosProvisional &&
          d.macros.protein >= PROTEIN_CLAIM_GRAMS,
      ),
    [dishes],
  );
  const lowGiDish = useMemo(
    () =>
      dishes.find(
        (d) =>
          d.isAvailable &&
          d.rdVerified &&
          !d.macrosProvisional &&
          d.glycaemicIndex === "low",
      ),
    [dishes],
  );

  const tileDishes = [proteinDish, lowGiDish];
  const ctaIds = ["proof_protein_label", "proof_low_gi_label"];

  return (
    <section ref={sectionRef} className="padx mt-10" aria-label="Proof of precision">
      <div className="grid grid-cols-3 gap-2">
        {MODAL_TILES.map((tile, idx) => (
          <ProofLabelTile
            key={tile.metric}
            spec={tile}
            dish={tileDishes[idx]}
            ctaId={ctaIds[idx] ?? "proof_label"}
            onFallback={() => navigate("/menu")}
          />
        ))}

        {/* Certification tile — a statement, not a control. */}
        <div className="min-h-[104px] p-3 rounded-2xl bg-neutral-900/80 border border-white/[0.06] backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.3)] flex flex-col items-start justify-between gap-2">
          <KITCHEN_TILE.icon className="w-4 h-4 text-amber-400" weight="bold" aria-hidden />
          <div>
            <span className="tnm-data block text-[13px] font-semibold text-white/95 leading-tight">
              {KITCHEN_TILE.metric}
            </span>
            <span className="block text-[10px] text-white/55 leading-snug mt-1">
              {KITCHEN_TILE.caption}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProofLabelTile({
  spec,
  dish,
  ctaId,
  onFallback,
}: {
  spec: ProofTileSpec;
  dish: DishData | undefined;
  ctaId: string;
  onFallback: () => void;
}) {
  const TileIcon = spec.icon;
  // The existing NutritionLabelModal renders its own trigger button; it is
  // mounted display:none and driven programmatically so the whole tile stays
  // the 44px+ tap target while the dialog itself (portalled) is unaffected.
  const modalHolderRef = useRef<HTMLDivElement | null>(null);

  const handleTap = () => {
    track("home_cta_click", { cta_id: ctaId, source: "proof_strip" });
    const trigger = modalHolderRef.current?.querySelector("button");
    if (trigger instanceof HTMLElement) {
      trigger.click();
    } else {
      // No qualifying dish (or the modal failed to mount) — never a dead end.
      onFallback();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleTap}
        aria-haspopup={dish ? "dialog" : undefined}
        aria-label={`${spec.metric} — ${spec.caption}. ${dish ? "Open the full nutrition label" : "Browse the menu"}`}
        className="min-h-[104px] p-3 rounded-2xl bg-neutral-900/80 border border-white/[0.06] backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.3)] flex flex-col items-start justify-between gap-2 text-left hover:border-[var(--tnm-action)]/30 hover:bg-white/5 active:scale-[0.97] transition-all motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        <TileIcon className="w-4 h-4 text-amber-400" weight="bold" aria-hidden />
        <div>
          <span className="tnm-data block text-[13px] font-semibold text-white/95 leading-tight">
            {spec.metric}
          </span>
          <span className="block text-[10px] text-white/55 leading-snug mt-1">
            {spec.caption}
          </span>
        </div>
      </button>
      {dish && (
        <div ref={modalHolderRef} className="hidden">
          <NutritionLabelModal dish={dish} />
        </div>
      )}
    </>
  );
}
