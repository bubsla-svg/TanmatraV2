import React from "react";
import { GlobalHeader } from "./Headers";

interface GlobalLayoutProps {
  children: React.ReactNode;
  currentRoute?: string;
  onNavigate?: (route: string) => void;
}

// D-17: this file has zero importers anywhere in the app (the real global
// chrome is app/(global)/layout.tsx + components/MobileBottomNav.tsx) — its
// own BottomTabBar demo dependency was the dead duplicate that branch
// deleted. Kept minimal and compiling rather than expanding scope to
// deleting this whole unreferenced file.
export const GlobalLayout: React.FC<GlobalLayoutProps> = ({
  children,
  currentRoute = "/",
  onNavigate,
}) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <GlobalHeader currentRoute={currentRoute} onNavigate={onNavigate} />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 py-6 pb-24 md:pb-12">
        {children}
      </main>
    </div>
  );
};

interface FocusLayoutProps {
  children: React.ReactNode;
  title: string;
  stepProgress?: string;
  onBack?: () => void;
}

export const FocusLayout: React.FC<FocusLayoutProps> = ({
  children,
  title,
  stepProgress,
  onBack,
}) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Focus Header - Minimalist, no distractive banners */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Back"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-100">{title}</h1>
            <span className="text-[10px] text-amber-400 font-medium">Tanmatra Focus Checkout</span>
          </div>
        </div>

        {stepProgress && (
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            {stepProgress}
          </span>
        )}
      </header>

      {/* Main Focus Container */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-6 py-8 pb-32">
        {children}
      </main>
    </div>
  );
};

interface B2BLayoutProps {
  children: React.ReactNode;
  companyName?: string;
}

export const B2BLayout: React.FC<B2BLayoutProps> = ({
  children,
  companyName = "Corporate Partner",
}) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-sm">
            B2B
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100">{companyName} Wellness</h2>
            <p className="text-[10px] text-slate-400">Powered by Tanmatra Corporate Care</p>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-6 py-8">
        {children}
      </main>
      {/* Mobile B2B routes DO NOT render consumer BottomTabBar */}
    </div>
  );
};
