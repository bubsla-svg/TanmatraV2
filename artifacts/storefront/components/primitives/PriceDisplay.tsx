import React from "react";

interface PriceDisplayProps {
  pricePaise: number;
  originalPricePaise?: number;
  label?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export const PriceDisplay: React.FC<PriceDisplayProps> = ({
  pricePaise,
  originalPricePaise,
  label,
  size = "md",
  className = "",
}) => {
  const formatRupees = (paise: number) => {
    const rupees = Math.round(paise / 100);
    return `₹${rupees.toLocaleString("en-IN")}`;
  };

  const sizeClasses = {
    sm: "text-sm font-semibold",
    md: "text-base font-bold",
    lg: "text-xl font-extrabold",
    xl: "text-3xl font-black tracking-tight",
  };

  return (
    <div className={`inline-flex flex-col ${className}`}>
      {label && <span className="text-3xs uppercase font-bold tracking-wider text-ink-muted mb-0.5">{label}</span>}
      <div className="flex items-baseline gap-2">
        <span className={`text-ink ${sizeClasses[size]}`}>
          {formatRupees(pricePaise)}
        </span>
        {originalPricePaise && originalPricePaise > pricePaise && (
          <span className="text-xs font-medium text-ink-faint line-through">
            {formatRupees(originalPricePaise)}
          </span>
        )}
      </div>
    </div>
  );
};
