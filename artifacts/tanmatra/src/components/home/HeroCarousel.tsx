import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

/* Viewport 2 — Hero offer carousel.
 * The lead slide surfaces the REAL first-order offer (25% up to ₹80, wired in
 * Checkout via /orders/first-order-offer). Scroll-snap carousel; auto-advance
 * only when the user hasn't asked to reduce motion. Fixed height → CLS-safe. */

interface Slide {
  eyebrow: string;
  heading: string;
  sub: string;
  cta: string;
  to: string;
  icon: string;
}

const SLIDES: Slide[] = [
  {
    eyebrow: "First order",
    heading: "CLINICAL PRECISION. CULINARY SPEED.",
    sub: "Flat 25% off your first dietitian-calibrated meal — up to ₹80.",
    cta: "Get My Meal Plan",
    to: "/menu",
    icon: "ph-gift",
  },
  {
    eyebrow: "Every dish",
    heading: "MACROS ON THE LABEL. NOTHING HIDDEN.",
    sub: "Calories, protein, carbs, fat and GI disclosed on every plate.",
    cta: "Browse the menu",
    to: "/menu",
    icon: "ph-seal-check",
  },
  {
    eyebrow: "60 seconds",
    heading: "A MENU THAT RE-RANKS AROUND YOU.",
    sub: "Take the metabolic assessment — dishes reorder for your goal & macros.",
    cta: "Start assessment",
    to: "/preferences",
    icon: "ph-brain",
  },
];

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function HeroCarousel() {
  const navigate = useNavigate();
  const scroller = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);

  // Auto-advance (respecting reduced-motion + when off-screen not important here).
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const id = setInterval(() => {
      setActive((prev) => {
        const next = (prev + 1) % SLIDES.length;
        const el = scroller.current;
        if (el) el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
        return next;
      });
    }, 4200);
    return () => clearInterval(id);
  }, []);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (idx !== active) setActive(idx);
  };

  return (
    <div className="herocar padx">
      <div className="herocar-track" ref={scroller} onScroll={onScroll}>
        {SLIDES.map((s, i) => (
          <div className="herocar-slide" key={i}>
            <span className="pill" style={{ background: "var(--safd)", color: "var(--safb)" }}>
              <i className={`ph-fill ${s.icon}`} /> {s.eyebrow}
            </span>
            <div className="herocar-h mt10">{s.heading}</div>
            <div className="fine mt6" style={{ color: "rgba(233,236,238,.82)" }}>{s.sub}</div>
            <button className="btn btn-p mt14" onClick={() => navigate(s.to)}>
              {s.cta} <i className="ph-bold ph-arrow-right" />
            </button>
          </div>
        ))}
      </div>
      <div className="cdots" role="tablist" aria-label="Offers">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            className={i === active ? "cdot on" : "cdot"}
            aria-label={`Go to slide ${i + 1}`}
            aria-selected={i === active}
            role="tab"
            onClick={() => {
              const el = scroller.current;
              if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
              setActive(i);
            }}
          />
        ))}
      </div>
    </div>
  );
}
