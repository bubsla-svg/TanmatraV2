import { Certificate, ShieldCheck, ClipboardText, Waves, CheckSquare, Calendar } from "@phosphor-icons/react";

interface TrustItem {
  icon: typeof Certificate;
  title: string;
  desc: string;
}

const TRUST_ITEMS: TrustItem[] = [
  {
    icon: Certificate,
    title: "ISO 22000:2018 Kitchen",
    desc: "Certified food safety management system covering all prep areas.",
  },
  {
    icon: ShieldCheck,
    title: "FSSAI Lic. 22725926001018",
    desc: "100% compliant food operator registration and kitchen audit standards.",
  },
  {
    icon: ClipboardText,
    title: "Designed by dietitians",
    desc: "Every recipe is designed and approved by registered dietitians.",
  },
  {
    icon: Waves,
    title: "Steady energy",
    desc: "Carbohydrates chosen for a gentler effect on blood sugar.",
  },
  {
    icon: CheckSquare,
    title: "Macros on every dish",
    desc: "Calories, protein and allergens are listed for every meal (ingredient-estimated where noted).",
  },
  {
    icon: Calendar,
    title: "Pause or skip anytime",
    desc: "Pause your subscription or skip individual days from your account.",
  },
];

export default function HomeTrustWall() {
  return (
    <section className="padx mt-12 bg-white/[0.02] py-10 border-y border-white/[0.06]">
      <div className="secrow px-0 flex flex-col items-center text-center gap-1.5 mb-8">
        <span className="text-[10px] uppercase font-mono tracking-widest text-white/45">
          Why you can trust Tanmatra
        </span>
        <h3 className="text-xl font-semibold tracking-tight text-white/90">Food safety &amp; quality, verified</h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {TRUST_ITEMS.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-neutral-900/80 border border-white/[0.06] backdrop-blur-xl flex flex-col gap-3 items-start shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-all"
            >
              <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/[0.06] flex items-center justify-center text-amber-400">
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold tracking-tight text-white/95 leading-tight">{item.title}</span>
                <p className="text-[11px] text-white/60 leading-relaxed mt-0.5">{item.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
