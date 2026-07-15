import { STITCH_DESIGN_SYSTEM, getHealthFitChipStyle } from "@/lib/stitchDesignTokens";
<<<<<<< HEAD
import { Check, ShieldCheck, Plus } from "@phosphor-icons/react";
=======
import { ShieldCheck, Plus } from "@phosphor-icons/react";
>>>>>>> origin/main

interface StitchMealCardProps {
  name: string;
  image: string;
  pricePaise: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  isVeg: boolean;
<<<<<<< HEAD
  rdVerified: boolean;
=======
>>>>>>> origin/main
  matchScorePct?: number;
  onAdd?: () => void;
}

export default function StitchClinicalMealCard({
  name,
  image,
  pricePaise,
  calories,
  proteinG,
  carbsG,
  fatG,
  isVeg,
<<<<<<< HEAD
  rdVerified,
=======
>>>>>>> origin/main
  matchScorePct = 98,
  onAdd,
}: StitchMealCardProps) {
  const priceRupees = Math.round(pricePaise / 100);
  const fitStyle = getHealthFitChipStyle(matchScorePct >= 90);

  return (
    <div
<<<<<<< HEAD
      className="overflow-hidden flex flex-col rounded-lg border transition-all duration-200 hover:border-[#F4C430]/40"
=======
      className="overflow-hidden flex flex-col rounded-lg border transition-all duration-200 hover:border-clinical-gold/40"
>>>>>>> origin/main
      style={{
        backgroundColor: STITCH_DESIGN_SYSTEM.colors.surfaceContainer,
        borderColor: STITCH_DESIGN_SYSTEM.colors.borderOutline,
      }}
    >
      {/* Top 60%: High-res media with corner indicators */}
<<<<<<< HEAD
      <div className="relative aspect-[16/10] w-full bg-black overflow-hidden">
=======
      <div className="relative aspect-[16/10] w-full bg-clinical-dark overflow-hidden">
>>>>>>> origin/main
        <img
          src={image}
          alt={name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
        />
<<<<<<< HEAD
        <div className="absolute inset-0 bg-gradient-to-t from-[#101416] via-transparent to-black/30" />

        {/* Veg/Non-Veg dot */}
        <span
          className="absolute top-2.5 left-2.5 z-10 w-4 h-4 rounded border-2 border-[#101416] flex items-center justify-center"
          style={{ backgroundColor: isVeg ? "#88AA84" : "#DC8773" }}
          aria-label={isVeg ? "Vegetarian" : "Non-Vegetarian"}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#101416]" />
=======
        <div className="absolute inset-0 bg-gradient-to-t from-clinical-dark via-transparent to-black/30" />

        {/* Veg/Non-Veg dot */}
        <span
          className="absolute top-2.5 left-2.5 z-10 w-4 h-4 rounded border-2 border-clinical-dark flex items-center justify-center"
          style={{ backgroundColor: isVeg ? "var(--color-clinical-sage)" : "var(--color-error)" }}
          aria-label={isVeg ? "Vegetarian" : "Non-Vegetarian"}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-clinical-dark" />
>>>>>>> origin/main
        </span>

        {/* Biometric Fit Badge */}
        <span
          className="absolute top-2.5 right-2.5 z-10 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 backdrop-blur-md"
          style={fitStyle}
        >
          <ShieldCheck className="w-3 h-3" weight="fill" />
          {matchScorePct}% Fit
        </span>

        {/* Title overlay */}
        <div className="absolute bottom-2 inset-x-3 z-10">
          <h3
<<<<<<< HEAD
            className="text-base font-bold truncate text-[#E9ECEE]"
=======
            className="text-base font-bold truncate text-[var(--text-primary)]"
>>>>>>> origin/main
            style={{ fontFamily: STITCH_DESIGN_SYSTEM.typography.headlineFont }}
          >
            {name}
          </h3>
        </div>
      </div>

      {/* Bottom 40%: Structured Data Ribbon & Saffron Action */}
      <div className="p-3 flex flex-col gap-2.5">
<<<<<<< HEAD
        {/* JetBrains Mono Nutritional Ribbon */}
        <div
          className="flex items-center justify-between px-2.5 py-1.5 rounded bg-[#101416] border border-white/5 text-[11px]"
          style={{ fontFamily: STITCH_DESIGN_SYSTEM.typography.dataFont }}
        >
          <span className="text-[#E9ECEE] font-semibold">{calories} kcal</span>
          <span className="text-white/30">|</span>
          <span className="text-[#F4C430] font-bold">{proteinG}g P</span>
=======
        {/* Monospace nutritional ribbon */}
        <div
          className="flex items-center justify-between px-2.5 py-1.5 rounded bg-clinical-dark border border-white/5 text-[11px]"
          style={{ fontFamily: STITCH_DESIGN_SYSTEM.typography.dataFont }}
        >
          <span className="text-[var(--text-primary)] font-semibold">{calories} kcal</span>
          <span className="text-white/30">|</span>
          <span className="text-clinical-gold font-bold">{proteinG}g P</span>
>>>>>>> origin/main
          <span className="text-white/30">|</span>
          <span className="text-white/70">{carbsG}g C</span>
          <span className="text-white/30">|</span>
          <span className="text-white/70">{fatG}g F</span>
        </div>

        {/* Price & Add Action Row */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-baseline gap-1.5">
            <span
<<<<<<< HEAD
              className="text-lg font-extrabold text-[#F4C430]"
=======
              className="text-lg font-extrabold text-clinical-gold"
>>>>>>> origin/main
              style={{ fontFamily: STITCH_DESIGN_SYSTEM.typography.dataFont }}
            >
              ₹{priceRupees}
            </span>
<<<<<<< HEAD
            {rdVerified && (
              <span className="text-[10px] text-[#88AA84] font-semibold flex items-center gap-0.5">
                <Check className="w-3 h-3" weight="bold" /> RD Verified
              </span>
            )}
=======
>>>>>>> origin/main
          </div>

          <button
            type="button"
            onClick={onAdd}
            aria-label={`Add ${name} to plan`}
<<<<<<< HEAD
            className="px-3.5 py-2 rounded font-extrabold text-xs tracking-wider uppercase bg-[#F4C430] text-[#141210] hover:bg-[#F4C430]/90 active:scale-95 transition-all flex items-center gap-1 touch-target-48"
=======
            className="px-3.5 py-2 rounded font-extrabold text-xs tracking-wider uppercase bg-clinical-gold text-stone-900 hover:bg-clinical-gold/90 active:scale-95 transition-all flex items-center gap-1 touch-target-48"
>>>>>>> origin/main
          >
            <Plus className="w-3.5 h-3.5" weight="bold" /> ADD
          </button>
        </div>
      </div>
    </div>
  );
}
