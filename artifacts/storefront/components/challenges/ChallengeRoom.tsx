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

  if (user === undefined) return <p className="mt-8 text-sm text-ink-muted">Loading…</p>;
  if (user === null) {
    return (
      <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
        <p className="text-sm text-ink-muted">Sign in to join this challenge and post in the cohort.</p>
        <PhoneAuth onVerified={() => void loadUser()} />
      </div>
    );
  }

  return (
    <div className="mt-10 border-t border-line pt-10">
      <h2 className="text-lg font-semibold text-ink">Your cohort</h2>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void toggleJoin()}
          disabled={busy}
          className={`rounded-full px-6 py-2.5 text-sm font-semibold transition-colors disabled:opacity-40 ${joined ? "border border-line text-ink hover:bg-surface-raised" : "bg-gold text-[var(--gold-ink)] hover:opacity-90"}`}
        >
          {joined ? "Leave challenge" : "Join challenge"}
        </button>
        {joined && (
          <span className="rounded-full bg-sage-soft px-3 py-1 text-xs font-semibold text-sage-text">
            You&rsquo;re in — welcome to the cohort.
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-[var(--danger)]">
          {error}
        </p>
      )}

      {joined && checkIns.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-ink">Upcoming RD check-ins</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {checkIns.map((ci) => (
              <li
                key={ci.id}
                className="flex flex-col justify-between gap-4 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-center"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">{ci.title}</p>
                  <p className="tabular mt-1 text-xs text-ink-faint">
                    {new Date(ci.scheduledAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <a
                  href={ci.joinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-full bg-gold px-5 py-2 text-center text-xs font-semibold text-[var(--gold-ink)] transition-opacity hover:opacity-90"
                >
                  Join call
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-10">
        <h2 className="text-lg font-semibold text-ink">Cohort feed</h2>
        {joined ? (
          <form
            onSubmit={submitPost}
            className="mt-4 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors focus-within:border-line-strong"
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              maxLength={1000}
              aria-label="Write a post"
              placeholder="Share a win, a question, or your day-1 check-in…"
              className="w-full resize-none bg-transparent text-sm text-ink placeholder:text-ink-faint outline-none"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="self-end rounded-full bg-gold px-5 py-2 text-sm font-semibold text-[var(--gold-ink)] transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Post
            </button>
          </form>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-ink-muted">
            Join the challenge to post in the cohort feed.
          </p>
        )}
        {loaded ? <PostFeed posts={posts} /> : <p className="mt-4 text-sm text-ink-muted">Loading the feed…</p>}
      </div>
    </div>
  );
}
