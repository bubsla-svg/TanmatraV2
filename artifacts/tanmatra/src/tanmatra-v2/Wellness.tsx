import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { F } from "./data";
import { API_BASE } from "@/lib/apiBase";
import { wellnessApi, type DayTotals, type WellnessTodayResponse } from "@/lib/wellnessApi";
import { hapticLight, hapticWarning, hapticError } from "@/lib/haptics";
import { useMenuCatalog } from "@/lib/menuData";
import { dishesForProtocol, plansForProtocol, rdsForProtocol } from "@/lib/protocols";
import { RD_PLANS } from "@/lib/rdPlans";
import { RD_BOOKING } from "@/lib/rdBookingData";
import { TEAM } from "@/lib/teamData";

/* Full-parity re-port of the System-A Wellness dashboard (git 2507084, 1295
 * lines) into v2. Same wellnessApi hooks/handlers and endpoints; v2 UI. */

function clampPct(v: number, t: number) { return t <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((v / t) * 100))); }

function Ring({ label, value, target, unit, color, icon }: any) {
  const pct = clampPct(value, target);
  const r = 40, C = 2 * Math.PI * r, off = C - (pct / 100) * C;
  return (
    <div className="col ac" style={{ gap: 6 }}>
      <div className="posrel" style={{ width: 96, height: 96 }}>
        <svg width="96" height="96" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="50" cy="50" r={r} stroke="var(--s3)" strokeWidth="8" fill="none" />
          <circle cx="50" cy="50" r={r} stroke={color} strokeWidth="8" fill="none" strokeDasharray={C} strokeDashoffset={off} strokeLinecap="round" />
        </svg>
        <div className="posabs col ac jc" style={{ inset: 0 }}>
          <i className={`ph-bold ${icon}`} style={{ color, fontSize: 14 }} />
          <div className="mono" style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{Math.round(value)}<span className="fntc" style={{ fontSize: 9 }}>/{Math.round(target)}</span></div>
          <div className="lab" style={{ fontSize: 8 }}>{unit}</div>
        </div>
      </div>
      <div className="lab">{label}</div>
    </div>
  );
}

function WeekBars({ data, field, target, color, label, unit }: { data: DayTotals[]; field: keyof DayTotals; target: number; color: string; label: string; unit: string }) {
  const max = Math.max(target, ...data.map((d) => Number(d[field] ?? 0)));
  return (
    <div className="mb14">
      <div className="fx ac jb mb6"><span className="lab">{label}</span><span className="fine" style={{ fontSize: 10 }}>target {target} {unit}</span></div>
      <div className="b7" style={{ height: 72 }}>
        {data.map((d) => {
          const v = Number(d[field] ?? 0);
          const pct = max > 0 ? (v / max) * 100 : 0;
          const hit = v >= target;
          const day = new Date(d.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "narrow" });
          return (
            <div key={d.date} className="col ac f1" style={{ gap: 4, justifyContent: "flex-end" }}>
              <b style={{ width: "100%", height: `${Math.max(4, pct)}%`, background: hit ? color : "var(--s3)", borderRadius: "4px 4px 2px 2px" }} title={`${d.date}: ${Math.round(v)} ${unit}`} />
              <span className="fine" style={{ fontSize: 10 }}>{day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const TODAY_KEY = ["wellness", "today"] as const;
const WATER_PRESETS = [200, 250, 500];
const NUMERIC_FIELDS: Array<{ key: string; label: string }> = [
  { key: "calories", label: "kcal" }, { key: "proteinGrams", label: "Protein g" }, { key: "fiberGrams", label: "Fiber g" },
  { key: "carbsGrams", label: "Carbs g" }, { key: "fatGrams", label: "Fat g" }, { key: "vegServings", label: "Veg servings" },
];

function ManualLogSheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<any>({ label: "", calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0, fiberGrams: 0, vegServings: 0 });
  const [saving, setSaving] = useState(false);
  if (!open) return null;
  const submit = async () => {
    if (!form.label.trim()) { toast.error("Add a label so you remember what this was"); return; }
    setSaving(true);
    try { await wellnessApi.log(form); toast.success("Logged"); setForm({ label: "", calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0, fiberGrams: 0, vegServings: 0 }); onClose(); onSaved(); }
    catch (e) { toast.error(`Failed to log: ${(e as Error).message}`); }
    finally { setSaving(false); }
  };
  return (
    <div className="bg-[color-mix(in_srgb,var(--tnm-surface-ink)_95%,transparent)] backdrop-blur-md" style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="rounded-t-2xl bg-[var(--tnm-surface-ink-2)] border-x border-t border-white/[0.08] shadow-[0_-8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4" style={{ maxWidth: 480, width: "100%", maxHeight: "85vh", overflowY: "auto" }}>
        <div className="fx ac jb mb10"><div className="h2" style={{ fontSize: 18 }}>Log a meal or snack</div><button className="iconbtn" onClick={onClose} aria-label="Close"><i className="ph-bold ph-x" /></button></div>
        <div className="lab mb6">What was it?</div>
        <div className="inp mb10"><input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Greek yoghurt with berries" /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {NUMERIC_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <div className="lab mb4" style={{ fontSize: 9 }}>{label}</div>
              <div className="inp" style={{ height: 40, padding: "0 10px" }}><input type="number" min={0} value={form[key]} onChange={(e) => setForm((p: any) => ({ ...p, [key]: Math.max(0, Number(e.target.value) || 0) }))} /></div>
            </div>
          ))}
        </div>
        <div className="fx ac gap12 mt14"><button className="btn btn-g f1" onClick={onClose}>Cancel</button><button className="btn btn-p f1" onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save log"}</button></div>
      </div>
    </div>
  );
}

function WearableCard({ data, refresh }: { data: WellnessTodayResponse; refresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<"apple_health" | "google_fit" | null>(null);
  const apple = data.wearables.find((w: any) => w.provider === "apple_health");
  const gfit = data.wearables.find((w: any) => w.provider === "google_fit");
  const performConnect = async (p: "apple_health" | "google_fit") => {
    setBusy(true);
    try { await wellnessApi.connectWearable(p); toast.success(`${p === "apple_health" ? "Apple Health" : "Google Fit"} linked (web preview)`); refresh(); }
    catch (e) { toast.error(`Connect failed: ${(e as Error).message}`); }
    finally { setBusy(false); setPending(null); }
  };
  const sync = async (p: "apple_health" | "google_fit") => {
    setBusy(true);
    try {
      const kcal = 200 + ((data.totals.calories * 7) % 250 | 0);
      const steps = 4000 + ((data.totals.calories * 13) % 6000 | 0);
      await wellnessApi.syncWearable(p, kcal, steps); toast.success(`Synced (+${kcal} kcal target)`); refresh();
    } catch (e) { toast.error(`Sync failed: ${(e as Error).message}`); }
    finally { setBusy(false); }
  };
  const Row = ({ name, provider, link }: any) => {
    const linked = link?.connected;
    return (
      <div className="fx ac jb" style={{ padding: "10px 0", borderBottom: "1px solid var(--ln)" }}>
        <div className="fx ac gap8" style={{ minWidth: 0 }}>
          <i className="ph-bold ph-activity" style={{ color: "var(--sage)" }} />
          <div style={{ minWidth: 0 }}>
            <div className="small">{name}</div>
            <div className="fine" style={{ fontSize: 11 }}>{linked ? (link?.lastSyncedAt ? `Last sync ${new Date(link.lastSyncedAt).toLocaleDateString()} · +${link.lastActivityKcal ?? 0} kcal` : "Linked — tap sync") : "Not connected"}</div>
          </div>
        </div>
        {linked
          ? <button className="btn btn-g" style={{ height: 34 }} disabled={busy} onClick={() => sync(provider)}><i className="ph-bold ph-arrows-clockwise" /> Sync</button>
          : <button className="btn btn-s" style={{ height: 34 }} disabled={busy} onClick={() => setPending(provider)}>Connect</button>}
      </div>
    );
  };
  return (
    <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4 mb10">
      <div className="fx ac jb mb6"><div><div className="lab">Activity sync</div><div className="fine mt2">Wearables adjust your calorie target based on movement.</div></div><span className="pill" style={{ fontSize: 9 }}>Web preview</span></div>
      <Row name="Apple Health" provider="apple_health" link={apple} />
      <Row name="Google Fit" provider="google_fit" link={gfit} />
      <div className="fine mt6" style={{ fontSize: 10 }}>We only read steps + active calories. <Link to="/privacy" style={{ color: "var(--safb)" }}>How wearable data is handled</Link>.</div>

      {pending && (
        <div className="bg-[color-mix(in_srgb,var(--tnm-surface-ink)_95%,transparent)] backdrop-blur-md" style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setPending(null)}>
          <div onClick={(e) => e.stopPropagation()} className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4" style={{ maxWidth: 400, width: "100%" }}>
            <div className="h2 mb6" style={{ fontSize: 17 }}>Connect {pending === "apple_health" ? "Apple Health" : "Google Fit / Health Connect"}</div>
            <div className="fine mb10">Before we connect, here's exactly what we read and how it's used.</div>
            <div className="fine" style={{ lineHeight: 1.6 }}>
              <div>· <b style={{ color: "var(--tx)" }}>Read only</b>: daily steps and active calories. Nothing else.</div>
              <div>· <b style={{ color: "var(--tx)" }}>Stored encrypted</b>, visible only to you and your RD.</div>
              <div>· <b style={{ color: "var(--tx)" }}>Never shared</b> with advertisers. DPDP Act 2023 sensitive data.</div>
              <div>· <b style={{ color: "var(--tx)" }}>Disconnect any time</b> from this page.</div>
            </div>
            <div className="fine mt6" style={{ fontSize: 10 }}>Full details: <Link to="/privacy" style={{ color: "var(--safb)" }}>Privacy Policy → Health &amp; wearable data</Link>.</div>
            <div className="fx ac gap12 mt14"><button className="btn btn-g f1" onClick={() => setPending(null)}>Don't connect</button><button className="btn btn-p f1" disabled={busy} onClick={() => pending && performConnect(pending)}>I agree, connect</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function PairMobileCard() {
  const [token, setToken] = useState<string | null>(null);
  const [ttlMs, setTtlMs] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [label, setLabel] = useState("");
  const loadSessions = async () => {
    try { const res = await fetch(`${API_BASE}/auth/mobile-sessions`, { credentials: "include" }); if (!res.ok) return; const j = await res.json(); setSessions(j.sessions); } catch {}
  };
  useEffect(() => { loadSessions(); /* eslint-disable-next-line */ }, []);
  const issueToken = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/auth/mobile-pair`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: label.trim() || undefined }) });
      if (!res.ok) throw new Error(`${res.status}`);
      const j = await res.json(); setToken(j.token); setTtlMs(j.ttlMs);
      try { await navigator.clipboard.writeText(j.token); setCopied(true); toast.success("Token generated & copied"); setTimeout(() => setCopied(false), 2500); } catch { toast.success("Token generated — tap Copy"); }
      loadSessions();
    } catch (e) { toast.error(`Could not issue token: ${(e as Error).message}`); } finally { setBusy(false); }
  };
  const revoke = async (id: string | "all") => {
    setBusy(true);
    try { const res = await fetch(`${API_BASE}/auth/mobile-sessions/revoke`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id === "all" ? { all: true } : { id }) }); if (!res.ok) throw new Error(`${res.status}`); const j = await res.json(); toast.success(j.revoked === 1 ? "Device revoked" : `${j.revoked} devices revoked`); loadSessions(); }
    catch (e) { toast.error(`Revoke failed: ${(e as Error).message}`); } finally { setBusy(false); }
  };
  const copy = async () => { if (!token) return; try { await navigator.clipboard.writeText(token); setCopied(true); toast.success("Token copied"); setTimeout(() => setCopied(false), 2000); } catch { toast.error("Copy failed — long-press to select"); } };
  const masked = token ? `${token.slice(0, 6)}${"•".repeat(16)}${token.slice(-4)}` : "";
  return (
    <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4 mb10">
      <div className="fx ac gap8 mb10"><i className="ph-bold ph-device-mobile" style={{ color: "var(--sage)" }} /><div><div className="lab">Pair Tanmatra mobile</div><div className="fine mt2">Stream Apple Health / Health Connect activity from your phone.</div></div></div>
      {!token ? (
        <div>
          <div className="fine mb10">Generate a pairing token, then paste it into the Tanmatra mobile app (valid {Math.round((ttlMs ?? 7 * 864e5) / 864e5)} days). Revoke separately from web sign-in.</div>
          <div className="fx ac gap8"><div className="inp f1"><input placeholder="Device label (e.g. iPhone 15)" value={label} onChange={(e) => setLabel(e.target.value)} /></div><button className="btn btn-s" style={{ height: 46 }} disabled={busy} onClick={issueToken}>{busy ? "…" : "Generate"}</button></div>
        </div>
      ) : (
        <div>
          <div className="fx ac gap8"><code className="mono f1" style={{ padding: "8px 10px", borderRadius: 8, background: "var(--s2)", border: "1px solid var(--ln)", color: "var(--sage)", fontSize: 12, wordBreak: "break-all" }}>{masked}</code><button className="qbtn" onClick={copy} aria-label="Copy"><i className={copied ? "ph-bold ph-check" : "ph-bold ph-copy"} /></button><button className="qbtn" onClick={() => setToken(null)} aria-label="Hide"><i className="ph-bold ph-eye-slash" /></button></div>
          <div className="fine mt6" style={{ fontSize: 11 }}>Paste into the mobile app's pairing field. Treat like a password.</div>
        </div>
      )}
      {sessions.length > 0 && (
        <div className="mt14" style={{ borderTop: "1px solid var(--ln)", paddingTop: 12 }}>
          <div className="fx ac jb mb6"><span className="lab">Paired devices ({sessions.length})</span>{sessions.length > 1 && <button className="fine" style={{ color: "var(--safb)" }} disabled={busy} onClick={() => revoke("all")}>Revoke all</button>}</div>
          {sessions.map((s) => (
            <div key={s.id} className="fx ac jb" style={{ padding: "6px 0" }}>
              <div style={{ minWidth: 0 }}><div className="small clamp1">{s.label}</div><div className="fine" style={{ fontSize: 10 }}>{s.createdAt ? `Paired ${new Date(s.createdAt).toLocaleDateString()}` : `Expires ${new Date(s.expiresAt).toLocaleDateString()}`} · <span className="mono">{s.id}</span></div></div>
              <button className="qbtn" style={{ width: 30, height: 30 }} disabled={busy} onClick={() => revoke(s.id)} aria-label="Revoke"><i className="ph-bold ph-trash" style={{ fontSize: 13 }} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProtocolActions() {
  const { dishes } = useMenuCatalog();
  const dishCount = useMemo(() => dishesForProtocol(dishes, "wellness").length, [dishes]);
  const planCount = useMemo(() => plansForProtocol(RD_PLANS, "wellness").length, []);
  const rds = useMemo(() => rdsForProtocol(RD_BOOKING, "wellness"), []);
  const teamBySlug = useMemo(() => new Map(TEAM.map((m: any) => [m.slug, m])), []);
  const samplePlan = useMemo(() => plansForProtocol(RD_PLANS, "wellness")[0], []);
  return (
    <div className="padx mt10">
      <div className="pill sg mb10"><i className="ph-fill ph-leaf" /> Wellness Protocol</div>
      <Link to="/menu?protocol=wellness" className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4 mb10 pointer" style={{ display: "block" }}>
        <div className="lab" style={{ color: "var(--sage)" }}><i className="ph-bold ph-fork-knife" /> Eat</div>
        <div className="tt mt6" style={{ fontSize: 15 }}>{dishCount} wellness-aligned dishes</div>
        <div className="fine mt2">High-fibre, low-glycaemic plates — the building blocks of preventive nutrition.</div>
        <div className="btn btn-s btn-blk mt10">See wellness dishes <i className="ph-bold ph-arrow-right" /></div>
      </Link>
      <Link to="/plans?protocol=wellness" className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4 mb10 pointer" style={{ display: "block" }}>
        <div className="lab" style={{ color: "var(--sage)" }}><i className="ph-bold ph-calendar-dots" /> Plan</div>
        <div className="tt mt6" style={{ fontSize: 15 }}>{planCount} curated weekly plans</div>
        {samplePlan && <div className="fine mt2">Featuring <b style={{ color: "var(--tx)" }}>{samplePlan.name}</b> — {samplePlan.calorieTargetPerDay} kcal · {samplePlan.proteinTargetGrams}g protein/day, from {F(samplePlan.pricePerWeekPaise)}/wk.</div>}
        <div className="btn btn-g btn-blk mt10">Browse wellness plans <i className="ph-bold ph-arrow-right" /></div>
      </Link>
      <Link to="/rd?protocol=wellness" className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4 mb10 pointer" style={{ display: "block" }}>
        <div className="lab" style={{ color: "var(--sage)" }}><i className="ph-bold ph-stethoscope" /> Talk</div>
        <div className="tt mt6" style={{ fontSize: 15 }}>{rds.length} {rds.length === 1 ? "RD" : "RDs"} for wellness coaching</div>
        {rds.length > 0 && <div className="fine mt2">{rds.slice(0, 2).map((rd: any) => teamBySlug.get(rd.slug)?.name ?? rd.slug).filter(Boolean).join(" · ")} — first 15-min consult is free.</div>}
        <div className="btn btn-g btn-blk mt10">Book a wellness RD <i className="ph-bold ph-arrow-right" /></div>
      </Link>
    </div>
  );
}

export default function V2Wellness() {
  const qc = useQueryClient();
  const [logOpen, setLogOpen] = useState(false);
  const todayQ = useQuery({ queryKey: TODAY_KEY, queryFn: () => wellnessApi.today(), retry: false });
  const weekQ = useQuery({ queryKey: ["wellness", "week"], queryFn: () => wellnessApi.week(), retry: false });

  const unauth = (todayQ.error && String(todayQ.error).includes("401")) || (weekQ.error && String(weekQ.error).includes("401"));
  const loadError = !unauth && ((todayQ.error && !String(todayQ.error).includes("401")) || (weekQ.error && !String(weekQ.error).includes("401")));
  const refreshAll = () => qc.invalidateQueries({ queryKey: ["wellness"] });

  // Optimistic water: the ring must move the instant a chip is tapped, not
  // after the POST + the ["wellness"] refetch. Bump totals.waterMl in the
  // cache immediately; the server appends the real log (with its id) which
  // the success invalidate reconciles. Roll back to the snapshot on failure
  // so the UI never quietly drifts from the server (mirrors ordersContext).
  const logWater = async (ml: number) => {
    const snapshot = qc.getQueryData<WellnessTodayResponse>(TODAY_KEY);
    if (snapshot) {
      qc.setQueryData<WellnessTodayResponse>(TODAY_KEY, {
        ...snapshot,
        totals: { ...snapshot.totals, waterMl: snapshot.totals.waterMl + ml },
      });
    }
    hapticLight();
    try {
      await wellnessApi.water(ml);
      toast.success(`+${ml} ml water`);
      refreshAll();
    } catch (e) {
      if (snapshot) qc.setQueryData(TODAY_KEY, snapshot);
      hapticError();
      toast.error(`Failed: ${(e as Error).message}`);
    }
  };

  // Optimistic delete: drop the row AND subtract its macro contribution from
  // the rings immediately (NutritionLog and DayTotals share field names), so
  // the entry vanishes on tap instead of lingering until the refetch.
  const deleteLog = async (id: number) => {
    const snapshot = qc.getQueryData<WellnessTodayResponse>(TODAY_KEY);
    const removed = snapshot?.logs.find((l) => l.id === id);
    if (snapshot && removed) {
      qc.setQueryData<WellnessTodayResponse>(TODAY_KEY, {
        ...snapshot,
        logs: snapshot.logs.filter((l) => l.id !== id),
        totals: {
          ...snapshot.totals,
          calories: snapshot.totals.calories - removed.calories,
          proteinGrams: snapshot.totals.proteinGrams - removed.proteinGrams,
          carbsGrams: snapshot.totals.carbsGrams - removed.carbsGrams,
          fatGrams: snapshot.totals.fatGrams - removed.fatGrams,
          fiberGrams: snapshot.totals.fiberGrams - removed.fiberGrams,
          waterMl: snapshot.totals.waterMl - removed.waterMl,
          vegServings: snapshot.totals.vegServings - removed.vegServings,
        },
      });
    }
    hapticWarning();
    try {
      await wellnessApi.deleteLog(id);
      toast.success("Removed");
      refreshAll();
    } catch (e) {
      if (snapshot) qc.setQueryData(TODAY_KEY, snapshot);
      hapticError();
      toast.error(`Failed: ${(e as Error).message}`);
    }
  };

  const data: any = todayQ.data;
  const week: any = weekQ.data;

  return (
    <div className="tnm2 nn min-h-dvh bg-[var(--tnm-surface-ink)] text-white antialiased">
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="appbar">
          <Link className="iconbtn" to="/challenges" aria-label="Community"><i className="ph-bold ph-arrow-left" /></Link>
          <div className="abt">Wellness</div>
          <button className="iconbtn" onClick={refreshAll} aria-label="Refresh"><i className="ph-bold ph-arrows-clockwise" /></button>
        </div>
        <div className="chiprow">
          <Link className="chip on" to="/wellness">Wellness</Link>
          <Link className="chip" to="/performance">Performance</Link>
          <Link className="chip" to="/clinical">Clinical</Link>
        </div>

        <div className="content" style={{ paddingBottom: 24 }}>
          <ProtocolActions />

          <div className="secrow"><span className="text-[11px] font-semibold tracking-[0.06em] uppercase text-white/50">Today's nutrition</span><button className="text-[var(--tnm-action)] font-semibold text-[13px] flex items-center gap-1 hover:text-white transition-colors" onClick={() => setLogOpen(true)}><i className="ph-bold ph-plus" /> Log meal</button></div>

          <div className="padx">
            {unauth ? (
              <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4 tc"><div className="fine mb10">Sign in to track your daily nutrition, water and streaks.</div><Link className="btn btn-p" to="/login?next=/wellness">Sign in</Link></div>
            ) : loadError ? (
              <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4 tc"><div className="fine mb10">Sign in to see your wellness dashboard — meals, macros and streaks live here.</div><div className="fx gap8 jc"><Link className="btn btn-p" to="/login?next=/wellness">Sign in</Link><button className="btn btn-g" onClick={refreshAll}>Retry</button></div></div>
            ) : !data ? (
              <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] p-4"><div className="skel" style={{ height: 96 }} /><div className="skel mt10" style={{ height: 60 }} /></div>
            ) : (
              <>
                <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, justifyItems: "center" }}>
                    <Ring label="Calories" value={data.totals.calories} target={data.targets.effectiveCalorieTarget ?? data.targets.calorieTarget} unit="kcal" color="var(--tnm-action)" icon="ph-flame" />
                    <Ring label="Protein" value={data.totals.proteinGrams} target={data.targets.proteinTargetGrams} unit="g" color="var(--color-saffron-300)" icon="ph-barbell" />
                    <Ring label="Fiber" value={data.totals.fiberGrams} target={data.targets.fiberTargetGrams} unit="g" color="var(--sage)" icon="ph-plant" />
                    <Ring label="Water" value={data.totals.waterMl} target={data.targets.waterTargetMl} unit="ml" color="var(--color-nn-tertiary)" icon="ph-drop" />
                  </div>
                  <div className="fx ac jc g6 mt10">
                    {WATER_PRESETS.map((ml) => <button key={ml} className="chip" onClick={() => logWater(ml)}>+{ml} ml</button>)}
                  </div>
                  {(data.targets.activityKcal ?? 0) > 0 && <div className="fine tc mt6">Activity bump: +{data.targets.activityKcal} kcal added to today's target from your wearable.</div>}
                </div>

                <div className="fx gap12 mt10">
                  <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4 f1 tc"><div className="lab">Protein streak</div><div className="tt mt2">{data.streaks.protein?.currentDays ?? 0}d</div><div className="fine">best {data.streaks.protein?.bestDays ?? 0}d</div></div>
                  <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4 f1 tc"><div className="lab">Veg streak</div><div className="tt mt2">{data.streaks.veg?.currentDays ?? 0}d</div><div className="fine">best {data.streaks.veg?.bestDays ?? 0}d</div></div>
                  <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4 f1 tc"><div className="lab">Today's logs</div><div className="tt mt2">{data.logs.length}</div><div className="fine">{data.logs.filter((l: any) => l.source === "auto_order").length} auto</div></div>
                </div>
              </>
            )}
          </div>

          {data && week && (
            <>
              <div className="secrow"><span className="text-[11px] font-semibold tracking-[0.06em] uppercase text-white/50">Last 7 days</span></div>
              <div className="padx">
                <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4">
                  <WeekBars data={week.days} field="calories" target={week.targets.effectiveCalorieTarget ?? week.targets.calorieTarget} color="var(--tnm-action)" label="Calories" unit="kcal" />
                  <WeekBars data={week.days} field="proteinGrams" target={week.targets.proteinTargetGrams} color="var(--color-saffron-300)" label="Protein" unit="g" />
                  <WeekBars data={week.days} field="fiberGrams" target={week.targets.fiberTargetGrams} color="var(--sage)" label="Fiber" unit="g" />
                  <WeekBars data={week.days} field="waterMl" target={week.targets.waterTargetMl} color="var(--color-nn-tertiary)" label="Water" unit="ml" />
                </div>
              </div>
            </>
          )}

          {data && (
            <>
              <div className="secrow"><span className="text-[11px] font-semibold tracking-[0.06em] uppercase text-white/50">Today's entries</span><button className="text-[var(--tnm-action)] font-semibold text-[13px] flex items-center gap-1 hover:text-white transition-colors" onClick={() => setLogOpen(true)}><i className="ph-bold ph-plus" /> Log</button></div>
              <div className="padx">
                <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4 mb10">
                  {data.logs.length === 0 ? (
                    <div className="fine tc" style={{ padding: "16px 0" }}>Nothing logged yet today. Order a meal or add one manually.</div>
                  ) : (
                    data.logs.map((log: any) => (
                      <div key={log.id} className="fx ac jb" style={{ padding: "10px 0", borderBottom: "1px solid var(--ln)" }}>
                        <div style={{ minWidth: 0 }}>
                          <div className="small">{log.label}</div>
                          <div className="fine" style={{ fontSize: 11 }}>{log.source === "auto_order" ? "From delivered order" : log.source === "water" ? "Water" : "Manual"} · {log.calories} kcal · P{log.proteinGrams}g · F{log.fiberGrams}g{log.waterMl > 0 ? ` · ${log.waterMl} ml` : ""}</div>
                        </div>
                        <button className="qbtn" style={{ width: 30, height: 30 }} onClick={() => deleteLog(log.id)} aria-label="Delete log"><i className="ph-bold ph-trash" style={{ fontSize: 13 }} /></button>
                      </div>
                    ))
                  )}
                </div>
                <WearableCard data={data} refresh={refreshAll} />
                <PairMobileCard />
              </div>
            </>
          )}
        </div>
      </div>

      <ManualLogSheet open={logOpen} onClose={() => setLogOpen(false)} onSaved={refreshAll} />
    </div>
  );
}
