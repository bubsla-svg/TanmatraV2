import { useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { listRds, formatRupees } from "@/lib/rdBookingData";
import {
  PROTOCOLS,
  PROTOCOL_LABELS,
  PROTOCOL_TAGLINES,
  isProtocol,
  rdsForProtocol,
  type Protocol,
} from "@/lib/protocols";

const ACCENT: Record<string, { background: string; color: string; border: string }> = {
  sage: { background: "var(--saged)", color: "var(--sage)", border: "1px solid color-mix(in oklab, var(--color-clinical-sage) 35%, transparent)" },
  blue: { background: "var(--color-clinical-blue-light)", color: "var(--color-clinical-blue)", border: "1px solid color-mix(in oklab, var(--color-clinical-blue) 32%, transparent)" },
  gold: { background: "var(--safd)", color: "var(--safb)", border: "1px solid var(--saf)" },
};

export default function V2RdDirectory() {
  const allRds = listRds();
  const [searchParams, setSearchParams] = useSearchParams();
  const protocolParam = searchParams.get("protocol");
  const activeProtocol: Protocol | null = isProtocol(protocolParam)
    ? protocolParam
    : null;

  const rds = useMemo(() => {
    if (!activeProtocol) return allRds;
    const matching = new Set(
      rdsForProtocol(
        allRds.map(({ profile }) => profile),
        activeProtocol,
      ).map((p) => p.slug),
    );
    return allRds.filter(({ profile }) => matching.has(profile.slug));
  }, [allRds, activeProtocol]);

  function setProtocol(p: Protocol | null) {
    const next = new URLSearchParams(searchParams);
    if (p) next.set("protocol", p);
    else next.delete("protocol");
    setSearchParams(next, { replace: true });
  }

  function clearProtocol() {
    setProtocol(null);
  }

  return (
    <div className="tnm2 nn" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="appbar">
          <Link className="iconbtn" to="/" aria-label="Home"><i className="ph-bold ph-arrow-left" /></Link>
          <div className="abt">Dietitians</div>
          <Link className="iconbtn" to="/appointments" title="My appointments" aria-label="My appointments"><i className="ph-bold ph-calendar-dots" /></Link>
        </div>

        <div className="chiprow">
          <button className={!activeProtocol ? "chip on" : "chip"} onClick={() => setProtocol(null)}>All RDs</button>
          {PROTOCOLS.map((p) => (
            <button key={p} className={activeProtocol === p ? "chip on" : "chip"} onClick={() => setProtocol(p)}>{PROTOCOL_LABELS[p]}</button>
          ))}
        </div>

        <div className="content padx" style={{ paddingTop: 8, paddingBottom: 24 }}>
          <div className="lab" style={{ color: "var(--safb)" }}>1:1 Advisory</div>
          <h1 className="h2 mt6" style={{ color: "var(--text-primary)" }}>
            {activeProtocol
              ? `${PROTOCOL_LABELS[activeProtocol]} Protocol — RD specialists`
              : "Book a registered dietitian"}
          </h1>
          <p className="small mut mt6">
            {activeProtocol
              ? PROTOCOL_TAGLINES[activeProtocol]
              : "Start with a free 15-minute intro to align goals, then move into paid follow-ups for plan adjustments, lab review, and ongoing support. Every RD here is on staff and signs off our menu."}
          </p>

          {activeProtocol && (
            <div className="fx ac wrap gap8 mt10">
              <span className="fine">Showing {rds.length} of {allRds.length} RDs matching this protocol.</span>
              <button type="button" onClick={clearProtocol} className="linkq" style={{ fontSize: 12 }}>
                Clear filter <i className="ph-bold ph-x" style={{ fontSize: 12 }} />
              </button>
            </div>
          )}

          {rds.length === 0 ? (
            <div className="tc" style={{ padding: "40px 20px" }}>
              <i className="ph-bold ph-user-list" style={{ fontSize: 32, color: "var(--fnt)" }} />
              <div className="tt mt10">
                {activeProtocol ? "No RDs match this protocol" : "No dietitians available"}
              </div>
              <div className="fine mt6">
                {activeProtocol
                  ? "Try the full directory to see everyone on staff."
                  : "Please check back shortly."}
              </div>
              {activeProtocol && (
                <button className="btn btn-g mt20" onClick={clearProtocol}>See the full directory</button>
              )}
            </div>
          ) : (
            <div className="mt14">
              {rds.map(({ profile, member }) => {
                const accent = ACCENT[member.accent] ?? ACCENT.gold;
                return (
                  <div key={profile.slug} className="card mb10">
                    <div className="fx gap12" style={{ alignItems: "flex-start" }}>
                      <div className="avatar" style={accent}>{member.initials}</div>
                      <div className="f1" style={{ minWidth: 0 }}>
                        <div className="tt clamp1">{member.name}</div>
                        <div className="fine">{member.title}</div>
                      </div>
                    </div>

                    <p
                      className="fine mt10"
                      style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                    >
                      {member.bio}
                    </p>

                    <div className="fx col gap8 mt10">
                      <div className="fx gap8" style={{ alignItems: "flex-start" }}>
                        <i className="ph-bold ph-stethoscope sagec" style={{ fontSize: 15, flex: "none", marginTop: 1 }} />
                        <span className="fine">{profile.specialties.join(" · ")}</span>
                      </div>
                      <div className="fx gap8" style={{ alignItems: "flex-start" }}>
                        <i className="ph-bold ph-globe sagec" style={{ fontSize: 15, flex: "none", marginTop: 1 }} />
                        <span className="fine">{profile.languages.join(", ")}</span>
                      </div>
                    </div>

                    <div className="fx ac jb mt14" style={{ paddingTop: 12, borderTop: "1px solid var(--ln)" }}>
                      <div className="fine">
                        <span className="sagec fw6">Free</span> intro ·{" "}
                        <span className="price" style={{ color: "var(--tx)" }}>{formatRupees(profile.followUp30PricePaise)}</span>/30m
                      </div>
                      <Link className="btn btn-p" to={`/rd/${profile.slug}`} style={{ height: 38, fontSize: 13, padding: "0 14px" }}>
                        <i className="ph-bold ph-calendar-dots" />
                        Book
                        <i className="ph-bold ph-caret-right" style={{ fontSize: 12 }} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="card mt14">
            <div className="fx ac gap8 mb6">
              <i className="ph-bold ph-calendar-check safc" style={{ fontSize: 18 }} />
              <span className="tt">Already booked?</span>
            </div>
            <p className="fine mb10">
              See your upcoming sessions, message your RD, log progress, and share lab results from your appointments dashboard.
            </p>
            <Link className="btn btn-g btn-blk" to="/appointments">Open my appointments</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
