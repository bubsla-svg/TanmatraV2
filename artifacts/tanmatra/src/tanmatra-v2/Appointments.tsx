import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  rdAdvisoryApi,
  type RdAppointment,
  type RdLabUpload,
  type RdMessage,
  type RdProgressLog,
} from "@/lib/rdAdvisoryApi";
import {
  APPOINTMENT_KIND_META,
  formatRupees,
  getRdMember,
  listRds,
} from "@/lib/rdBookingData";
import { toast } from "sonner";

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

const taStyle: any = {
  width: "100%",
  background: "var(--bg)",
  border: "1px solid var(--ln2)",
  borderRadius: 10,
  color: "var(--tx)",
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: "inherit",
  lineHeight: 1.45,
  resize: "vertical",
};

const selStyle: any = {
  height: 46,
  background: "var(--bg)",
  border: "1px solid var(--ln2)",
  borderRadius: 10,
  color: "var(--tx)",
  padding: "0 12px",
  fontSize: 14,
};

const TABS: Array<{ value: string; label: string; icon: string }> = [
  { value: "schedule", label: "Schedule", icon: "ph-calendar-dots" },
  { value: "chat", label: "Chat", icon: "ph-chat-circle" },
  { value: "progress", label: "Progress", icon: "ph-trend-up" },
  { value: "labs", label: "Labs", icon: "ph-flask" },
];

function statusPill(status: string): { cls: string; style?: any } {
  if (status === "scheduled") return { cls: "pill sg" };
  if (status === "completed")
    return { cls: "pill", style: { background: "var(--safd)", color: "var(--safb)" } };
  return { cls: "pill", style: { background: "rgba(201,124,112,.16)", color: "var(--dgr)" } };
}

export default function V2Appointments() {
  const [appointments, setAppointments] = useState<RdAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauth, setUnauth] = useState(false);
  const [tab, setTab] = useState("schedule");

  const refreshAppts = useCallback(async () => {
    try {
      const r = await rdAdvisoryApi.myAppointments();
      setAppointments(r.appointments);
      setUnauth(false);
    } catch (e) {
      if (String(e).includes("401")) setUnauth(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAppts();
  }, [refreshAppts]);

  const upcoming = appointments.filter(
    (a) => a.status === "scheduled" && new Date(a.endAt) > new Date(),
  );
  const past = appointments.filter(
    (a) => a.status !== "scheduled" || new Date(a.endAt) <= new Date(),
  );

  // pick the active RD = most recent appointment's RD, fallback to first bookable
  const activeRdSlug = useMemo(() => {
    if (appointments[0]) return appointments[0].rdSlug;
    return listRds()[0]?.profile.slug ?? "";
  }, [appointments]);

  if (unauth) {
    return (
      <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div className="appbar">
            <Link className="iconbtn" to="/" aria-label="Home">
              <i className="ph-bold ph-arrow-left" />
            </Link>
            <div className="abt">Appointments</div>
          </div>
          <div className="content padx">
            <div className="tc" style={{ padding: "52px 20px" }}>
              <i className="ph-bold ph-lock-key" style={{ fontSize: 32, color: "var(--fnt)" }} />
              <div className="tt mt10">Sign in to continue</div>
              <div className="fine mt6">
                Sign in to see your appointments and message your dietitian.
              </div>
              <Link className="btn btn-p mt20" to="/login">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="appbar">
          <Link className="iconbtn" to="/" aria-label="Home">
            <i className="ph-bold ph-arrow-left" />
          </Link>
          <div className="abt">Appointments</div>
          <Link className="iconbtn" to="/rd" title="Book a session" aria-label="Book a session">
            <i className="ph-bold ph-calendar-plus" />
          </Link>
        </div>

        <div className="content" style={{ paddingBottom: 24 }}>
          <div className="padx" style={{ paddingTop: 4 }}>
            <div className="lab" style={{ color: "var(--sage)" }}>Care</div>
            <h1 className="disp mt6" style={{ color: "#fff" }}>My RD appointments</h1>
            <Link className="btn btn-p mt12" to="/rd">
              <i className="ph-bold ph-calendar-dots" />
              Book a session
            </Link>
          </div>

          <div className="chiprow mt14" role="tablist" aria-label="Appointments sections">
            {TABS.map((t) => (
              <button
                key={t.value}
                role="tab"
                aria-selected={tab === t.value}
                className={tab === t.value ? "chip on" : "chip"}
                onClick={() => setTab(t.value)}
              >
                <i className={`ph-bold ${t.icon}`} />
                {t.label}
              </button>
            ))}
          </div>

          <div className="padx" style={{ paddingTop: 4 }}>
            {tab === "schedule" && (
              <ScheduleTab
                loading={loading}
                upcoming={upcoming}
                past={past}
                onCancel={async (id) => {
                  try {
                    await rdAdvisoryApi.cancel(id);
                    toast.success("Appointment cancelled");
                    refreshAppts();
                  } catch (e) {
                    toast.error("Could not cancel", { description: String(e) });
                  }
                }}
              />
            )}

            {tab === "chat" &&
              (activeRdSlug ? (
                <ChatTab rdSlug={activeRdSlug} />
              ) : (
                <p className="fine">Book a session to start a conversation.</p>
              ))}

            {tab === "progress" && <ProgressTab />}

            {tab === "labs" && <LabsTab activeRdSlug={activeRdSlug} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScheduleTab({
  loading,
  upcoming,
  past,
  onCancel,
}: {
  loading: boolean;
  upcoming: RdAppointment[];
  past: RdAppointment[];
  onCancel: (id: number) => void;
}) {
  if (loading) {
    return (
      <div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card mb12">
            <div className="fx ac jb gap12">
              <div className="f1">
                <div className="skel" style={{ height: 15, width: "55%" }} />
                <div className="skel mt8" style={{ height: 11, width: "35%" }} />
              </div>
              <div className="skel" style={{ height: 22, width: 70, borderRadius: 20 }} />
            </div>
            <div className="skel mt10" style={{ height: 11, width: "80%" }} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div>
      <section>
        <div className="lab mb10">Upcoming</div>
        {upcoming.length === 0 ? (
          <div className="tc" style={{ padding: "40px 20px" }}>
            <i className="ph-bold ph-calendar-x" style={{ fontSize: 30, color: "var(--fnt)" }} />
            <div className="tt mt10">No upcoming sessions</div>
            <div className="fine mt6">Browse our dietitians to book your next session.</div>
            <Link className="btn btn-p mt20" to="/rd">Browse dietitians</Link>
          </div>
        ) : (
          upcoming.map((a) => <ApptCard key={a.id} appt={a} onCancel={onCancel} />)
        )}
      </section>

      {past.length > 0 && (
        <section className="mt20">
          <div className="lab mb10">Past &amp; cancelled</div>
          {past.map((a) => (
            <ApptCard key={a.id} appt={a} />
          ))}
        </section>
      )}
    </div>
  );
}

function ApptCard({
  appt,
  onCancel,
}: {
  appt: RdAppointment;
  onCancel?: (id: number) => void;
}) {
  const member = getRdMember(appt.rdSlug);
  const meta = APPOINTMENT_KIND_META[appt.kind];
  const sp = statusPill(appt.status);
  return (
    <div className="card mb12">
      <div className="fx ac jb gap12">
        <div className="f1" style={{ minWidth: 0 }}>
          <div className="tt">{member?.name ?? appt.rdSlug}</div>
          <div className="fine mt2">{meta.label}</div>
        </div>
        <span className={sp.cls} style={{ ...(sp.style || {}), textTransform: "uppercase" }}>
          {appt.status}
        </span>
      </div>
      <div className="fine mt10">
        {fmtDateTime(appt.startAt)} · {meta.durationMin}m ·{" "}
        <span className="mono" style={{ color: "var(--tx)" }}>{formatRupees(appt.pricePaise)}</span>
      </div>
      {appt.userQuestion && (
        <div
          className="fine mt6"
          style={{ fontStyle: "italic", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as any, overflow: "hidden" }}
        >
          “{appt.userQuestion}”
        </div>
      )}
      {appt.rdNotes && (
        <div
          className="mt10"
          style={{ background: "var(--safd)", border: "1px solid rgba(232,154,62,.35)", borderRadius: 10, padding: "10px 12px" }}
        >
          <div className="lab safc mb4">RD notes</div>
          <div className="fine" style={{ whiteSpace: "pre-line" }}>{appt.rdNotes}</div>
        </div>
      )}
      {((appt.joinUrl && appt.status === "scheduled") ||
        (onCancel && appt.status === "scheduled")) && (
        <div className="fx ac gap8 mt12">
          {appt.joinUrl && appt.status === "scheduled" && (
            <a className="linkq" href={appt.joinUrl} target="_blank" rel="noopener noreferrer">
              Join call <i className="ph-bold ph-arrow-square-out" />
            </a>
          )}
          {onCancel && appt.status === "scheduled" && (
            <div className="fx ac gap8" style={{ marginLeft: "auto" }}>
              <span className="fine" style={{ fontSize: 11 }}>
                Free cancellation up to 12h before
              </span>
              <button
                className="btn btn-g"
                onClick={() => onCancel(appt.id)}
                aria-label="Cancel appointment (free up to 12h before)"
                style={{ height: 38, fontSize: 13, padding: "0 14px" }}
              >
                <i className="ph-bold ph-x" />
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChatTab({ rdSlug }: { rdSlug: string }) {
  const [messages, setMessages] = useState<RdMessage[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const member = getRdMember(rdSlug);

  const refresh = useCallback(async () => {
    try {
      const r = await rdAdvisoryApi.messages(rdSlug);
      setMessages(r.messages);
    } catch {
      /* ignore */
    }
  }, [rdSlug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const t = body.trim();
    if (!t) return;
    setSending(true);
    try {
      await rdAdvisoryApi.sendMessage(rdSlug, t);
      setBody("");
      refresh();
    } catch (e) {
      toast.error("Could not send", { description: String(e) });
    } finally {
      setSending(false);
    }
  }

  const sendDisabled = sending || !body.trim();

  return (
    <div className="card">
      <div className="fx ac gap8 mb12">
        <i className="ph-bold ph-chat-circle sagec" style={{ fontSize: 18 }} />
        <span className="tt">Chat with {member?.name ?? rdSlug}</span>
      </div>
      <div
        style={{
          height: 360,
          overflowY: "auto",
          borderRadius: 10,
          border: "1px solid var(--ln)",
          background: "var(--bg)",
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {messages.length === 0 ? (
          <div className="fine tc" style={{ paddingTop: 40 }}>No messages yet. Say hi!</div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className="fx"
              style={{ justifyContent: m.senderRole === "user" ? "flex-end" : "flex-start" }}
            >
              <div
                style={{
                  maxWidth: "78%",
                  borderRadius: 12,
                  padding: "8px 12px",
                  background: m.senderRole === "user" ? "var(--safd)" : "var(--saged)",
                  border: `1px solid ${m.senderRole === "user" ? "var(--saf)" : "rgba(136,170,132,.35)"}`,
                }}
              >
                <div className="small" style={{ whiteSpace: "pre-line" }}>{m.body}</div>
                <div className="mono fntc mt4" style={{ fontSize: 10 }}>
                  {new Date(m.createdAt).toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
      <div className="fx gap8 mt12" style={{ alignItems: "flex-end" }}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Ask a question between sessions…"
          rows={2}
          maxLength={4000}
          style={taStyle}
        />
        <button
          className={sendDisabled ? "btn btn-p dis" : "btn btn-p"}
          onClick={send}
          disabled={sendDisabled}
          aria-label="Send message"
          style={{ flex: "none" }}
        >
          <i className="ph-fill ph-paper-plane-right" />
        </button>
      </div>
    </div>
  );
}

function ProgressTab() {
  const [logs, setLogs] = useState<RdProgressLog[]>([]);
  const [weight, setWeight] = useState("");
  const [energy, setEnergy] = useState<number | null>(null);
  const [adherence, setAdherence] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await rdAdvisoryApi.progress();
      setLogs(r.logs);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function save() {
    const w = weight.trim() ? Number(weight) : null;
    if (w == null && energy == null && adherence == null && !note.trim()) {
      toast.error("Add something to log", {
        description: "Weight, energy, adherence, or a note.",
      });
      return;
    }
    setSaving(true);
    try {
      await rdAdvisoryApi.logProgress({
        weightKg: w,
        energyScore: energy,
        adherenceScore: adherence,
        note: note.trim() || undefined,
      });
      setWeight("");
      setEnergy(null);
      setAdherence(null);
      setNote("");
      toast.success("Logged");
      refresh();
    } catch (e) {
      toast.error("Could not save", { description: String(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="card mb12">
        <div className="fx ac gap8 mb12">
          <i className="ph-bold ph-trend-up sagec" style={{ fontSize: 18 }} />
          <span className="tt">Log today</span>
        </div>
        <div className="lab mb6">Weight (kg)</div>
        <div className="inp">
          <i className="ph-bold ph-scales" />
          <input
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            type="number"
            step="0.1"
            placeholder="e.g. 68.4"
          />
        </div>
        <div className="mt12">
          <Score label="Energy (1–5)" value={energy} onChange={setEnergy} />
        </div>
        <div className="mt12">
          <Score label="Plan adherence (1–5)" value={adherence} onChange={setAdherence} />
        </div>
        <div className="mt12">
          <div className="lab mb6">Note</div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="How are you feeling? Any cravings, sleep changes…"
            style={taStyle}
          />
        </div>
        <button
          className={saving ? "btn btn-p btn-blk dis mt12" : "btn btn-p btn-blk mt12"}
          onClick={save}
          disabled={saving}
        >
          Save log
        </button>
      </div>

      <div className="card">
        <div className="tt mb12">Recent logs</div>
        {logs.length === 0 ? (
          <div className="fine">
            No logs yet. Your RD will see entries before your next session.
          </div>
        ) : (
          <div style={{ maxHeight: 420, overflowY: "auto", paddingRight: 4 }}>
            {logs.map((l) => (
              <div
                key={l.id}
                className="mb10"
                style={{ border: "1px solid var(--ln)", borderRadius: 10, padding: 12 }}
              >
                <div className="small mono" style={{ color: "var(--tx)", fontWeight: 600 }}>
                  {new Date(l.loggedAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
                <div className="fx wrap gap12 mt6">
                  {l.weightKg && (
                    <span className="fine">
                      Weight <span className="mono" style={{ color: "var(--tx)" }}>{l.weightKg} kg</span>
                    </span>
                  )}
                  {l.energyScore != null && (
                    <span className="fine">
                      Energy <span style={{ color: "var(--tx)" }}>{l.energyScore}/5</span>
                    </span>
                  )}
                  {l.adherenceScore != null && (
                    <span className="fine">
                      Adherence <span style={{ color: "var(--tx)" }}>{l.adherenceScore}/5</span>
                    </span>
                  )}
                </div>
                {l.note && (
                  <div className="fine mt6" style={{ fontStyle: "italic" }}>{l.note}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Score({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div>
      <div className="lab mb6">{label}</div>
      <div className="fx gap8">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? null : n)}
            className="qbtn"
            style={
              value === n
                ? { background: "var(--saf)", borderColor: "var(--saf)", color: "var(--onsaf)", fontWeight: 700 }
                : { fontWeight: 600 }
            }
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function LabsTab({ activeRdSlug }: { activeRdSlug: string }) {
  const [labs, setLabs] = useState<RdLabUpload[]>([]);
  const [fileUrl, setFileUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [mimeType, setMimeType] = useState("application/pdf");
  const [note, setNote] = useState("");
  const [shareWith, setShareWith] = useState(activeRdSlug);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setShareWith(activeRdSlug);
  }, [activeRdSlug]);

  const refresh = useCallback(async () => {
    try {
      const r = await rdAdvisoryApi.labs();
      setLabs(r.labs);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function save() {
    if (!fileUrl.trim() || !fileName.trim()) {
      toast.error("Need URL and name", {
        description: "Paste a hosted file URL and give it a name.",
      });
      return;
    }
    setSaving(true);
    try {
      await rdAdvisoryApi.addLab({
        fileUrl: fileUrl.trim(),
        fileName: fileName.trim(),
        mimeType,
        sharedWithRdSlug: shareWith || undefined,
        note: note.trim() || undefined,
      });
      setFileUrl("");
      setFileName("");
      setNote("");
      toast.success("Lab added");
      refresh();
    } catch (e) {
      toast.error("Could not save", { description: String(e) });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    try {
      await rdAdvisoryApi.deleteLab(id);
      refresh();
    } catch {
      /* ignore */
    }
  }

  return (
    <div>
      <div className="card mb12">
        <div className="fx ac gap8 mb12">
          <i className="ph-bold ph-upload-simple sagec" style={{ fontSize: 18 }} />
          <span className="tt">Add a lab result</span>
        </div>
        <p className="fine mb12">
          Paste a hosted file link (PDF / image). Visible only to you and the RD you share with.
        </p>
        <div className="inp mb10">
          <i className="ph-bold ph-file-text" />
          <input
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="File name (e.g. CBC – Apr 2026.pdf)"
          />
        </div>
        <div className="inp mb10">
          <i className="ph-bold ph-link" />
          <input
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            placeholder="https://… (file URL)"
          />
        </div>
        <div className="fx gap8 mb10">
          <select
            value={mimeType}
            onChange={(e) => setMimeType(e.target.value)}
            style={selStyle}
            aria-label="File type"
          >
            <option value="application/pdf">PDF</option>
            <option value="image/jpeg">JPEG</option>
            <option value="image/png">PNG</option>
            <option value="image/webp">WebP</option>
          </select>
          <select
            value={shareWith}
            onChange={(e) => setShareWith(e.target.value)}
            style={{ ...selStyle, flex: 1, minWidth: 0 }}
            aria-label="Share with"
          >
            <option value="">Share with: nobody yet</option>
            {listRds().map((r) => (
              <option key={r.profile.slug} value={r.profile.slug}>
                Share with {r.member.name}
              </option>
            ))}
          </select>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Note (optional)"
          style={taStyle}
        />
        <button
          className={saving ? "btn btn-p btn-blk dis mt12" : "btn btn-p btn-blk mt12"}
          onClick={save}
          disabled={saving}
        >
          Save lab
        </button>
      </div>

      <div className="card">
        <div className="tt mb12">Your labs</div>
        {labs.length === 0 ? (
          <div className="fine">Nothing uploaded yet.</div>
        ) : (
          <div style={{ maxHeight: 460, overflowY: "auto", paddingRight: 4 }}>
            {labs.map((l) => (
              <div
                key={l.id}
                className="mb10"
                style={{ border: "1px solid var(--ln)", borderRadius: 10, padding: 12 }}
              >
                <div className="fx gap8" style={{ alignItems: "flex-start" }}>
                  <i className="ph-bold ph-file-text safc" style={{ fontSize: 16, marginTop: 2, flex: "none" }} />
                  <div className="f1" style={{ minWidth: 0 }}>
                    <a
                      className="small clamp1"
                      href={l.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: "block", color: "var(--tx)", fontWeight: 600 }}
                    >
                      {l.fileName}
                    </a>
                    <div className="mono fntc mt2" style={{ fontSize: 10 }}>
                      {new Date(l.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      · {l.mimeType}
                      {l.sharedWithRdSlug
                        ? ` · shared with ${getRdMember(l.sharedWithRdSlug)?.name ?? l.sharedWithRdSlug}`
                        : " · private"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(l.id)}
                    aria-label="Remove"
                    className="dgrc"
                    style={{ flex: "none", fontSize: 16 }}
                  >
                    <i className="ph-bold ph-trash" />
                  </button>
                </div>
                {l.note && (
                  <div className="fine mt6" style={{ fontStyle: "italic" }}>{l.note}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
