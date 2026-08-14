import { Link } from "react-router";
import { ShieldCheck, CalendarPlus, SealCheck } from "@phosphor-icons/react";
import { formatPrice } from "@/lib/api/adapter";
import { getTeamMemberBySlug } from "@/lib/teamData";

/**
 * Every fact about the dietitian is READ from teamData, not typed here.
 *
 * This card used to hardcode its own version of her in JSX: "Dr. Anjali Nair,
 * RD", "17 Yrs Experience", and credential chips reading "PhD, AIIMS",
 * "Registered Dietitian (IDA)", "ADA Diabetes Educator" — a fourth copy of a
 * roster that already existed three times, and the most over-stated of the four.
 * The server record a customer actually books against says MSc, 12 years, and
 * no doctorate. Binding to teamData means this card cannot claim more than the
 * roster does, and teamData mirrors the api-server's rdIdentity.ts.
 *
 * The verified seal is now gated on `verifyUrl`. It sat unconditionally beside
 * the name, which is a claim of third-party verification; TeamMember has
 * `councilNumber` / `councilName` / `verifyUrl` fields for exactly that and no
 * RD fills them in. A seal nobody can follow is decoration pretending to be
 * evidence, so it renders only once there is something to verify against.
 */
export default function HomeDietitian() {
  const rd = getTeamMemberBySlug("rd-anjali-nair");
  if (!rd) return null;

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
          <span className="text-2xl font-bold text-[var(--tnm-action)]">{rd.initials}</span>
        </div>

        <div className="f1">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <h4 className="text-base font-bold text-white/95 flex items-center gap-1.5">
                {rd.name}
                {rd.verifyUrl && (
                  <SealCheck className="w-4 h-4 text-[var(--tnm-action)]" weight="fill" />
                )}
              </h4>
              <p className="fine text-[var(--tnm-action)]/80 font-medium mt-0.5">
                {rd.title}
              </p>
            </div>
            <span className="text-[10px] uppercase font-bold text-white/45 bg-white/5 px-2 py-0.5 rounded tracking-wider self-start md:self-auto">
              {rd.yearsExperience} Yrs Experience
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-3">
            {rd.credentials.map((c) => (
              <span key={c} className="text-[10px] bg-white/5 text-white/70 px-2 py-0.5 rounded">{c}</span>
            ))}
          </div>

          <p className="fine text-white/60 mt-4 leading-relaxed">
            {rd.bio}
          </p>

          <div className="card bg-white/[0.02] border border-white/5 mt-4 p-3 rounded-xl flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-[var(--tnm-action)] shrink-0" weight="fill" />
            <span className="text-xs text-white/80 leading-snug">
              &ldquo;{rd.signatureLine}&rdquo;
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
              to={`/rd/${rd.slug}`}
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
