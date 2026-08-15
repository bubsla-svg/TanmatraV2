import React from "react";

interface ClinicalBadgeProps {
  label: string;
  variant?: "gold" | "emerald" | "amber" | "slate";
  icon?: React.ReactNode;
  /** Extra classes on the outer span — e.g. `tabular` for a numeric label. */
  className?: string;
}

export const ClinicalBadge: React.FC<ClinicalBadgeProps> = ({
  label,
  variant = "emerald",
  icon,
  className = "",
}) => {
  const styles = {
    gold: "bg-gold/10 text-[var(--gold-text)] border-[var(--gold)]/20",
    emerald: "bg-sage/10 text-sage-text border-[var(--sage)]/20",
    amber: "bg-gold/10 text-[var(--gold-text)] border-[var(--gold)]/20",
    slate: "bg-surface-raised text-ink-muted border-line",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${styles[variant]} ${className}`}>
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
          ? "bg-gold text-[var(--gold-ink)] border-gold shadow-md shadow-[var(--gold)]/10"
          : "bg-surface-raised text-ink-muted border-line hover:bg-surface-raised"
      }`}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span className={`px-1.5 py-0.5 rounded-full text-3xs ${isSelected ? "bg-[var(--gold-ink)]/20 text-[var(--gold-ink)]" : "bg-surface-raised text-ink-muted"}`}>
          {count}
        </span>
      )}
    </button>
  );
};
