import { Link } from "react-router";
import { ShieldCheck, CalendarPlus, SealCheck } from "@phosphor-icons/react";
import { formatPrice } from "@/lib/api/adapter";

export default function HomeDietitian() {
  const followUpPrice = formatPrice(120000); // ₹1,200 from rdBookingData

  return (
    <section className="padx mt-12 bg-white/[0.01] py-10 border-t border-white/5">
      <div className="secrow px-0 mb-6 flex flex-col items-start gap-2">
        <span className="sh text-base font-bold text-white/95">Clinical governance</span>
        <h3 className="text-xl font-bold text-white/90">Meet our Lead Dietitian</h3>
      </div>

      <div className="card flex flex-col md:flex-row gap-6 items-start border border-white/5" style={{ background: "var(--tnm-surface-ink-2)" }}>
        {/* Avatar / Icon Placeholder */}
        <div className="shrink-0 w-20 h-20 rounded-2xl bg-[var(--tnm-action)]/10 flex items-center justify-center border border-[var(--tnm-action)]/20">
          <span className="text-2xl font-bold text-[var(--tnm-action)]">AN</span>
        </div>

        <div className="f1">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <h4 className="text-base font-bold text-white/95 flex items-center gap-1.5">
                Dr. Anjali Nair, RD
                <SealCheck className="w-4 h-4 text-[var(--tnm-action)]" weight="fill" />
              </h4>
              <p className="fine text-[var(--tnm-action)]/80 font-medium mt-0.5">
                Lead Dietitian — Cardiometabolic Protocol
              </p>
            </div>
            <span className="text-[10px] uppercase font-bold text-white/45 bg-white/5 px-2 py-0.5 rounded tracking-wider self-start md:self-auto">
              17 Yrs Experience
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-3">
            <span className="text-[10px] bg-white/5 text-white/70 px-2 py-0.5 rounded">PhD, AIIMS</span>
            <span className="text-[10px] bg-white/5 text-white/70 px-2 py-0.5 rounded">Registered Dietitian (IDA)</span>
            <span className="text-[10px] bg-white/5 text-white/70 px-2 py-0.5 rounded">ADA Diabetes Educator</span>
          </div>

          <p className="fine text-white/60 mt-4 leading-relaxed">
            Dr. Anjali oversees all clinical nutrition standards at Tanmatra. She reviews every dish recipe for saturated fat ratios, sodium caps, and glycemic thresholds to ensure meals match therapeutic profiles.
          </p>

          <div className="card bg-white/[0.02] border border-white/5 mt-4 p-3 rounded-xl flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-[var(--tnm-action)] shrink-0" weight="fill" />
            <span className="text-xs text-white/80 leading-snug">
              &ldquo;Every plate signed off for sodium limits, glycemic load, and healthy fat ratios before it leaves our kitchen.&rdquo;
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6 pt-4 border-t border-white/5">
            <div className="flex flex-col">
              <span className="text-[10px] text-white/45 font-semibold uppercase tracking-wider">Consultation Fee</span>
              <span className="text-xs text-white/85 mt-1">
                <span className="text-[var(--tnm-action)] font-bold">Free</span> 15-min intro &bull; <span className="font-semibold">{followUpPrice}</span>/30m follow-up
              </span>
            </div>
            <Link
              to="/rd/rd-anjali-nair"
              className="btn btn-s btn-p text-xs font-bold px-4 flex items-center justify-center gap-1.5"
              style={{ height: 36 }}
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              Book Consult
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
