import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { Sparkles, X } from "lucide-react";
import IntakeQuiz from "./IntakeQuiz";
import { usePreferences } from "@/lib/preferencesContext";
import { isSoftGateResolved } from "@/components/onboarding/SoftGate";

// Store the dismissal as a timestamp in localStorage rather than a flag
// in sessionStorage, so dismissing once silences the banner for 7 days
// across tabs and sessions instead of re-popping on every new tab.
const DISMISS_KEY = "tanmatra:quiz-banner-dismissed-at:v2";
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function isDismissed(): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < DISMISS_TTL_MS;
}

export default function OnboardingQuizGate() {
  const { needsQuiz } = usePreferences();
  const location = useLocation();
  const [bannerVisible, setBannerVisible] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  // Get out of the way while the user reads: hide while scrolling down,
  // re-surface on scroll-up. The pill was covering hero stats and menu
  // content at every scroll position, especially on mobile.
  const [scrollHidden, setScrollHidden] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - lastY) > 8) {
        setScrollHidden(y > lastY && y > 320);
        lastY = y;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!needsQuiz) {
      setBannerVisible(false);
      return;
    }
    const onPreferences = location.pathname === "/preferences";
    const onLogin = location.pathname === "/login";
    if (onPreferences || onLogin) {
      setBannerVisible(false);
      return;
    }
    if (isDismissed()) {
      setBannerVisible(false);
      return;
    }
    // Don't double up with the Phase 1 soft gate: while that first-touch
    // gate is still unresolved (fresh visitor), keep this heavier-assessment
    // banner suppressed so the two never pop at once.
    if (!isSoftGateResolved()) {
      setBannerVisible(false);
      return;
    }
    setBannerVisible(true);
  }, [needsQuiz, location.pathname]);

  const dismissBanner = () => {
    setBannerVisible(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
  };

  const handleQuizChange = (open: boolean) => {
    setQuizOpen(open);
  };

  return (
    <>
      {bannerVisible && (
        <div
          className={`fixed inset-x-0 bottom-16 md:bottom-4 z-30 px-3 md:px-4 pointer-events-none transition-all duration-300 ${
            scrollHidden ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100"
          }`}
          aria-hidden={scrollHidden || undefined}
        >
          <div className={`max-w-2xl mx-auto ${scrollHidden ? "pointer-events-none" : "pointer-events-auto"} bg-clinical-surface border border-clinical-gold/30 shadow-clinical-lg rounded-xl px-4 py-3 flex items-center gap-3`}>
            <div className="w-8 h-8 rounded-lg bg-clinical-gold/15 border border-clinical-gold/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-clinical-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white leading-tight">
                Personalize your menu
              </p>
              <p className="text-[11px] text-clinical-zinc leading-tight mt-0.5">
                60-second assessment — RD-matched dishes for your goal.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setQuizOpen(true)}
              className="shrink-0 min-h-11 text-[11px] font-bold uppercase tracking-wider px-4 py-2 rounded-md bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-gold focus-visible:ring-offset-2 focus-visible:ring-offset-clinical-surface"
            >
              Start
            </button>
            <button
              type="button"
              onClick={dismissBanner}
              aria-label="Dismiss assessment prompt"
              className="shrink-0 w-11 h-11 rounded-md text-clinical-zinc hover:text-white hover:bg-white/5 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-gold focus-visible:ring-offset-2 focus-visible:ring-offset-clinical-surface"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      <IntakeQuiz open={quizOpen} onOpenChange={handleQuizChange} />
    </>
  );
}
