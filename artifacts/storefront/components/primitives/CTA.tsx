import React from "react";

interface CTAProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
}

/**
 * Primary CTA Contract:
 * - Brand Gold (#D4AF37) background
 * - Near-black (#0F172A) text
 * - Maximum 1 visible instance per viewport
 */
export const PrimaryCTA: React.FC<CTAProps> = ({
  children,
  onClick,
  disabled = false,
  className = "",
  type = "button",
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-8 py-4 rounded-xl font-bold tracking-tight text-slate-900 
        bg-gold hover:bg-gold-text
        active:scale-[0.98] transition-all duration-200 shadow-lg shadow-amber-500/10
        min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-2
        disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
};

/**
 * Secondary CTA Contract:
 * - Frosted glass theme-aware background
 * - Semantic subtle border & high-emphasis text
 */
export const SecondaryCTA: React.FC<CTAProps> = ({
  children,
  onClick,
  disabled = false,
  className = "",
  type = "button",
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-8 py-4 rounded-xl font-semibold tracking-tight 
        text-slate-100 bg-slate-900/80 backdrop-blur-md
        border border-slate-700/60 hover:bg-slate-800/90
        active:scale-[0.98] transition-all duration-200
        min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-2
        disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
};
