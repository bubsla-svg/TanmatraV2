import { Link, useLocation } from "react-router";
import { Dna, Zap, HeartPulse } from "lucide-react";

const SEGMENTS = [
  { id: "wellness", label: "Wellness", icon: HeartPulse, path: "/wellness", color: "text-clinical-sage", bg: "bg-clinical-sage/10", border: "border-clinical-sage/30" },
  { id: "performance", label: "Performance", icon: Zap, path: "/performance", color: "text-[var(--color-nn-tertiary)]", bg: "bg-[color-mix(in_srgb,var(--color-nn-tertiary)_10%,transparent)]", border: "border-[color-mix(in_srgb,var(--color-nn-tertiary)_30%,transparent)]" },
  { id: "clinical", label: "Clinical", icon: Dna, path: "/clinical", color: "text-[var(--color-nn-primary)]", bg: "bg-[color-mix(in_srgb,var(--color-nn-primary)_10%,transparent)]", border: "border-[color-mix(in_srgb,var(--color-nn-primary)_30%,transparent)]" },
];

export default function SegmentToggle() {
  const location = useLocation();

  return (
    <div className="sticky top-14 z-40 bg-[color-mix(in_srgb,var(--color-nn-bg)_90%,transparent)] backdrop-blur-xl border-b border-white/[0.08]">
      <div className="max-w-7xl mx-auto px-4 py-2.5">
        <div className="flex items-center gap-2 justify-center">
          <span className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-[var(--color-nn-on-surface-variant)] mr-2 hidden sm:inline">Protocol</span>
          {SEGMENTS.map((seg) => {
            const isActive = location.pathname === seg.path;
            return (
              <Link
                key={seg.id}
                to={seg.path}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 border ${
                  isActive
                    ? `${seg.bg} ${seg.color} ${seg.border}`
                    : "bg-transparent text-[var(--color-nn-on-surface-variant)] border-transparent hover:bg-white/5 hover:text-white"
                }`}
              >
                <seg.icon className="w-3.5 h-3.5" />
                {seg.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
