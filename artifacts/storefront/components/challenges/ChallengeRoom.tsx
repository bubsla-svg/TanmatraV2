"use client";
// Client: the interactive membership + cohort feed for a challenge. Session-
// gated; on mount it loads the signed-in user's membership (joined + check-ins)
// and handles join/leave/post. All PUBLIC challenge info is server-rendered by
// the page — this owns only the authed, mutating parts.
import { useEffect, useState } from "react";
import { getAuthUser, type AuthUser } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import {
  loadChallengeState, joinChallenge, leaveChallenge, postToChallenge,
  type ChallengePost, type ChallengeCheckIn,
} from "@/lib/challengesApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";
import { PostFeed } from "./PostFeed";

export function ChallengeRoom({ slug }: { slug: string }) {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [joined, setJoined] = useState(false);
  const [posts, setPosts] = useState<ChallengePost[]>([]);
  const [checkIns, setCheckIns] = useState<ChallengeCheckIn[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadUser() {
    try { const { user: u } = await getAuthUser(); setUser(u); } catch { setUser(null); }
  }
  async function loadState() {
    try {
      const s = await loadChallengeState(slug);
      setJoined(s.joined); setPosts(s.posts); setCheckIns(s.checkIns);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setUser(null);
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => { void loadUser(); }, []);
  useEffect(() => { if (user) void loadState(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleJoin() {
    setBusy(true); setError(null);
    try {
      if (joined) { await leaveChallenge(slug); setJoined(false); setCheckIns([]); }
      else { await joinChallenge(slug); await loadState(); }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { setUser(null); return; }
      setError("Something went wrong. Please try again.");
    } finally { setBusy(false); }
  }
  async function submitPost(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true); setError(null);
    try {
      const post = await postToChallenge(slug, body);
      setPosts((p) => [post, ...p]); setDraft("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { setUser(null); return; }
      setError(e instanceof ApiError && e.status === 403 ? "Join the challenge to post." : "Couldn't post — try again.");
    } finally { setBusy(false); }
  }

  if (user === undefined) return <p className="mt-6 text-sm text-ink-muted">Loading…</p>;
  if (user === null) {
    return (
      <div className="mt-6 flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
        <p className="text-sm text-ink-muted">Sign in to join this challenge and post in the cohort.</p>
        <PhoneAuth onVerified={() => void loadUser()} />
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void toggleJoin()}
          disabled={busy}
          className={`rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-40 ${joined ? "border border-line text-ink" : "bg-gold text-[var(--gold-ink)]"}`}
        >
          {joined ? "Leave challenge" : "Join challenge"}
        </button>
        {joined && <span className="text-xs text-ink-muted">You&rsquo;re in — welcome to the cohort.</span>}
      </div>
      {error && <p role="alert" className="mt-3 text-xs font-medium text-[var(--danger)]">{error}</p>}

      {joined && checkIns.length > 0 && (
        <div className="mt-6">
          <h2 className="text-base font-semibold text-ink">Upcoming RD check-ins</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {checkIns.map((ci) => (
              <li key={ci.id} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3">
                <div>
                  <p className="text-sm font-medium text-ink">{ci.title}</p>
                  <p className="tabular text-xs text-ink-faint">
                    {new Date(ci.scheduledAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <a href={ci.joinUrl} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-[var(--gold-ink)]">
                  Join call
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-base font-semibold text-ink">Cohort feed</h2>
        {joined ? (
          <form onSubmit={submitPost} className="mt-3 flex flex-col gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              maxLength={1000}
              aria-label="Write a post"
              placeholder="Share a win, a question, or your day-1 check-in…"
              className="w-full resize-none rounded-xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none focus:border-line-strong"
            />
            <button type="submit" disabled={busy || !draft.trim()} className="self-end rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-[var(--gold-ink)] disabled:opacity-40">
              Post
            </button>
          </form>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">Join the challenge to post in the cohort feed.</p>
        )}
        {loaded ? <PostFeed posts={posts} /> : <p className="mt-4 text-sm text-ink-muted">Loading the feed…</p>}
      </div>
    </div>
  );
}
