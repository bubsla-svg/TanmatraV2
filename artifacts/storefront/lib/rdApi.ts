/**
 * RD (registered-dietitian) directory client — route-parity Wave D, read-only
 * foundation. The api-server exposes a PUBLIC `GET /api/rd/directory` returning
 * the full roster; there is no single-profile endpoint, so a profile page reads
 * the roster and finds its slug (same shape as the team port). Server components
 * call these via API_BASE_URL; a cold/unreachable API degrades to an empty list
 * (or null) so a page renders its empty / not-found state instead of throwing.
 *
 * PRICING here is SERVER-OWNED (returned by the directory) and shown for
 * information only. Booking + payment (the money path) is a separate,
 * checkpoint-gated slice — this surface never charges.
 */
const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3000";

/** Injectable fetch so the wire contract is testable without a network. */
export type FetchImpl = typeof fetch;

/** Consultation prices in paise, keyed by session kind. 0 = free. */
export interface RdPricing {
  intro_15m: number;
  follow_up_30m: number;
  follow_up_45m: number;
}

export interface RdProfile {
  slug: string;
  name: string;
  title: string;
  credentials: string[];
  bio: string;
  yearsExperience: number;
  languages: string[];
  specialties: string[];
  bookable: boolean;
  pricing: RdPricing;
  /** Office-hours blocks, when the directory attaches them. */
  hours?: unknown;
}

const REVALIDATE = { next: { revalidate: 3600 } } as RequestInit;

/** The full RD roster (server owns ordering). [] on any failure. */
export async function getRds(fetchImpl: FetchImpl = fetch): Promise<RdProfile[]> {
  try {
    const res = await fetchImpl(`${API_BASE}/api/rd/directory`, REVALIDATE);
    if (!res.ok) throw new Error(`rd directory ${res.status}`);
    const data = (await res.json()) as { rds?: RdProfile[] };
    return data.rds ?? [];
  } catch {
    return [];
  }
}

/** One RD by slug (derived from the roster — no single endpoint). null if absent. */
export async function getRd(
  slug: string,
  fetchImpl: FetchImpl = fetch,
): Promise<RdProfile | null> {
  const rds = await getRds(fetchImpl);
  return rds.find((r) => r.slug === slug) ?? null;
}

/** Whether the RD offers a free 15-minute intro. */
export function hasFreeIntro(p: RdPricing): boolean {
  return p.intro_15m === 0;
}

/** Lowest PAID session price in paise (for a "from ₹X" line), or null if none. */
export function fromPricePaise(p: RdPricing): number | null {
  const paid = [p.intro_15m, p.follow_up_30m, p.follow_up_45m].filter((v) => v > 0);
  return paid.length ? Math.min(...paid) : null;
}
