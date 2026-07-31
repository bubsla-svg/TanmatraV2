/**
 * Community challenges client (Wave C). Split by execution context:
 *   • SERVER (RSC list/detail + sitemap): getChallenges/getChallenge hit the
 *     api-server directly via API_BASE_URL and are resilient ([]/null on a cold
 *     API). The detail's `joined`/`checkIns` are always the SIGNED-OUT view here
 *     (RSC has no cookie) — that's fine, it's the public/SEO render.
 *   • CLIENT (ChallengeRoom): loadChallengeState/join/leave/post go through the
 *     same-origin proxy with credentials:"include", so they carry the session
 *     cookie and reflect the logged-in user's membership. Non-2xx → ApiError.
 */
import { API_BASE, ApiError, type FetchImpl } from "./apiClient";

const SERVER_BASE = process.env.API_BASE_URL ?? "http://localhost:3000";

export interface Challenge {
  id: number;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  image: string | null;
  rdName: string;
  durationDays: number;
  startsAt: string;
  endsAt: string;
  goalTags: string[];
  bundleSlug: string | null;
  /** integer flag (0/1) — the server sends a number, not a boolean. */
  featured: number;
  memberCount: number;
  createdAt: string;
}
export interface ChallengePost {
  id: number;
  authorName: string;
  body: string;
  createdAt: string;
}
export interface ChallengeCheckIn {
  id: number;
  title: string;
  scheduledAt: string;
  joinUrl: string;
}
export interface ChallengeDetail {
  challenge: Challenge;
  joined: boolean;
  posts: ChallengePost[];
  checkIns: ChallengeCheckIn[];
}

/** Client-computed lifecycle status from the challenge window. */
export function challengeStatus(
  startsAt: string,
  endsAt: string,
  now: number = Date.now(),
): "live" | "soon" | "ended" {
  const s = new Date(startsAt).getTime();
  const e = new Date(endsAt).getTime();
  if (now < s) return "soon";
  if (now > e) return "ended";
  return "live";
}

const REVALIDATE = { next: { revalidate: 3600 } } as RequestInit;

// ── Server (RSC/sitemap) ─────────────────────────────────────────────────────
export async function getChallenges(fetchImpl: FetchImpl = fetch): Promise<Challenge[]> {
  try {
    const res = await fetchImpl(`${SERVER_BASE}/api/challenges`, REVALIDATE);
    if (!res.ok) throw new Error(`challenges ${res.status}`);
    const data = (await res.json()) as { challenges?: Challenge[] };
    return data.challenges ?? [];
  } catch {
    return [];
  }
}

export async function getChallenge(
  slug: string,
  fetchImpl: FetchImpl = fetch,
): Promise<ChallengeDetail | null> {
  try {
    const res = await fetchImpl(`${SERVER_BASE}/api/challenges/${encodeURIComponent(slug)}`, REVALIDATE);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`challenge ${res.status}`);
    const data = (await res.json()) as Partial<ChallengeDetail>;
    if (!data.challenge) return null;
    return {
      challenge: data.challenge,
      joined: data.joined ?? false,
      posts: data.posts ?? [],
      checkIns: data.checkIns ?? [],
    };
  } catch {
    return null;
  }
}

export type ChallengeLookup =
  | { ok: true; detail: ChallengeDetail }
  | { ok: false; reason: "not_found" | "unavailable" };

/**
 * Like `getChallenge`, but distinguishes "no such slug" from "couldn't reach
 * the api" — `getChallenge` collapses both to `null`, which made
 * `/challenges/[slug]` 404 a real challenge during a transient API outage.
 */
export async function getChallengeOrReason(
  slug: string,
  fetchImpl: FetchImpl = fetch,
): Promise<ChallengeLookup> {
  try {
    const res = await fetchImpl(`${SERVER_BASE}/api/challenges/${encodeURIComponent(slug)}`, REVALIDATE);
    if (res.status === 404) return { ok: false, reason: "not_found" };
    if (!res.ok) return { ok: false, reason: "unavailable" };
    const data = (await res.json()) as Partial<ChallengeDetail>;
    if (!data.challenge) return { ok: false, reason: "not_found" };
    return {
      ok: true,
      detail: {
        challenge: data.challenge,
        joined: data.joined ?? false,
        posts: data.posts ?? [],
        checkIns: data.checkIns ?? [],
      },
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export type ChallengesLookup =
  | { ok: true; challenges: Challenge[] }
  | { ok: false; reason: "unavailable" };

/**
 * Like `getChallenges`, but distinguishes "genuinely no active challenges"
 * from "couldn't reach the api" — `getChallenges` collapsed both to `[]`,
 * which let a transient outage render as "No active challenges right now."
 * `app/challenges/page.tsx` calls this instead, mirroring `app/rd/page.tsx`'s
 * "briefly unavailable" branch. The `revalidate = 3600` on that page can
 * still pin a since-recovered outage render for up to an hour on its own
 * schedule — this closes the *lying* half of the bug (the copy is honest
 * once it does re-render), not the staleness window itself.
 */
export async function getChallengesOrReason(fetchImpl: FetchImpl = fetch): Promise<ChallengesLookup> {
  try {
    const res = await fetchImpl(`${SERVER_BASE}/api/challenges`, REVALIDATE);
    if (!res.ok) return { ok: false, reason: "unavailable" };
    const data = (await res.json()) as { challenges?: Challenge[] };
    return { ok: true, challenges: data.challenges ?? [] };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

// ── Client (cookie-authed, via same-origin proxy) ────────────────────────────
async function clientJson<T>(path: string, init: RequestInit, fetchImpl: FetchImpl): Promise<T> {
  const res = await fetchImpl(`${API_BASE}/api${path}`, { credentials: "include", ...init });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let e: { error?: string; code?: string } = {};
    try {
      e = text ? JSON.parse(text) : {};
    } catch {
      /* non-JSON */
    }
    throw new ApiError(res.status, e.code ?? "error", e.error ?? "request failed");
  }
  return (await res.json()) as T;
}

/** The signed-in user's view of a challenge (membership + check-ins + posts). */
export function loadChallengeState(slug: string, fetchImpl: FetchImpl = fetch): Promise<ChallengeDetail> {
  return clientJson<ChallengeDetail>(`/challenges/${encodeURIComponent(slug)}`, { method: "GET" }, fetchImpl);
}

export function joinChallenge(slug: string, fetchImpl: FetchImpl = fetch): Promise<{ ok: boolean; joined: boolean }> {
  return clientJson(`/challenges/${encodeURIComponent(slug)}/join`, { method: "POST" }, fetchImpl);
}

export function leaveChallenge(slug: string, fetchImpl: FetchImpl = fetch): Promise<{ ok: boolean; joined: boolean }> {
  return clientJson(`/challenges/${encodeURIComponent(slug)}/leave`, { method: "POST" }, fetchImpl);
}

export async function postToChallenge(
  slug: string,
  body: string,
  fetchImpl: FetchImpl = fetch,
): Promise<ChallengePost> {
  const out = await clientJson<{ post: ChallengePost }>(
    `/challenges/${encodeURIComponent(slug)}/posts`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body }) },
    fetchImpl,
  );
  return out.post;
}
