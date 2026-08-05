import React from "react";

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  variant?: "ghost" | "solid" | "glass";
}

export const IconButton: React.FC<IconButtonProps> = ({ icon, variant = "ghost", className = "", ...props }) => {
  const baseStyles = "inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-full transition-all duration-150 active:scale-[0.92]";
  const variants = {
    ghost: "text-[#A3A3A3] hover:text-[#F5F5F4] hover:bg-white/5",
    solid: "bg-[#171717] text-[#F5F5F4] border border-white/5 hover:border-white/10 shadow-sm",
    glass: "bg-black/20 backdrop-blur-md border border-white/10 text-white hover:bg-black/40",
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
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold tracking-wide bg-[#171717] text-[#F5F5F4] border border-white/5 hover:border-white/10 hover:bg-[#1C1C1C] active:scale-[0.96] transition-all duration-150 ${className}`}
      {...props}
    >
      {icon && <span className="text-[#D4AF37]">{icon}</span>}
      {children}
    </button>
  );
};
