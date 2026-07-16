import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  APPOINTMENT_KIND_META,
  formatRupees,
  getRdMember,
  getRdProfile,
  priceForKind,
  type AppointmentKind,
  type SlotOption,
} from "@/lib/rdBookingData";
import { rdAdvisoryApi } from "@/lib/rdAdvisoryApi";
import { toast } from "sonner";

const KINDS: AppointmentKind[] = [
  "intro_15m",
  "follow_up_30m",
  "follow_up_45m",
];

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function V2RdProfile() {
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const profile = getRdProfile(slug);
  const member = getRdMember(slug);

  const [kind, setKind] = useState<AppointmentKind>("intro_15m");
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [selected, setSelected] = useState<SlotOption | null>(null);
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Presentation-only flags so the v2 slot picker can show a shimmer while the
  // canonical fetch is in flight and an error-flavoured empty block if it fails.
  // These do not affect any endpoint, query key, or booking logic.
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Fetch slots from the canonical server endpoint (not local generation),
  // so booking always references the same office-hour windows + taken set
  // the server will validate against.
  useEffect(() => {
    if (!profile) return;
    let alive = true;
    setLoading(true);
    setLoadError(false);
    rdAdvisoryApi
      .slots(profile.slug, kind)
      .then((r) => {
        if (alive) {
          setSlots(r.slots.slice(0, 60));
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) {
          setSlots([]);
          setLoadError(true);
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [profile, kind]);

  const meta = APPOINTMENT_KIND_META[kind];

  const grouped = useMemo(() => {
    const out: Record<string, SlotOption[]> = {};
    for (const s of slots) {
      const day = s.startAt.slice(0, 10);
      (out[day] = out[day] ?? []).push(s);
    }
    return out;
  }, [slots]);

  if (!profile || !member) {
    return (
      <div className="tnm2 nn" style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div className="appbar">
            <Link className="iconbtn" to="/rd" aria-label="All RDs">
              <i className="ph-bold ph-arrow-left" />
            </Link>
            <div className="abt">RD profile</div>
          </div>
          <div className="content padx">
            <div className="tc" style={{ padding: "52px 20px" }}>
              <i
                className="ph-bold ph-user-circle-minus"
                style={{ fontSize: 32, color: "var(--fnt)" }}
              />
              <div className="tt mt10">RD not found</div>
              <div className="fine mt6">
                We couldn't find that dietitian.
              </div>
              <Link className="btn btn-g mt20" to="/rd">
                Back to directory
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const price = priceForKind(profile, kind);

  async function confirmBooking() {
    if (!selected || !profile) return;
    // Paid follow-ups are routed through the existing checkout-style
    // confirm-and-pay screen. Free intros book directly.
    if (price > 0) {
      navigate("/checkout-appointment", {
        state: {
          rdSlug: profile.slug,
          kind,
          startAt: selected.startAt,
          endAt: selected.endAt,
          pricePaise: price,
          userQuestion: question.trim() || undefined,
          rdName: member?.name,
        },
      });
      return;
    }
    setSubmitting(true);
    try {
      const { appointment } = await rdAdvisoryApi.book({
        rdSlug: profile.slug,
        kind,
        startAt: selected.startAt,
        endAt: selected.endAt,
        userQuestion: question.trim() || undefined,
      });
      toast.success("Booking confirmed", {
        description: `${meta.label} with ${member?.name.split(" ").slice(-1)[0]} on ${formatDay(appointment.startAt)} at ${formatTime(appointment.startAt)}.`,
      });
      navigate("/appointments");
    } catch (err) {
      const msg = String(err);
      if (msg.includes("401")) {
        toast.error("Sign in to book", {
          description: "Please sign in to confirm your appointment.",
          action: {
            label: "Sign in",
            onClick: () =>
              navigate(
                `/login?next=${encodeURIComponent(window.location.pathname)}`,
              ),
          },
        });
      } else if (msg.includes("409")) {
        toast.error("Slot just taken", {
          description: "Please pick another time — that slot was booked.",
        });
        const r = await rdAdvisoryApi.slots(profile.slug, kind);
        setSlots(r.slots.slice(0, 60));
        setSelected(null);
      } else {
        toast.error("Could not book", { description: msg });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const hasVerify = member.councilNumber || member.verifyUrl;

  return (
    <div className="tnm2 nn" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div
        style={{
          maxWidth: 480,
          margin: "0 auto",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div className="appbar">
          <Link className="iconbtn" to="/rd" aria-label="All RDs">
            <i className="ph-bold ph-arrow-left" />
          </Link>
          <div className="abt">Book a dietitian</div>
        </div>

        <div className="content" style={{ flex: 1 }}>
          {/* Profile header */}
          <div className="padx" style={{ paddingTop: 4 }}>
            <div className="card mb12">
              <div className="fx gap12 ac">
                <span className="avatar big">{member.initials}</span>
                <div className="f1" style={{ minWidth: 0 }}>
                  <div className="tt">{member.name}</div>
                  <div className="fine mt2">{member.title}</div>
                </div>
              </div>

              <div className="mt10">
                <span className="pill sg">
                  <i className="ph-fill ph-shield-check" />
                  Registered Dietitian
                </span>
              </div>

              <p className="fine mt10">{member.bio}</p>

              <div
                className="fx gap8 mt10"
                style={{ alignItems: "flex-start" }}
              >
                <i
                  className="ph-bold ph-stethoscope sagec"
                  style={{ marginTop: 2, flex: "none" }}
                />
                <span className="fine">{profile.specialties.join(" · ")}</span>
              </div>
              <div className="fx gap8 mt6" style={{ alignItems: "flex-start" }}>
                <i
                  className="ph-bold ph-globe sagec"
                  style={{ marginTop: 2, flex: "none" }}
                />
                <span className="fine">{profile.languages.join(", ")}</span>
              </div>
            </div>

            {/* Credentials */}
            <div className="card mb12">
              <div className="lab mb6">Credentials</div>
              {member.credentials.map((c) => (
                <div
                  key={c}
                  className="fx gap8 mt4"
                  style={{ alignItems: "flex-start" }}
                >
                  <i
                    className="ph-bold ph-seal-check sagec"
                    style={{ marginTop: 2, flex: "none" }}
                  />
                  <span className="fine">{c}</span>
                </div>
              ))}
              {/* Verifiable-credential block. Renders only when the RD
                  has supplied public-display values in teamData.ts —
                  per ASCI 2022 endorsement guidelines. */}
              {hasVerify && (
                <div
                  className="mt10"
                  style={{ paddingTop: 10, borderTop: "1px solid var(--ln)" }}
                >
                  {member.councilNumber && (
                    <div className="fine">
                      {member.councilName ?? "Council reg."}:{" "}
                      <span className="mono" style={{ color: "var(--tx)" }}>
                        {member.councilNumber}
                      </span>
                    </div>
                  )}
                  {member.verifyUrl && (
                    <a
                      href={member.verifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="linkq mt6"
                      style={{ display: "inline-flex" }}
                    >
                      Verify on public registry
                      <i className="ph-bold ph-arrow-square-out" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Session type */}
          <div className="secrow">
            <span className="sh fx ac gap8">
              <i className="ph-bold ph-video-camera fntc" />
              Session type
            </span>
          </div>
          <div className="padx">
            {KINDS.map((k) => {
              const m = APPOINTMENT_KIND_META[k];
              const p = priceForKind(profile, k);
              const active = k === kind;
              return (
                <button
                  key={k}
                  type="button"
                  className={active ? "opt on" : "opt"}
                  onClick={() => {
                    setKind(k);
                    setSelected(null);
                  }}
                >
                  <div className="f1" style={{ minWidth: 0 }}>
                    <div className="small" style={{ fontWeight: 600 }}>
                      {m.label}
                    </div>
                    <div className="fine mt2">{m.description}</div>
                  </div>
                  <span
                    className={p === 0 ? "price sagec" : "price safc"}
                    style={{ flex: "none" }}
                  >
                    {formatRupees(p)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Slot picker */}
          <div className="secrow">
            <span className="sh fx ac gap8">
              <i className="ph-bold ph-calendar-dots fntc" />
              Pick a slot
            </span>
            <span className="lab">Next 14 days · IST</span>
          </div>
          <div className="padx">
            {loading ? (
              <div>
                {[0, 1].map((g) => (
                  <div key={g} className="mb12">
                    <div
                      className="skel mb6"
                      style={{ height: 12, width: 90 }}
                    />
                    <div className="fx wrap g6">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="skel"
                          style={{ height: 34, width: 66, borderRadius: 20 }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : Object.keys(grouped).length === 0 ? (
              <div className="tc" style={{ padding: "32px 20px" }}>
                <i
                  className={
                    loadError
                      ? "ph-bold ph-warning-circle"
                      : "ph-bold ph-calendar-x"
                  }
                  style={{ fontSize: 30, color: "var(--fnt)" }}
                />
                <div className="tt mt10">
                  {loadError ? "Couldn't load availability" : "No open slots"}
                </div>
                <div className="fine mt6">
                  {loadError
                    ? "We couldn't reach the booking calendar. Try a shorter session length, or browse other dietitians."
                    : "No open slots in the next two weeks. Try a shorter session length, or browse other dietitians with availability."}
                </div>
                <Link className="btn btn-g mt20" to="/rd">
                  Browse other dietitians
                </Link>
              </div>
            ) : (
              <div style={{ maxHeight: 360, overflowY: "auto" }}>
                {Object.entries(grouped).map(([day, daySlots]) => (
                  <div key={day} className="mb12">
                    <div className="lab mb6">
                      {formatDay(`${day}T00:00:00`)}
                    </div>
                    <div className="fx wrap g6">
                      {daySlots.map((s) => {
                        const active =
                          selected && selected.startAt === s.startAt;
                        return (
                          <button
                            key={s.startAt}
                            type="button"
                            className={active ? "chip on" : "chip"}
                            onClick={() => setSelected(s)}
                          >
                            <span className="mono">{formatTime(s.startAt)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Question */}
          <div className="secrow">
            <span className="sh fx ac gap8">
              <i className="ph-bold ph-chat-teardrop-text fntc" />
              What to discuss
            </span>
            <span className="lab">Optional</span>
          </div>
          <div className="padx">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Goals, recent labs, conditions, current medications…"
              rows={3}
              maxLength={2000}
              className="small"
              style={{
                width: "100%",
                background: "var(--s1)",
                border: "1px solid var(--ln2)",
                borderRadius: 10,
                padding: "12px 14px",
                color: "var(--tx)",
                resize: "vertical",
                fontFamily: "inherit",
                outline: "none",
                display: "block",
                minHeight: 84,
              }}
            />
          </div>

          <div style={{ height: 12 }} />
        </div>

        {/* Confirm dock */}
        <div className="dock">
          <div className="fx ac jb mb10 gap12">
            <div className="fine f1" style={{ minWidth: 0 }}>
              {selected ? (
                <span className="fx ac g6">
                  <i className="ph-bold ph-clock safc" style={{ flex: "none" }} />
                  {formatDay(selected.startAt)} · {formatTime(selected.startAt)} ·{" "}
                  {meta.durationMin}m
                </span>
              ) : (
                "Select a time to confirm"
              )}
            </div>
            <div
              className="price"
              style={{
                flex: "none",
                color: price === 0 ? "var(--sage)" : "var(--safb)",
              }}
            >
              {formatRupees(price)}
            </div>
          </div>
          <button
            type="button"
            className={
              "btn btn-p btn-lg btn-blk" +
              (!selected || submitting ? " dis" : "")
            }
            onClick={confirmBooking}
            disabled={!selected || submitting}
          >
            <i className="ph-bold ph-calendar-check" />
            {submitting
              ? "Booking…"
              : price === 0
                ? "Confirm (free)"
                : `Confirm · ${formatRupees(price)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
