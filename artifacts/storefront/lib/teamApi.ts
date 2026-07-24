/**
 * Team-profiles content client (Wave C). The api-server exposes PUBLIC,
 * read-only endpoints: `GET /api/team-profiles` (optional ?role=chef|rd) and
 * `GET /api/team-profiles/:slug` (→ { profile, ownedDishSlugs }, the owned
 * slugs computed live from the catalog). Server components call these directly;
 * a cold/unreachable API degrades to []/null so the page renders its empty/
 * not-found state rather than throwing.
 */
const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3000";

export type FetchImpl = typeof fetch;

export interface TeamProfile {
  id: number;
  slug: string;
  name: string;
  role: string; // "chef" | "rd"
  title: string;
  bio: string;
  signatureLine: string | null;
  yearsExperience: number;
  initials: string;
  accent: string; // "gold" | "sage" | "blue"
  credentials: string[];
  kitchens: string[];
  lifestyles: string[];
  ownedDishSlugs: string[];
  createdAt: string;
}

export interface TeamProfileDetail {
  profile: TeamProfile;
  /** Dish slugs this person owns/signed off, freshly computed by the server. */
  ownedDishSlugs: string[];
}

const REVALIDATE = { next: { revalidate: 3600 } } as RequestInit;

/** All team profiles (optionally filtered to a role). [] on any failure. */
export async function getTeamProfiles(
  role?: string,
  fetchImpl: FetchImpl = fetch,
): Promise<TeamProfile[]> {
  try {
    const qs = role ? `?role=${encodeURIComponent(role)}` : "";
    const res = await fetchImpl(`${API_BASE}/api/team-profiles${qs}`, REVALIDATE);
    if (!res.ok) throw new Error(`team-profiles ${res.status}`);
    const data = (await res.json()) as { profiles?: TeamProfile[] };
    return data.profiles ?? [];
  } catch {
    return [];
  }
}

/** One profile + its owned dish slugs. null on 404 or any failure. */
export async function getTeamProfile(
  slug: string,
  fetchImpl: FetchImpl = fetch,
): Promise<TeamProfileDetail | null> {
  try {
    const res = await fetchImpl(
      `${API_BASE}/api/team-profiles/${encodeURIComponent(slug)}`,
      REVALIDATE,
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`team-profile ${res.status}`);
    const data = (await res.json()) as { profile?: TeamProfile; ownedDishSlugs?: string[] };
    if (!data.profile) return null;
    return { profile: data.profile, ownedDishSlugs: data.ownedDishSlugs ?? [] };
  } catch {
    return null;
  }
}
