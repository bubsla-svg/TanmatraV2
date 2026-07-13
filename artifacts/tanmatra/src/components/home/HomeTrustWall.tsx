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
    title: "Registered Dietitians",
    desc: "Every single recipe is formulated and approved by clinical nutritionists.",
  },
  {
    icon: Waves,
    title: "Low-GI Indexing",
    desc: "Carbohydrate ingredients tested and categorized for low glycemic load.",
  },
  {
    icon: CheckSquare,
    title: "Audited Macros",
    desc: "Lab tested and verified nutritional metrics for calorie and protein precision.",
  },
  {
    icon: Calendar,
    title: "Pause or Skip Anytime",
    desc: "Flexible digital portal controls to freeze deliveries up to 24h prior.",
  },
];

export default function HomeTrustWall() {
  return (
    <section className="padx mt-12 bg-white/[0.02] py-8 border-y border-white/5">
      <div className="secrow px-0 flex flex-col items-center text-center gap-2 mb-6">
        <span className="sh text-base font-bold uppercase tracking-wider text-white/45">
          Verifiable clinical safety
        </span>
        <h3 className="text-xl font-bold text-white/90">Our operational trust criteria</h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {TRUST_ITEMS.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="card flex flex-col gap-2.5 items-start"
              style={{ background: "var(--s1)", borderColor: "var(--ln)", padding: "12px 14px" }}
            >
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/70">
                <Icon className="w-4.5 h-4.5" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-white/90 leading-tight">{item.title}</span>
                <p className="text-[10px] text-white/50 leading-relaxed mt-1">{item.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
