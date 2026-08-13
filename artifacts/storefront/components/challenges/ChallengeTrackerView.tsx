"use client";
// Client: the signed-in member's challenge streak tracker. Session-gated (401 →
// PhoneAuth), same island pattern as ChallengeRoom. Progress is derived from the
// real membership joinedAt — this surface never fabricates a streak. The
// tracker fetch itself is a useQuery (key ["challenges","tracker"]) gated on
// the signed-in user, for the shared cache/retry infra — its 401→sign-in vs
// generic-error split is unchanged from the previous hand-rolled version.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/apiClient";
import { getAuthUser, type AuthUser } from "@/lib/api";
import { getMyChallengeTracker } from "@/lib/ecosystemApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";
import { Button } from "@/components/ui/button";

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

  const loadUser = useCallback(async () => {
    try { const { user: u } = await getAuthUser(); setUser(u); }
    catch { setUser(null); }
  }, []);
  useEffect(() => { void loadUser(); }, [loadUser]);

  const { data, isError, error, refetch } = useQuery({
    queryKey: ["challenges", "tracker"],
    queryFn: getMyChallengeTracker,
    enabled: !!user,
  });
  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) setUser(null);
  }, [error]);

  if (user === undefined) return <p className="text-sm text-ink-muted">Loading…</p>;
  if (user === null) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">Sign in to see your challenge streaks and cohort check-ins.</p>
        <PhoneAuth startExpanded onVerified={() => void loadUser()} />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center shadow-[var(--shadow-card)]">
        <p className="text-sm font-semibold text-[var(--danger)]">Couldn&rsquo;t load your challenge progress just now.</p>
        <button type="button" onClick={() => void refetch()} className="mt-4 rounded-full border border-line px-5 py-2 text-xs font-semibold text-gold-text transition-colors hover:border-line-strong">
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
    <div className="flex flex-col gap-8">
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)] transition-shadow duration-300 hover:shadow-lg md:p-8">
        <div className="mb-6">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gold-text">Your streaks</span>
          <h2 className="text-xl font-semibold tracking-tight text-ink md:text-2xl">Active challenges</h2>
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
                <Link
                  key={c.id}
                  href={`/challenges/${c.slug}`}
                  className="flex flex-col justify-between gap-4 rounded-xl border border-line p-5 transition-colors duration-300 hover:border-gold"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-base font-semibold text-ink">{c.title}</span>
                      <span className="tabular shrink-0 rounded-full bg-sage-soft px-2.5 py-0.5 text-xs font-semibold text-sage-text">
                        Day {daysDone} / {c.durationDays}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-ink-muted">{c.description}</p>
                  </div>
                  <div>
                    <div className="mb-1.5 flex justify-between text-2xs font-semibold text-ink-muted">
                      <span>Progress</span>
                      <span className="tabular text-ink">{pct}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-raised">
                      {/* `transform: scaleX` instead of animating `width` — compositor-only. */}
                      <div
                        className="h-full w-full origin-left rounded-full bg-gold transition-transform duration-700 ease-out"
                        style={{ transform: `scaleX(${pct / 100})` }}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)] md:p-8">
        <h3 className="mb-5 text-lg font-semibold text-ink">Upcoming dietitian check-ins</h3>
        {data.checkIns.length === 0 ? (
          <p className="text-sm text-ink-muted">No check-ins scheduled right now — we&rsquo;ll post one here when your cohort has its next session.</p>
        ) : (
          <ul className="flex flex-col">
            {data.checkIns.map((ci) => (
              <li key={ci.id} className="flex flex-col justify-between gap-3 border-b border-line py-4 first:pt-0 last:border-0 last:pb-0 sm:flex-row sm:items-center">
                <div>
                  <span className="text-sm font-semibold text-ink">{ci.title}</span>
                  <div className="tabular mt-1 text-xs text-ink-muted">{fmtCheckIn(ci.scheduledAt)}</div>
                </div>
                <Button asChild shape="pill" size="fluid" className="inline-flex shrink-0 items-center gap-1 self-start px-5 py-2.5 text-xs font-semibold sm:self-auto">
                  <a href={ci.joinUrl} target="_blank" rel="noopener noreferrer">
                    Join session <span aria-hidden="true">&rarr;</span>
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
