import React from "react";

interface SquircleOptionCardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  isSelected: boolean;
  onClick: () => void;
  className?: string;
}

export const SquircleOptionCard: React.FC<SquircleOptionCardProps> = ({
  title,
  description,
  icon,
  isSelected,
  onClick,
  className = "",
}) => {
  return (
    <button
      onClick={onClick}
      className={`relative w-full p-5 flex flex-col items-start text-left gap-3 rounded-3xl transition-all duration-200 active:scale-[0.98] ${
        isSelected
          ? "bg-neutral-900 border-2 border-yellow-500 shadow-lg shadow-yellow-500/5"
          : "bg-neutral-900 border-2 border-white/5 hover:border-white/10 hover:bg-neutral-900"
      } ${className}`}
    >
      {isSelected && (
        <div className="absolute top-4 right-4 text-yellow-500">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </div>
      )}
      {icon && <div className={`p-2 rounded-xl ${isSelected ? 'bg-yellow-500/10 text-yellow-500' : 'bg-white/5 text-neutral-400'}`}>{icon}</div>}
      <div>
        <h4 className={`text-base font-semibold tracking-tight mb-1 ${isSelected ? 'text-neutral-100' : 'text-neutral-100'}`}>
          {title}
        </h4>
        {description && (
          <p className="text-sm text-neutral-400 leading-relaxed line-clamp-2">
            {description}
          </p>
        )}
      </div>
    </button>
  );
};
