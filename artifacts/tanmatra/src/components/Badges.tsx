import React from "react";

interface ClinicalBadgeProps {
  label: string;
  variant?: "gold" | "emerald" | "amber" | "slate";
  icon?: React.ReactNode;
}

export const ClinicalBadge: React.FC<ClinicalBadgeProps> = ({
  label,
  variant = "emerald",
  icon,
}) => {
  const styles = {
    gold: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    slate: "bg-slate-800 text-slate-300 border-slate-700",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${styles[variant]}`}>
      {icon}
      <span>{label}</span>
    </span>
  );
};

interface FilterChipProps {
  label: string;
  isSelected: boolean;
  onClick: () => void;
  count?: number;
}

export const FilterChip: React.FC<FilterChipProps> = ({
  label,
  isSelected,
  onClick,
  count,
}) => {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 min-h-[44px] inline-flex items-center gap-2 border ${
        isSelected
          ? "bg-[#D4AF37] text-slate-950 border-[#D4AF37] shadow-md shadow-amber-500/10"
          : "bg-slate-900/60 text-slate-300 border-slate-800 hover:bg-slate-800"
      }`}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isSelected ? "bg-slate-950/20 text-slate-950" : "bg-slate-800 text-slate-400"}`}>
          {count}
        </span>
      )}
    </button>
  );
};
