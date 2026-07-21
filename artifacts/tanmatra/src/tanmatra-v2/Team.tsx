import { Link } from "react-router";
import { TEAM } from "@/lib/teamData";

/* Full-parity re-port of the System-A Team page (git 2507084) into the
 * v2 (.tnm2) design language — same TEAM data + role grouping, v2 UI. */

const ACCENT: Record<string, { c: string; bg: string }> = {
  gold: { c: "var(--safb)", bg: "var(--safd)" },
  sage: { c: "var(--sage)", bg: "var(--saged)" },
  blue: { c: "var(--color-nn-tertiary)", bg: "color-mix(in srgb, var(--color-nn-tertiary) 12%, transparent)" },
};

function TeamCard({ member }: { member: any }) {
  const acc = ACCENT[member.accent] ?? ACCENT.gold;
  return (
    <Link to={`/team/${member.slug}`} className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4 mb10" style={{ display: "block" }}>
      <div className="fx gap12">
        <div className="avatar big" style={{ background: acc.bg, borderColor: acc.c, color: acc.c }}>{member.initials}</div>
        <div className="f1" style={{ minWidth: 0 }}>
          <div className="fx ac g6">
            <div className="tt f1 clamp1" style={{ fontSize: 15 }}>{member.name}</div>
            {member.role === "rd" && <span className="pill sg" style={{ fontSize: 10 }}><i className="ph-fill ph-shield-check" />RD</span>}
          </div>
          <div className="fine clamp1">{member.title}</div>
        </div>
      </div>
      <div className="fine mt10">{member.signatureLine}</div>
      <div className="fx ac jb mt10">
        <span className="lab">{member.yearsExperience} yrs experience</span>
        <span className="linkq">View profile <i className="ph-bold ph-arrow-right" /></span>
      </div>
    </Link>
  );
}

export default function V2Team() {
  const chefs = TEAM.filter((m: any) => m.role === "chef");
  const rds = TEAM.filter((m: any) => m.role === "rd");

  return (
    <div className="tnm2 nn min-h-dvh bg-[var(--tnm-surface-ink)] text-white antialiased">
      <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100dvh" }}>
        {/* App bar */}
        <div className="appbar">
          <Link className="iconbtn" to="/" aria-label="Home"><i className="ph-bold ph-arrow-left" /></Link>
          <div className="abt">Our team</div>
        </div>

        {/* Hero */}
        <div className="padx mt6 mb10">
          <span className="pill" style={{ background: "var(--safd)", color: "var(--safb)" }}>Behind the food</span>
          <div className="h2 mt10">Meet the people on your plate</div>
          <div className="fine mt6">
            Every dish at Tanmatra is owned end-to-end. A head chef cooks it, a registered
            dietitian signs it off, and both of their names sit next to the meal — not on a
            corporate page.
          </div>
        </div>

        {/* Chefs */}
        <div className="secrow"><span className="sh"><i className="ph-bold ph-chef-hat" style={{ color: "var(--safb)" }} /> Chefs</span></div>
        <div className="padx">
          {chefs.map((m: any) => <TeamCard key={m.slug} member={m} />)}
        </div>

        {/* Registered Dietitians */}
        <div className="secrow"><span className="sh"><i className="ph-bold ph-stethoscope" style={{ color: "var(--sage)" }} /> Registered Dietitians</span></div>
        <div className="padx mb20">
          {rds.map((m: any) => <TeamCard key={m.slug} member={m} />)}
        </div>
      </div>
    </div>
  );
}
