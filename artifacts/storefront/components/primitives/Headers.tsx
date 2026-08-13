"use client";

import React, { useState, useEffect } from "react";

interface GlobalHeaderProps {
  currentRoute?: string;
  onNavigate?: (route: string) => void;
}

export const GlobalHeader: React.FC<GlobalHeaderProps> = ({
  currentRoute = "/",
  onNavigate,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY > lastScrollY && currentY > 60) {
        setIsVisible(false); // Hide on scroll down
      } else {
        setIsVisible(true); // Reveal on scroll up
      }
      setLastScrollY(currentY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  return (
    <header className={`sticky top-0 z-40 bg-[var(--glass)] backdrop-blur-xl border-b border-line transition-transform duration-300 ${isVisible ? "translate-y-0" : "-translate-y-full"}`}>
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate?.("/")}>
          <div className="w-9 h-9 rounded-xl bg-gold flex items-center justify-center font-black text-[var(--gold-ink)] text-xl shadow-lg shadow-[var(--gold)]/20">
            T
          </div>
          <div>
            <span className="text-lg font-black tracking-tight text-ink">TANMATRA</span>
            <span className="hidden md:inline-block text-3xs text-[var(--gold-text)] font-semibold ml-2 px-2 py-0.5 rounded-full bg-gold/10 border border-[var(--gold)]/20">
              Therapeutic Nutrition
            </span>
          </div>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-ink-muted">
          <button onClick={() => onNavigate?.("/")} className={`hover:text-gold-text transition-colors ${currentRoute === "/" ? "text-gold-text" : ""}`}>Home</button>
          <button onClick={() => onNavigate?.("/menu")} className={`hover:text-gold-text transition-colors ${currentRoute === "/menu" ? "text-gold-text" : ""}`}>Menu</button>
          <button onClick={() => onNavigate?.("/plans")} className={`hover:text-gold-text transition-colors ${currentRoute === "/plans" ? "text-gold-text" : ""}`}>Plans</button>
          <button onClick={() => onNavigate?.("/custom-build")} className={`hover:text-gold-text transition-colors ${currentRoute === "/custom-build" ? "text-gold-text" : ""}`}>Custom Build</button>
          <button onClick={() => onNavigate?.("/account")} className={`hover:text-gold-text transition-colors ${currentRoute === "/account" ? "text-gold-text" : ""}`}>Account</button>
        </nav>
      </div>
    </header>
  );
};
