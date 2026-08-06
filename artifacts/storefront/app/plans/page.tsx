import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { SafeImage } from "@/components/primitives/SafeImage";
import { computePlanQuote } from "@workspace/subscription-rules";
import { formatPaise } from "@/lib/format";

export const metadata: Metadata = {
  title: "Subscription Plans | Tanmatra",
};

export default function PlansPage() {
  const deskFuel = computePlanQuote("desk_fuel", "veg", "monthly");
  const proteinBuild = computePlanQuote("protein_build", "veg", "monthly");
  const steady = computePlanQuote("steady", "nonveg", "monthly");
  const glp1 = computePlanQuote("glp1_companion", "egg", "monthly");

  return (
    <main className="min-h-screen px-4 pb-24 pt-12 flex flex-col items-center relative overflow-hidden">
      {/* GoalRouter Quiz Block */}
      <section className="w-full max-w-md mb-12 relative z-10">
        <div className="mb-8 text-center md:text-left">
          <h1 className="text-3xl font-semibold tracking-tight text-stone-100">
            What is your primary metabolism goal?
          </h1>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/plan/stability"
            className="group w-full flex items-center justify-between p-5 rounded-3xl bg-stone-900 border border-white/5 hover:border-yellow-400/40 transition-colors active:scale-[0.98]"
          >
            <span className="text-[18px] font-medium text-stone-100">Glucose Stability</span>
            <span className="material-symbols-outlined text-yellow-400 group-hover:translate-x-1 transition-transform">arrow_forward</span>
          </Link>

          <Link
            href="/plan/performance"
            className="group w-full flex items-center justify-between p-5 rounded-3xl bg-stone-900 border border-white/5 hover:border-yellow-400/40 transition-colors active:scale-[0.98]"
          >
            <span className="text-[18px] font-medium text-stone-100">Performance</span>
            <span className="material-symbols-outlined text-yellow-400 group-hover:translate-x-1 transition-transform">arrow_forward</span>
          </Link>

          <Link
            href="/plan/longevity"
            className="group w-full flex items-center justify-between p-5 rounded-3xl bg-stone-900 border border-white/5 hover:border-yellow-400/40 transition-colors active:scale-[0.98]"
          >
            <span className="text-[18px] font-medium text-stone-100">Longevity</span>
            <span className="material-symbols-outlined text-yellow-400 group-hover:translate-x-1 transition-transform">arrow_forward</span>
          </Link>
        </div>

        <div className="mt-6 text-center">
          <Link href="/menu" className="text-xs font-bold tracking-wider text-neutral-400 hover:text-yellow-400 transition-colors uppercase">
            Just browsing
          </Link>
        </div>
      </section>

      {/* TrialCard (Secondary) */}
      <section className="w-full max-w-md mb-12 relative z-10">
        <div className="relative overflow-hidden rounded-3xl border border-white/5 p-8 bg-gradient-to-br from-neutral-900 to-neutral-950">
          <div className="absolute top-0 right-0 w-32 h-32 opacity-20 -mr-8 -mt-8 pointer-events-none">
            <SafeImage
              src="https://lh3.googleusercontent.com/aida/AP1WRLuEjFf2gxIqjz0-BVmfaKR-R8As2_logXeR47fTFMXFXAjVHzCX_msxCJ7Gpc-lAri4pQWWLU_rDdn19MhgdgMO5l-5gQVDzzvVcofeqCyGIa5eiSYpdkBiXmCv5snt4DR7eM6qP-M0FeAo35Jc3LvxjxayL_hZ2W28yn8QLrLDTR74iJZPVYhcJA6E5HEJ3EfO8YqsfYsFs-LtKOX6FofgUlMlyVFrGqklLZ7szq7SVNtydZ5rsJH4Z5Y"
              alt="Decorative Plating"
              aspectRatio="1/1"
              className="object-cover rounded-full grayscale blur-sm"
            />
          </div>
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 mb-4 bg-yellow-400/10 text-yellow-400 px-3 py-1 rounded-full border border-yellow-400/20">
              <span className="material-symbols-outlined text-[16px]">science</span>
              <span className="text-xs font-bold tracking-wider uppercase">Limited Trial</span>
            </div>
            <h2 className="text-[24px] font-medium text-stone-100 mb-2 leading-[1.3]">
              3-Day Metabolic Trial
            </h2>
            <p className="text-[14px] text-neutral-400 mb-6 leading-relaxed">
              Experience precision-engineered nutrition and glucose tracking before committing to a full protocol.
            </p>
            <Link
              href="/trial"
              className="block w-full py-4 border border-white/5 rounded-full text-xs font-bold tracking-wider text-stone-100 hover:bg-white/5 transition-colors uppercase text-center active:scale-[0.98]"
            >
              ACTIVATE TRIAL
            </Link>
          </div>
        </div>
      </section>

      {/* PlanCard Comparison List */}
      <section className="w-full max-w-md flex flex-col gap-6 relative z-10">

        {/* Plan: Desk Fuel */}
        <div className="bg-neutral-900 border border-white/5 rounded-3xl overflow-hidden shadow-xl shadow-black/20">
          <div className="p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-[20px] font-medium text-stone-100 leading-[1.3]">Desk Fuel</h3>
                <p className="text-[14px] text-neutral-400">Optimized for cognitive clarity</p>
              </div>
              <div className="flex gap-2">
                <div className="h-8 w-8 rounded-full border border-white/5 flex items-center justify-center text-neutral-400">
                  <span className="material-symbols-outlined text-[18px]">eco</span>
                </div>
                <div className="h-8 w-8 rounded-full border border-white/5 flex items-center justify-center text-neutral-400">
                  <span className="material-symbols-outlined text-[18px]">egg</span>
                </div>
              </div>
            </div>

            <div className="flex items-baseline gap-2 mb-8">
              <span className="font-mono text-[24px] font-medium text-yellow-400">{formatPaise(deskFuel.pricePerMealPaise ?? 0)}</span>
              <span className="font-mono text-[14px] text-neutral-400">/meal</span>
              <div className="ml-auto text-right">
                <span className="block font-mono text-[14px] text-stone-100">{formatPaise(deskFuel.cycleTotalPaise)}</span>
                <span className="block text-[10px] font-bold tracking-wider text-neutral-400 uppercase mt-1">Monthly billing</span>
              </div>
            </div>

            <Link
              href="/plan/desk-fuel"
              className="block w-full py-4 bg-yellow-400 text-neutral-950 rounded-full text-xs font-bold tracking-wider uppercase text-center hover:bg-yellow-300 transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
            >
              SELECT PLAN
            </Link>
          </div>
        </div>

        {/* Plan: Protein Build */}
        <div className="bg-neutral-900 border border-white/5 rounded-3xl overflow-hidden">
          <div className="p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-[20px] font-medium text-stone-100 leading-[1.3]">Protein Build</h3>
                <p className="text-[14px] text-neutral-400">Hypertrophy &amp; recovery focus</p>
              </div>
              <div className="flex gap-2">
                <div className="h-8 w-8 rounded-full border border-white/5 flex items-center justify-center text-neutral-400">
                  <span className="material-symbols-outlined text-[18px]">restaurant</span>
                </div>
              </div>
            </div>

            <div className="flex items-baseline gap-2 mb-8">
              <span className="font-mono text-[24px] font-medium text-yellow-400">{formatPaise(proteinBuild.pricePerMealPaise ?? 0)}</span>
              <span className="font-mono text-[14px] text-neutral-400">/meal</span>
              <div className="ml-auto text-right">
                <span className="block font-mono text-[14px] text-stone-100">{formatPaise(proteinBuild.cycleTotalPaise)}</span>
                <span className="block text-[10px] font-bold tracking-wider text-neutral-400 uppercase text-right mt-1">Monthly billing</span>
              </div>
            </div>

            <Link
              href="/plan/protein-build"
              className="block w-full py-4 bg-yellow-400 text-neutral-950 rounded-full text-xs font-bold tracking-wider uppercase text-center hover:bg-yellow-300 transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
            >
              SELECT PLAN
            </Link>
          </div>
        </div>

        {/* Plan: Steady (Waitlist) */}
        <div className="bg-neutral-900/40 border border-white/5 rounded-3xl overflow-hidden opacity-80">
          <div className="p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-[20px] font-medium text-stone-100 leading-[1.3]">Steady</h3>
                <p className="text-[14px] text-neutral-400">Insulin sensitivity protocol</p>
              </div>
              <span className="text-xs font-bold tracking-wider text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded uppercase">SOON</span>
            </div>

            <div className="flex items-baseline gap-2 mb-8">
              <span className="font-mono text-[24px] font-medium text-neutral-400">{formatPaise(steady.pricePerMealPaise ?? 0)}</span>
              <span className="font-mono text-[14px] text-neutral-400">/meal</span>
            </div>

            <button
              type="button"
              className="w-full py-4 border border-yellow-400/40 text-yellow-400 rounded-full text-xs font-bold tracking-wider uppercase hover:bg-yellow-400/5 transition-colors active:scale-[0.98]"
            >
              JOIN WAITLIST
            </button>
          </div>
        </div>

        {/* Plan: GLP-1 (Waitlist) */}
        <div className="bg-neutral-900/40 border border-white/5 rounded-3xl overflow-hidden opacity-80">
          <div className="p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-[20px] font-medium text-stone-100 leading-[1.3]">GLP-1 Support</h3>
                <p className="text-[14px] text-neutral-400">Muscle-sparing medical diet</p>
              </div>
              <span className="text-xs font-bold tracking-wider text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded uppercase">SOON</span>
            </div>

            <div className="flex items-baseline gap-2 mb-8">
              <span className="font-mono text-[24px] font-medium text-neutral-400">
                {formatPaise(glp1.pricePerMealPaise ?? Math.round(glp1.cycleTotalPaise / glp1.mealsPerCycle))}
              </span>
              <span className="font-mono text-[14px] text-neutral-400">/meal</span>
            </div>

            <button
              type="button"
              className="w-full py-4 border border-yellow-400/40 text-yellow-400 rounded-full text-xs font-bold tracking-wider uppercase hover:bg-yellow-400/5 transition-colors active:scale-[0.98]"
            >
              JOIN WAITLIST
            </button>
          </div>
        </div>

        {/* B2B Section */}
        <div className="mt-8 mb-12 flex flex-col items-center border-t border-white/5 pt-8">
          <h4 className="text-xs font-bold tracking-wider text-neutral-400 mb-2 uppercase">Corporate Solutions</h4>
          <h3 className="text-[18px] font-medium text-stone-100 mb-4 text-center leading-[1.3]">Tanmatra for Teams</h3>
          <Link href="/corporate" className="text-[14px] text-yellow-400 flex items-center gap-1 group hover:text-yellow-300 transition-colors">
            Talk to Sales
            <span className="material-symbols-outlined text-[16px] group-hover:translate-x-0.5 transition-transform">chevron_right</span>
          </Link>
        </div>
      </section>

      {/* Aesthetic Backdrop Elements */}
      <div className="fixed top-1/4 -left-64 w-96 h-96 bg-yellow-400/5 blur-[120px] rounded-full pointer-events-none z-0"></div>
      <div className="fixed bottom-1/4 -right-64 w-96 h-96 bg-yellow-400/5 blur-[120px] rounded-full pointer-events-none z-0"></div>
    </main>
  );
}
