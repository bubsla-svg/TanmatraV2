import React from "react";

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  variant?: "ghost" | "solid" | "glass";
}

export const IconButton: React.FC<IconButtonProps> = ({ icon, variant = "ghost", className = "", ...props }) => {
  const baseStyles = "inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-full transition-all duration-150 active:scale-[0.92]";
  const variants = {
    ghost: "text-ink-muted hover:text-ink hover:bg-surface-subtle",
    solid: "bg-surface text-ink border border-line hover:border-line shadow-sm",
    glass: "bg-glass backdrop-blur-md border border-line text-ink hover:bg-glass",
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {icon}
    </button>
  );
};

interface CompactActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export const CompactAction: React.FC<CompactActionProps> = ({ children, icon, className = "", ...props }) => {
  return (
    <button
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold tracking-wide bg-surface text-ink border border-line hover:border-line hover:bg-surface active:scale-[0.96] transition-all duration-150 ${className}`}
      {...props}
    >
      {icon && <span className="text-gold">{icon}</span>}
      {children}
    </button>
  );
};
