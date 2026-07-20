import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { wellnessApi, type Streak } from "@/lib/wellnessApi";
import { track } from "@/lib/analytics";
import { DURATION, EASE } from "@/lib/motion";

/* Zen Tracker — Zone 3 of the "My Week" retention architecture (playbook
 * §5.2/§5.4). The habit surface finally gets the Zen Tracker name; the ring
 * visual mirrors tanmatra-v2/ZenTracker.tsx's ZenRing (order tracking, now
 * "Live Kitchen") so streaks read as the same calm, clinical language. */

// ── Milestones ───────────────────────────────────────────────────────────────
// 7 days = habit spark (Duolingo's verified 7-day retention inflection),
// 30 days = routine, 66 days = average time to habit automaticity
// (Lally et al. 2010, UCL) — see playbook §5.4.
const MILESTONES = [7, 30, 66] as const;

function nextMilestone(days: number): number {
  for (const m of MILESTONES) {
    if (days < m) return m;
  }
  return MILESTONES[MILESTONES.length - 1]!;
}

// ── Data hook ────────────────────────────────────────────────────────────────
export interface StreaksPayload {
  protein: Streak | null;
  veg: Streak | null;
}

export interface StreaksState {
  status: "loading" | "ready" | "unauth" | "error";
  streaks: StreaksPayload | null;
}

/**
 * Fetch the signed-in user's streak rows (GET /wellness/streaks). Exposed so
 * pages that also need the raw numbers elsewhere (e.g. the Subscriptions
 * cancel dialog's what-changes recap) can fetch once and pass the state into
 * <StreakRings data={…}> instead of double-fetching. Pass `enabled: false`
 * to skip the request (used internally when data is injected).
 */
export function useStreaks(enabled = true): StreaksState {
  const [state, setState] = useState<StreaksState>({
    status: "loading",
    streaks: null,
  });
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    wellnessApi
      .streaks()
      .then((r) => {
        if (alive) setState({ status: "ready", streaks: r.streaks });
      })
      .catch((err) => {
        if (!alive) return;
        const unauth = String(err).includes("401");
        setState({ status: unauth ? "unauth" : "error", streaks: null });
      });
    return () => {
      alive = false;
    };
  }, [enabled]);
  return state;
}

// ── SVG ring (ZenTracker's ZenRing pattern, compact) ────────────────────────
const RING_SIZE = 76;
const RING_RADIUS = 30;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const RING_STROKE = 6;

function StreakRing({
  days,
  color,
  reducedMotion,
}: {
  days: number;
  color: string;
  reducedMotion: boolean;
}) {
  const target = nextMilestone(days);
  const fraction = days >= MILESTONES[MILESTONES.length - 1]! ? 1 : Math.min(1, days / target);
  const offset = RING_CIRCUMFERENCE * (1 - fraction);
  return (
    <svg
      viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
      width={RING_SIZE}
      height={RING_SIZE}
      aria-hidden="true"
      style={{ transform: "rotate(-90deg)", display: "block" }}
    >
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        fill="none"
        stroke="var(--s3)"
        strokeWidth={RING_STROKE}
      />
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        fill="none"
        stroke={color}
        strokeWidth={RING_STROKE}
        strokeLinecap="round"
        strokeDasharray={RING_CIRCUMFERENCE}
        strokeDashoffset={offset}
        style={
          reducedMotion
            ? undefined
            : {
                transition: `stroke-dashoffset ${DURATION.slower}s ${EASE.standard.join(",")}`,
              }
        }
      />
    </svg>
  );
}

function RingBlock({
  label,
  streak,
  color,
  reducedMotion,
}: {
  label: string;
  streak: Streak | null;
  color: string;
  reducedMotion: boolean;
}) {
  const days = streak?.currentDays ?? 0;
  const best = streak?.bestDays ?? 0;
  return (
    <div
      className="col ac f1"
      role="img"
      aria-label={`${label} streak: ${days} day${days === 1 ? "" : "s"}${best > 0 ? `, best ${best}` : ""}`}
      style={{ gap: 4, minWidth: 0 }}
    >
      <div className="posrel fx ac jc">
        <StreakRing days={days} color={color} reducedMotion={reducedMotion} />
        <div className="posabs col ac jc" style={{ inset: 0 }}>
          <span
            className="tnm-data"
            style={{ fontSize: 20, fontWeight: 700, lineHeight: 1, color: "var(--tx)" }}
          >
            {days}
          </span>
          <span className="lab" style={{ fontSize: 8 }}>
            {days === 1 ? "day" : "days"}
          </span>
        </div>
      </div>
      <div className="small" style={{ fontWeight: 600, color: "var(--tx)" }}>
        {label}
      </div>
      <div className="fine" style={{ fontSize: 10 }}>
        Best <span className="tnm-data">{best}</span>d
      </div>
    </div>
  );
}

// ── Main strip ───────────────────────────────────────────────────────────────
export default function StreakRings({ data }: { data?: StreaksState }) {
  // Self-fetch only when no state is injected by the parent page. The hook
  // itself always runs (rules of hooks); `enabled` gates the request.
  const own = useStreaks(data === undefined);
  const state = data ?? own;
  const { status, streaks } = state;

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // streak_viewed — once per mount, per kind, when data exists.
  const trackedRef = useRef(false);
  useEffect(() => {
    if (trackedRef.current || status !== "ready" || !streaks) return;
    trackedRef.current = true;
    for (const kind of ["protein", "veg"] as const) {
      const row = streaks[kind];
      if (row) track("streak_viewed", { kind, days: row.currentDays });
    }
  }, [status, streaks]);

  // Signed-out (or endpoint unavailable): the strip is a bonus surface —
  // render nothing rather than an error card on an otherwise-working page.
  if (status === "unauth" || status === "error") return null;

  if (status === "loading") {
    return (
      <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4 mt12">
        <div className="skel" style={{ height: 12, width: "38%" }} />
        <div className="fx ac jc gap12 mt10">
          <div className="skel" style={{ width: RING_SIZE, height: RING_SIZE, borderRadius: "50%" }} />
          <div className="skel" style={{ width: RING_SIZE, height: RING_SIZE, borderRadius: "50%" }} />
        </div>
      </div>
    );
  }

  const protein = streaks?.protein ?? null;
  const veg = streaks?.veg ?? null;
  const hasHistory =
    (protein?.currentDays ?? 0) > 0 ||
    (protein?.bestDays ?? 0) > 0 ||
    (veg?.currentDays ?? 0) > 0 ||
    (veg?.bestDays ?? 0) > 0;

  if (!hasHistory) {
    return (
      <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4 mt12">
        <div className="lab" style={{ color: "var(--sage)" }}>
          <i className="ph-fill ph-flame" /> Zen Tracker
        </div>
        <div className="tt mt8">Your first streak starts with tonight's meal</div>
        <div className="fine mt4">
          Hit your daily protein or veg target and we'll count the days — 7 in a
          row earns your first milestone.
        </div>
        <Link
          to="/menu"
          className="linkq mt8"
          style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}
        >
          Browse tonight's menu <i className="ph-bold ph-caret-right" style={{ fontSize: 12 }} />
        </Link>
      </div>
    );
  }

  const leadDays = Math.max(protein?.currentDays ?? 0, veg?.currentDays ?? 0);

  return (
    <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4 mt12">
      <div className="fx ac jb gap8">
        <div className="lab" style={{ color: "var(--sage)" }}>
          <i className="ph-fill ph-flame" /> Zen Tracker
        </div>
        <div
          className="fx ac g6"
          role="group"
          aria-label={`Milestones: 7, 30 and 66 days. ${MILESTONES.filter((m) => leadDays >= m).length} reached.`}
        >
          {MILESTONES.map((m) => {
            const reached = leadDays >= m;
            return (
              <span
                key={m}
                className={reached ? "pill sg" : "pill"}
                style={{ padding: "3px 8px", fontSize: 9 }}
              >
                {reached && <i className="ph-bold ph-check" style={{ fontSize: 9 }} />}
                <span className="tnm-data">{m}</span>d
              </span>
            );
          })}
        </div>
      </div>
      <div className="fx mt10" style={{ gap: 12 }}>
        <RingBlock
          label="Protein"
          streak={protein}
          color="var(--safb)"
          reducedMotion={reducedMotion}
        />
        <RingBlock
          label="Veg"
          streak={veg}
          color="var(--sage)"
          reducedMotion={reducedMotion}
        />
      </div>
      <div className="fine tc mt8" style={{ fontSize: 10 }}>
        Days you hit your protein / veg targets, counted from your deliveries and
        logs. 66 days ≈ a habit on autopilot.
      </div>
    </div>
  );
}
