import type { CSSProperties } from "react";
import { Link } from "react-router";
import { useChallenges } from "@/lib/contentApi";
import CommunityCohortPanel from "@/components/CommunityCohortPanel";

function formatRange(startsAt: string, endsAt: string): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  return `${fmt(s)} – ${fmt(e)}`;
}

function statusFor(
  startsAt: string,
  endsAt: string,
): { label: string; tone: "live" | "soon" | "ended" } {
  const now = Date.now();
  const s = new Date(startsAt).getTime();
  const e = new Date(endsAt).getTime();
  if (now < s) return { label: "Starts soon", tone: "soon" };
  if (now > e) return { label: "Ended", tone: "ended" };
  return { label: "Live now", tone: "live" };
}

function statusPill(tone: "live" | "soon" | "ended"): {
  cls: string;
  style?: CSSProperties;
} {
  if (tone === "live") return { cls: "pill sg" };
  if (tone === "soon")
    return {
      cls: "pill",
      style: { background: "var(--safd)", color: "var(--safb)" },
    };
  return { cls: "pill" };
}

export default function V2Challenges() {
  const { data: challenges, isLoading, isError } = useChallenges();

  return (
    <div className="tnm2 nn" style={{ minHeight: "100dvh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="appbar">
          <Link className="iconbtn" to="/" aria-label="Home">
            <i className="ph-bold ph-arrow-left" />
          </Link>
          <div className="abt">Challenges</div>
        </div>

        <div className="content padx" style={{ paddingTop: 4, paddingBottom: 24 }}>
          <div className="lab" style={{ color: "var(--safb)" }}>
            <i className="ph-bold ph-flag" style={{ marginRight: 6 }} />
            Cohort Challenges
          </div>
          <h1 className="disp" style={{ margin: "8px 0 6px", color: "var(--text-primary)" }}>
            Time-boxed resets, with the cohort
          </h1>
          <p className="small mut" style={{ maxWidth: 340 }}>
            Each challenge bundles a meal plan, RD check-ins, and a private feed
            where the cohort shares progress.
          </p>

          <div className="mt16 mb16">
            <CommunityCohortPanel />
          </div>

          {isError && (
            <div className="tc" style={{ padding: "40px 20px" }}>
              <i
                className="ph-bold ph-warning-circle"
                style={{ fontSize: 30, color: "var(--dgr)" }}
              />
              <div className="tt mt10">Couldn't load challenges</div>
              <div className="fine mt6">
                Please check your connection and try again.
              </div>
            </div>
          )}

          {isLoading &&
            [0, 1, 2].map((i) => (
              <div
                key={i}
                className="card mb12"
                style={{ padding: 0, overflow: "hidden" }}
              >
                <div className="skel" style={{ height: 150, borderRadius: 0 }} />
                <div style={{ padding: 14 }}>
                  <div className="skel" style={{ height: 16, width: "68%" }} />
                  <div
                    className="skel mt6"
                    style={{ height: 12, width: "92%" }}
                  />
                  <div className="skel mt10" style={{ height: 44 }} />
                </div>
              </div>
            ))}

          {!isLoading &&
            !isError &&
            challenges?.map((c) => {
              const status = statusFor(c.startsAt, c.endsAt);
              const sp = statusPill(status.tone);
              return (
                <Link
                  key={c.id}
                  className="card pointer mb12"
                  to={`/challenges/${c.slug}`}
                  style={{ display: "block", padding: 0, overflow: "hidden" }}
                >
                  <div
                    className="plc"
                    style={{
                      height: 150,
                      backgroundImage: c.image ? `url(${c.image})` : undefined,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    <div className="herograd" />
                    <div
                      className="posabs w100 fx ac jb"
                      style={{ top: 0, left: 0, padding: "10px 12px", zIndex: 2 }}
                    >
                      {c.featured > 0 ? (
                        <span
                          className="pill"
                          style={{
                            background: "var(--safd)",
                            color: "var(--safb)",
                          }}
                        >
                          <i className="ph-fill ph-sparkle" />
                          Featured
                        </span>
                      ) : (
                        <span />
                      )}
                      <span className={sp.cls} style={sp.style}>
                        {status.label}
                      </span>
                    </div>
                  </div>

                  <div style={{ padding: 14 }}>
                    <h3 className="dtitle" style={{ margin: 0 }}>
                      {c.title}
                    </h3>
                    <div className="fine mt4">{c.tagline}</div>

                    {c.goalTags.length > 0 && (
                      <div className="fx wrap g6 mt10">
                        {c.goalTags.slice(0, 3).map((tag) => (
                          <span key={tag} className="pill">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="ribbon cmp mt10">
                      <div className="rc">
                        <span className="rl">DURATION</span>
                        <span className="rv">
                          {c.durationDays}
                          <i className="ru">d</i>
                        </span>
                      </div>
                      <div className="rc">
                        <span className="rl">JOINED</span>
                        <span className="rv">{c.memberCount}</span>
                      </div>
                      <div className="rc">
                        <span className="rl">WINDOW</span>
                        <span className="rv" style={{ fontSize: 11 }}>
                          {formatRange(c.startsAt, c.endsAt)}
                        </span>
                      </div>
                    </div>

                    <div className="fine mt10 fx ac g6">
                      <i className="ph-bold ph-user-circle safc" />
                      Led by {c.rdName}
                    </div>

                    <span className="btn btn-p btn-blk mt10">
                      View challenge
                      <i className="ph-bold ph-arrow-right" />
                    </span>
                  </div>
                </Link>
              );
            })}

          {!isLoading && !isError && (challenges?.length ?? 0) === 0 && (
            <div className="tc" style={{ padding: "52px 20px" }}>
              <i
                className="ph-bold ph-flag"
                style={{ fontSize: 32, color: "var(--fnt)" }}
              />
              <div className="tt mt10">No challenges right now</div>
              <div className="fine mt6">
                Check back soon — new cohorts open regularly.
              </div>
              <Link className="btn btn-g mt20" to="/menu">
                Browse the menu
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
