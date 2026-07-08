import { Link, useParams } from "react-router";
import { getOwnedDishesForMember, getTeamMemberBySlug } from "@/lib/teamData";
import { LIFESTYLE_LABELS } from "@/lib/dishEnrichment";
import { F } from "./data";

/* ------------------------------------------------------------------ *
 * Full-parity re-port of the System-A TeamMember profile into the v2  *
 * (.tnm2) design language. Reuses the exact useParams + TEAM lookup +  *
 * getOwnedDishesForMember logic from the original — only presentation  *
 * changes. Reference: git 2507084 src/pages/TeamMember.tsx.            *
 * ------------------------------------------------------------------ */

// Accent → v2 palette. The prototype palette has gold (saf) + sage; there is
// no blue token, so the performance RD's blue accent maps onto a fixed hue.
const ACCENT: Record<string, { text: string; bg: string; border: string }> = {
  gold: { text: "var(--safb)", bg: "var(--safd)", border: "var(--saf)" },
  sage: { text: "var(--sage)", bg: "var(--saged)", border: "var(--sage)" },
  blue: { text: "#7FA8D9", bg: "rgba(127,168,217,.14)", border: "rgba(127,168,217,.55)" },
};

export default function V2TeamMember() {
  const { slug } = useParams<{ slug: string }>();
  const member: any = slug ? getTeamMemberBySlug(slug) : undefined;

  if (!member) {
    return (
      <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div className="appbar">
            <Link className="iconbtn" to="/team"><i className="ph-bold ph-arrow-left" /></Link>
            <div className="abt">Team</div>
          </div>
          <div className="padx tc" style={{ paddingTop: 48 }}>
            <i className="ph-bold ph-user-circle-minus" style={{ fontSize: 34, color: "var(--saf)" }} />
            <div className="tt mt20">Profile not found</div>
            <div className="fine mt6">No team member with slug “{slug}”.</div>
            <Link className="btn btn-g btn-blk mt20" to="/team"><i className="ph-bold ph-arrow-left" /> Back to team</Link>
          </div>
        </div>
      </div>
    );
  }

  const accent = ACCENT[member.accent] ?? ACCENT.gold;
  const ownedDishes = getOwnedDishesForMember(member);
  const isRd = member.role === "rd";

  return (
    <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {/* App bar */}
        <div className="appbar">
          <Link className="iconbtn" to="/team" aria-label="Back to team"><i className="ph-bold ph-arrow-left" /></Link>
          <div className="abt clamp1">{member.name}</div>
        </div>

        <div className="content">
          {/* Profile header card */}
          <div className="padx">
            <div className="card tc">
              <div
                className="avatar"
                style={{
                  width: 88, height: 88, fontSize: 28, margin: "0 auto",
                  color: accent.text, background: accent.bg,
                  boxShadow: `0 0 0 4px ${accent.bg}`, borderColor: accent.border,
                }}
              >
                {member.initials}
              </div>
              <div className="tt mt10">{member.name}</div>
              <div className="fine mt2">{member.title}</div>
              <div className="fx ac jc mt10">
                <span
                  className="pill"
                  style={{ background: accent.bg, color: accent.text }}
                >
                  <i className={`ph-fill ${isRd ? "ph-seal-check" : "ph-chef-hat"}`} />
                  {isRd ? "Registered Dietitian" : "Head Chef"}
                </span>
              </div>
              <div className="lab mt10">{member.yearsExperience} years experience</div>
            </div>
          </div>

          {/* Signature line */}
          <div className="padx mt16">
            <p className="small" style={{ color: accent.text, lineHeight: 1.5 }}>{member.signatureLine}</p>
          </div>

          {/* Bio */}
          <div className="padx mt10">
            <p className="small mut" style={{ lineHeight: 1.55 }}>{member.bio}</p>
          </div>

          {/* Credentials */}
          <div className="padx mt16">
            <div className="lab mb10"><i className="ph-bold ph-medal" style={{ color: "var(--safb)" }} /> Credentials</div>
            <ul className="col g6">
              {member.credentials.map((c: string) => (
                <li key={c} className="fine">• {c}</li>
              ))}
            </ul>
          </div>

          {/* Lifestyles / owned protocols */}
          {member.lifestyles && member.lifestyles.length > 0 && (
            <div className="padx mt16">
              <div className="lab mb10">Specialises in</div>
              <div className="fx ac g6 wrap">
                {member.lifestyles.map((l: string) => (
                  <span key={l} className="pill" style={{ background: accent.bg, color: accent.text }}>
                    {(LIFESTYLE_LABELS as any)[l]}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Owned dishes */}
          {ownedDishes.length > 0 && (
            <div className="padx mt20">
              <div className="lab mb10">
                {member.role === "chef" ? "Dishes from this kitchen" : "Dishes signed off by this RD"}
              </div>
              <div className="prodgrid">
                {ownedDishes.map((d: any) => (
                  <Link key={d.id} to={`/dish/${d.slug}`} className="card" style={{ padding: 0, overflow: "hidden", display: "block" }}>
                    <div
                      className="plc"
                      style={{ aspectRatio: "1 / 1", backgroundImage: `url(${d.image})`, backgroundSize: "cover", backgroundPosition: "center" }}
                    />
                    <div style={{ padding: 12 }}>
                      <div className="small clamp1" style={{ fontWeight: 500 }}>{d.name}</div>
                      <div className="mono fntc mt2" style={{ fontSize: 11 }}>{d.macros.calories} kcal · {F(d.price)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div style={{ height: 24 }} />
        </div>
      </div>
    </div>
  );
}
