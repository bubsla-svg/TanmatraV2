import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowRight,
  Leaf,
  Truck,
  ShieldCheck,
  SealCheck,
  Scales,
  Barbell,
  Drop,
  Heart,
  Sparkle,
  Lightning,
  type Icon,
} from "@phosphor-icons/react";
import { track } from "@/lib/analytics";

interface HomeHeroProps {
  onSeeMenu: () => void;
  onHelpChoose: () => void;
}

const CITY_KEY = "tanmatra:deliver-city";

// Slugs must match a real plan in lib/rdPlans.ts — no fabricated programs.
const PROGRAM_CHIPS: { icon: Icon; label: string; planSlug: string }[] = [
  { icon: Scales, label: "Weight Loss", planSlug: "weight-loss-jumpstart" },
  { icon: Barbell, label: "Muscle Gain", planSlug: "lean-muscle-builder" },
  { icon: Drop, label: "Diabetic Friendly", planSlug: "diabetic-friendly" },
  { icon: Heart, label: "PCOS Care", planSlug: "pcos-balance" },
];

const FEATURE_CHIPS: { icon: Icon; label: string }[] = [
  { icon: SealCheck, label: "Dietitian Designed" },
  { icon: Leaf, label: "Freshly Prepared" },
  { icon: Lightning, label: "Low GI" },
  { icon: ShieldCheck, label: "ISO 22000 Kitchen" },
  { icon: Truck, label: "NCR Delivery" },
];

export default function HomeHero({ onSeeMenu, onHelpChoose }: HomeHeroProps) {
  const navigate = useNavigate();
  const [city, setCity] = useState("Noida");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CITY_KEY);
      if (saved) setCity(saved);
    } catch {
      /* private mode — default city */
    }
  }, []);

  return (
    <section className="w-full">
      {/* ── 1. Full-bleed hero image ──────────────────────────────────── */}
      <div className="relative h-[400px] overflow-hidden -mx-0 mt-[88px]">
        <img
          src="/hero-food.jpg"
          alt="Fresh clinical meals"
          className="absolute inset-0 w-full h-full object-cover"
          loading="eager"
        />
        {/* Dark gradient — top for legibility, bottom fade into bg */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/20 to-[var(--tnm-surface-ink)]" />

        {/* Hero copy — city-aware headline */}
        <div className="absolute inset-0 flex flex-col justify-center px-5 pt-8">
          <p className="text-[var(--tnm-action)] font-bold text-[13px] leading-4 mb-2 uppercase tracking-wide">
            Now serving {city}
          </p>
          <h1 className="text-[30px] font-extrabold text-white tracking-tight leading-[1.1]">
            Clinical nutrition,
            <br />delivered fresh daily.
          </h1>
          <p className="mt-2 text-[14px] text-white/70 font-normal leading-5 max-w-[280px]">
            Dietitian-designed meals for your health goal — cooked in an ISO kitchen, delivered to your door.
          </p>
        </div>
      </div>

      <div className="px-4">
        {/* ── 2. CTA row ────────────────────────────────────────────────── */}
        <div className="mt-5 flex flex-col gap-3">
          {/* Primary: Browse Menu — amber pill, full width */}
          <button
            type="button"
            onClick={() => {
              track("home_cta_click", { cta: "browse_menu", source: "hero" });
              onSeeMenu();
            }}
            className="w-full min-h-[52px] rounded-full font-semibold text-[15px] leading-5 text-black flex items-center justify-between px-6 active:scale-[0.98] transition-all"
            style={{
              background: "var(--tnm-action)",
              boxShadow: "0 4px 20px color-mix(in srgb, var(--tnm-action) 35%, transparent)",
            }}
          >
            <span>Browse Menu</span>
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "color-mix(in srgb, black 15%, transparent)" }}
            >
              <ArrowRight className="w-4 h-4 text-black" weight="bold" />
            </span>
          </button>

          {/* Secondary: Help Me Choose — ghost pill */}
          <button
            type="button"
            onClick={() => {
              track("home_cta_click", { cta: "help_choose", source: "hero" });
              onHelpChoose();
            }}
            className="w-full min-h-[52px] rounded-full font-semibold text-[15px] leading-5 text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all border border-white/15"
            style={{ background: "color-mix(in srgb, var(--tnm-surface-ink-2) 60%, transparent)" }}
          >
            <Sparkle className="w-4 h-4 text-[var(--tnm-action)]" weight="fill" />
            <span>Help Me Choose</span>
          </button>
        </div>

        {/* ── 3. Clinical Programs 2×2 grid ─────────────────────────────── */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <span
              className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/50"
              style={{ fontFamily: "Geist, sans-serif" }}
            >
              Clinical Health Programs
            </span>
            <button
              type="button"
              onClick={() => navigate("/plans")}
              className="text-[12px] font-semibold text-[var(--tnm-action)] hover:underline"
            >
              See All
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {PROGRAM_CHIPS.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    track("home_program_tap", { program: p.planSlug });
                    navigate(`/plans/${p.planSlug}`);
                  }}
                  className="flex flex-col items-center justify-center text-center gap-3 p-5 rounded-xl border border-white/[0.08] hover:border-[var(--tnm-action)]/30 hover:bg-white/5 active:scale-[0.97] transition-all group"
                  style={{ background: "var(--tnm-surface-ink-2)" }}
                >
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
                    style={{
                      background: "color-mix(in srgb, var(--tnm-action) 12%, transparent)",
                    }}
                  >
                    <Icon
                      className="w-5 h-5 text-[var(--tnm-action)]"
                      weight="bold"
                    />
                  </div>
                  <span className="text-[13px] font-semibold text-white leading-tight">
                    {p.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 4. Feature highlight chips ────────────────────────────────── */}
        <div className="mt-5 flex flex-wrap gap-2 pb-2">
          {FEATURE_CHIPS.map((chip) => {
            const Icon = chip.icon;
            return (
              <div
                key={chip.label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/[0.08]"
                style={{ background: "var(--tnm-surface-ink-2)" }}
              >
                <Icon className="w-3.5 h-3.5 text-[var(--tnm-action)] shrink-0" weight="bold" />
                <span className="text-[12px] font-medium text-white/80">{chip.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
