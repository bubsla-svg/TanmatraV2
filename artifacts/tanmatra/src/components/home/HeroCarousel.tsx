import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { loyaltyApi } from "@/lib/loyaltyApi";
import { formatPrice } from "@/lib/api/adapter";

/* Viewport 2 — Hero offer carousel.
 * The lead slide surfaces the REAL first-order offer (25% up to the configured cap, wired in
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

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function HeroCarousel() {
  const navigate = useNavigate();
  const scroller = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);

  const { data: offer } = useQuery({
    queryKey: ["firstOrderOffer"],
    queryFn: loyaltyApi.getFirstOrderOffer,
    staleTime: 5 * 60_000,
  });

  const percent = offer ? offer.percentBps / 100 : 25;
  const capFormatted = offer ? formatPrice(offer.capPaise) : formatPrice(8000);

  const slides: Slide[] = [
    {
      eyebrow: "First order",
      heading: "MACROS ON THE LABEL. NOTHING HIDDEN.",
      sub: `Flat ${percent}% off your first à-la-carte order — up to ${capFormatted}. Calories, protein, carbs and fat printed on every RD-verified plate.`,
      cta: `Claim ${percent}% off`,
      to: "/menu",
      icon: "ph-gift",
    },
    {
      eyebrow: "Your goal",
      heading: "CLINICAL PRECISION. CULINARY SPEED.",
      sub: "A dietitian-calibrated meal plan built around your goal, macros and weekly schedule.",
      cta: "Build my meal plan",
      to: "/plans",
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

  // Auto-advance (respecting reduced-motion + when off-screen not important here).
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const id = setInterval(() => {
      setActive((prev) => {
        const next = (prev + 1) % slides.length;
        const el = scroller.current;
        if (el) el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
        return next;
      });
    }, 4200);
    return () => clearInterval(id);
  }, [slides.length]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (idx !== active) setActive(idx);
  };

  return (
    <div className="herocar padx">
      <div className="herocar-track" ref={scroller} onScroll={onScroll}>
        {slides.map((s, i) => (
          <div className="herocar-slide" key={i}>
            <span className="pill" style={{ background: "var(--safd)", color: "var(--safb)" }}>
              <i className={`ph-fill ${s.icon}`} /> {s.eyebrow}
            </span>
            <div className="herocar-h mt10">{s.heading}</div>
            <div className="fine mt6 text-white/80">{s.sub}</div>
            <button className="btn btn-p mt14" onClick={() => navigate(s.to)}>
              {s.cta} <i className="ph-bold ph-arrow-right" />
            </button>
          </div>
        ))}
      </div>
      <div className="cdots" role="tablist" aria-label="Offers">
        {slides.map((_, i) => (
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
