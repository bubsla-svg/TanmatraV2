"use client";
// Client: the signed-in member's challenge streak tracker. Session-gated (401 →
// PhoneAuth), same island pattern as ChallengeRoom. Progress is derived from the
// real membership joinedAt — this surface never fabricates a streak.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/apiClient";
import { getAuthUser, type AuthUser } from "@/lib/api";
import { getMyChallengeTracker, type ChallengeTrackerData } from "@/lib/ecosystemApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";

/** Whole days elapsed since joining, 1-indexed and clamped to the challenge length. */
function daysElapsed(joinedAt: string, durationDays: number): number {
  const start = new Date(joinedAt).getTime();
  if (!Number.isFinite(start)) return 0;
  const days = Math.floor((Date.now() - start) / 86_400_000) + 1;
  return Math.max(0, Math.min(durationDays, days));
}

const fmtCheckIn = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    weekday: "long", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata",
  });

export function ChallengeTrackerView() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [data, setData] = useState<ChallengeTrackerData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadUser = useCallback(async () => {
    try { const { user: u } = await getAuthUser(); setUser(u); }
    catch { setUser(null); }
  }, []);
  useEffect(() => { void loadUser(); }, [loadUser]);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await getMyChallengeTracker());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { setUser(null); return; }
      setError("Couldn't load your challenge progress just now.");
    }
  }, []);
  useEffect(() => { if (user) void load(); }, [user, load]);

  if (user === undefined) return <p className="text-sm text-ink-muted">Loading…</p>;
  if (user === null) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">Sign in to see your challenge streaks and cohort check-ins.</p>
        <PhoneAuth onVerified={() => void loadUser()} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center">
        <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>
        <button type="button" onClick={() => void load()} className="mt-4 rounded-lg border border-line px-5 py-2 text-xs font-semibold text-gold-text hover:opacity-80">
          Try again
        </button>
      </div>
    );
  }
  if (!data) return <p className="text-sm text-ink-muted">Syncing challenge milestones…</p>;

  // Only challenges you actually joined belong on a personal tracker.
  const joined = data.challenges
    .map((c) => ({ c, m: data.memberships.find((m) => m.challengeId === c.id) }))
    .filter((row): row is { c: (typeof data.challenges)[number]; m: (typeof data.memberships)[number] } => !!row.m);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-6">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">Your streaks</span>
          <h2 className="mt-1 text-lg font-semibold text-ink">Active challenges</h2>
        </div>
        {joined.length === 0 ? (
          <p className="text-sm text-ink-muted">
            You haven&rsquo;t joined a challenge yet.{" "}
            <Link href="/challenges" className="font-medium text-gold-text hover:underline">Browse challenges</Link>.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {joined.map(({ c, m }) => {
              const daysDone = daysElapsed(m.joinedAt, c.durationDays);
              const pct = c.durationDays > 0 ? Math.round((daysDone / c.durationDays) * 100) : 0;
              return (
                <Link key={c.id} href={`/challenges/${c.slug}`} className="flex flex-col justify-between gap-4 rounded-xl border border-line p-5 transition-colors hover:border-line-strong">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-ink">{c.title}</span>
                      <span className="tabular shrink-0 rounded-full bg-sage-soft px-2.5 py-0.5 text-xs font-semibold text-sage-text">
                        Day {daysDone} / {c.durationDays}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-ink-muted">{c.description}</p>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-[11px] font-semibold text-ink-muted">
                      <span>Progress</span>
                      <span className="tabular">{pct}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-raised">
                      <div className="h-full bg-gold transition-all duration-300" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
        <h3 className="text-base font-semibold text-ink">Upcoming dietitian check-ins</h3>
        {data.checkIns.length === 0 ? (
          <p className="text-sm text-ink-muted">No check-ins scheduled right now — we&rsquo;ll post one here when your cohort has its next session.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.checkIns.map((ci) => (
              <li key={ci.id} className="flex flex-col justify-between gap-4 rounded-xl border border-line p-4 sm:flex-row sm:items-center">
                <div>
                  <span className="text-sm font-semibold text-ink">{ci.title}</span>
                  <div className="tabular mt-1 text-xs text-ink-muted">{fmtCheckIn(ci.scheduledAt)}</div>
                </div>
                <a
                  href={ci.joinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-xl bg-gold px-5 py-2.5 text-center text-xs font-semibold text-[var(--gold-ink)] transition-opacity hover:opacity-90"
                >
                  Join session &rarr;
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
