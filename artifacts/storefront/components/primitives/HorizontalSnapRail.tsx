import React from "react";

interface HorizontalSnapRailProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

export const HorizontalSnapRail: React.FC<HorizontalSnapRailProps> = ({
  title,
  subtitle,
  children,
  className = "",
}) => {
  return (
    <div className={`w-full py-4 ${className}`}>
      {(title || subtitle) && (
        <div className="mb-4 flex items-end justify-between px-1">
          <div>
            {title && <h3 className="text-xl font-bold tracking-tight text-ink">{title}</h3>}
            {subtitle && <p className="text-xs text-ink-muted mt-1">{subtitle}</p>}
          </div>
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 no-scrollbar scroll-smooth">
        {React.Children.map(children, (child) => (
          <div className="snap-start shrink-0 min-w-[280px] max-w-[320px]">
            {child}
          </div>
        ))}
      </div>
    </div>
  );
};
