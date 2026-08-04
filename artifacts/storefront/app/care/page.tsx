import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Stethoscope, HeartPulse, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Clinical Care & Therapeutic Nutrition | Tanmatra",
  description:
    "RD-guided therapeutic meal plans for Diabetes, PCOS, Hypertension, and Gut Health.",
};

const CONDITIONS = [
  {
    slug: "diabetes-type-2",
    title: "Type 2 Diabetes & Pre-diabetes",
    description: "Low-glycemic index meals engineered for HbA1c stabilization and postprandial glucose control.",
    tag: "Glycemic Control",
  },
  {
    slug: "pcos-metabolic",
    title: "PCOS & Metabolic Health",
    description: "Anti-inflammatory, hormone-balancing nutrition formulated to reduce insulin resistance.",
    tag: "Hormone Harmony",
  },
  {
    slug: "hypertension-cardiac",
    title: "Hypertension & Cardiac Care",
    description: "DASH-aligned, low-sodium meals rich in potassium, magnesium, and bioavailable fiber.",
    tag: "DASH Aligned",
  },
  {
    slug: "gut-health-ibs",
    title: "Gut Health & IBS Relief",
    description: "Low-FODMAP and microbiome-nourishing protocols designed to eliminate bloating.",
    tag: "Microbiome Support",
  },
];

export default function CarePage() {
  return (
    <div className="min-h-dvh pb-24">
      <section className="mx-auto max-w-3xl px-4 py-12">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gold-text">
          <Stethoscope size={16} /> Clinical Governance Framework
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Therapeutic Nutrition Plans
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted sm:text-base">
          Evidence-based meal protocols formulated alongside Registered Dietitians. Select your condition to explore clinical nutrition strategies.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {CONDITIONS.map((c) => (
            <Link
              key={c.slug}
              href={`/care/${c.slug}`}
              className="flex flex-col justify-between rounded-xl border border-line bg-surface p-5 transition-all hover:border-gold/50"
            >
              <div>
                <span className="inline-block rounded-full bg-gold/10 px-2.5 py-0.5 text-[10px] font-semibold text-gold-text">
                  {c.tag}
                </span>
                <h2 className="mt-3 text-lg font-semibold text-ink">{c.title}</h2>
                <p className="mt-2 text-xs leading-relaxed text-ink-muted">{c.description}</p>
              </div>
              <div className="mt-4 flex items-center text-xs font-semibold text-gold-text">
                Explore Protocol &rarr;
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
