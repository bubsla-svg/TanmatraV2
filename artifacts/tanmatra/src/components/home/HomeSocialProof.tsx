import { useMemo } from "react";
import { Link } from "react-router";
import { useQueries } from "@tanstack/react-query";
import { Star, Quotes, ArrowRight } from "@phosphor-icons/react";
import { useMenuCatalog } from "@/lib/menuData";
import { API_BASE } from "@/lib/apiBase";
import { track } from "@/lib/analytics";
import { useSectionViewed } from "./useSectionViewed";

/**
 * S7 — Social proof (playbook §1.1/§1.3): aggregate rating + short verbatims
 * sourced ONLY from the live public dish-reviews API (`GET
 * /dish-reviews/:slug` — the same endpoint DishReviews.tsx renders on the
 * PDP; reviews are server-gated to members who actually ordered the dish).
 *
 * Honesty contract (§7.6): nothing here is authored client-side. While the
 * queries are in flight a skeleton holds the space; if the API fails or
 * returns zero reviews the section renders NOTHING — never placeholder or
 * fabricated testimonials, never invented outcome numbers.
 */

interface PublicReviewer {
  label: string;
  avatarUrl: string | null;
}

interface PublicReview {
  id: number;
  slug: string;
  rating: number;
  body: string;
  photoUrl?: string | null;
  createdAt: string;
  reviewer: PublicReviewer;
}

interface ReviewSummary {
  slug: string;
  mostLoved: string;
  commonGripe: string;
  trend: "improving" | "declining" | "stable";
  sampleSize: number;
  /** Stored x10 server-side (45 → 4.5). */
  averageRating: number;
  generatedAt: string;
}

interface ReviewsResponse {
  reviews: PublicReview[];
  summary: ReviewSummary | null;
}

/** Bound the fan-out: the strip samples the most-reviewed available dishes. */
const MAX_DISHES = 8;
const MAX_QUOTES = 3;
const MIN_QUOTE_RATING = 4;
const MIN_QUOTE_CHARS = 12;
const MAX_QUOTE_CHARS = 180;

async function fetchDishReviews(slug: string): Promise<ReviewsResponse> {
  const res = await fetch(
    `${API_BASE}/dish-reviews/${encodeURIComponent(slug)}`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error(`dish-reviews ${res.status}`);
  return res.json() as Promise<ReviewsResponse>;
}

interface Aggregate {
  totalReviews: number;
  average: number;
  quotes: PublicReview[];
  dishNameBySlug: Map<string, string>;
}

export default function HomeSocialProof() {
  const { dishes } = useMenuCatalog();
  const sectionRef = useSectionViewed<HTMLElement>("social_proof");

  // Sample slugs: available dishes, most-reviewed first (the live catalog
  // carries per-dish reviewCount; the static fallback simply yields catalog
  // order — the reviews endpoint remains the single source of truth).
  const slugs = useMemo(
    () =>
      [...dishes]
        .filter((d) => d.isAvailable)
        .sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0))
        .slice(0, MAX_DISHES)
        .map((d) => d.slug),
    [dishes],
  );

  const results = useQueries({
    queries: slugs.map((slug) => ({
      queryKey: ["dish-reviews", "home-social-proof", slug],
      queryFn: () => fetchDishReviews(slug),
      staleTime: 5 * 60 * 1000,
      retry: 1,
    })),
  });

  const isLoading =
    slugs.length > 0 && results.some((r) => r.isLoading && !r.isError);

  // Aggregate whatever genuinely came back; failed dishes contribute nothing.
  const aggregate: Aggregate = (() => {
    let totalReviews = 0;
    let weightedSum = 0;
    const candidates: PublicReview[] = [];
    for (const r of results) {
      const data = r.data;
      if (!data) continue;
      const summary = data.summary;
      const reviews = Array.isArray(data.reviews) ? data.reviews : [];
      if (summary && summary.sampleSize > 0) {
        // Summary covers the full population (the raw list is capped at 50).
        totalReviews += summary.sampleSize;
        weightedSum += (summary.averageRating / 10) * summary.sampleSize;
      } else if (reviews.length > 0) {
        totalReviews += reviews.length;
        weightedSum += reviews.reduce((s, rv) => s + rv.rating, 0);
      }
      for (const rv of reviews) {
        const body = (rv.body ?? "").trim();
        if (
          rv.rating >= MIN_QUOTE_RATING &&
          body.length >= MIN_QUOTE_CHARS &&
          body.length <= MAX_QUOTE_CHARS
        ) {
          candidates.push(rv);
        }
      }
    }
    // Newest first, at most one quote per dish so a single favourite doesn't
    // monopolise the strip.
    candidates.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const seenSlugs = new Set<string>();
    const quotes: PublicReview[] = [];
    for (const q of candidates) {
      if (seenSlugs.has(q.slug)) continue;
      seenSlugs.add(q.slug);
      quotes.push(q);
      if (quotes.length === MAX_QUOTES) break;
    }
    const dishNameBySlug = new Map(dishes.map((d) => [d.slug, d.name]));
    return {
      totalReviews,
      average: totalReviews > 0 ? weightedSum / totalReviews : 0,
      quotes,
      dishNameBySlug,
    };
  })();

  if (slugs.length === 0) return null;

  if (isLoading) {
    // Skeleton — holds space, claims nothing.
    return (
      <section className="padx mt-12" aria-hidden="true">
        <div className="h-4 w-40 rounded bg-white/5 animate-pulse motion-reduce:animate-none" />
        <div className="mt-4 flex flex-col gap-3">
          <div className="h-20 rounded-2xl bg-white/5 animate-pulse motion-reduce:animate-none" />
          <div className="h-20 rounded-2xl bg-white/5 animate-pulse motion-reduce:animate-none" />
        </div>
      </section>
    );
  }

  // API empty or unreachable → render nothing rather than fake proof.
  if (aggregate.totalReviews === 0) return null;

  const averageLabel = aggregate.average.toFixed(1);
  const memberCount = aggregate.totalReviews.toLocaleString("en-IN");

  return (
    <section ref={sectionRef} className="padx mt-12" aria-label="Member reviews">
      <div className="secrow px-0 flex flex-col items-start gap-1.5">
        <span className="text-[10px] uppercase font-mono tracking-widest text-white/45">
          From members, verified by orders
        </span>
        <span className="flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-400" weight="fill" aria-hidden />
          <span className="text-xl font-semibold tracking-tight text-white/95">
            Rated <span className="tnm-data">{averageLabel}</span> by{" "}
            <span className="tnm-data">{memberCount}</span> members
          </span>
        </span>
      </div>

      {aggregate.quotes.length > 0 && (
        <ul className="mt-3 flex flex-col gap-3">
          {aggregate.quotes.map((q) => (
            <li
              key={q.id}
              className="p-4 rounded-2xl bg-neutral-900/80 border border-white/[0.06] backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
            >
              <Quotes
                className="w-4 h-4 text-amber-400/70"
                weight="fill"
                aria-hidden
              />
              <p className="mt-2 text-xs text-white/85 leading-relaxed">
                {q.body.trim()}
              </p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-white/55 truncate">
                  {q.reviewer.label}
                  {aggregate.dishNameBySlug.has(q.slug) && (
                    <span className="text-white/35">
                      {" "}
                      · {aggregate.dishNameBySlug.get(q.slug)}
                    </span>
                  )}
                </span>
                <span className="tnm-data shrink-0 flex items-center gap-1 text-[11px] text-amber-400">
                  <Star className="w-3 h-3" weight="fill" aria-hidden />
                  {q.rating}/5
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Link
        to="/menu"
        onClick={() =>
          track("home_cta_click", {
            cta_id: "social_proof_browse_menu",
            source: "social_proof",
          })
        }
        className="mt-4 inline-flex items-center gap-1.5 min-h-[44px] px-1 text-xs font-semibold text-[var(--tnm-action)] hover:underline active:scale-[0.98] transition-transform motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        Read reviews on every dish
        <ArrowRight className="w-3.5 h-3.5" weight="bold" aria-hidden />
      </Link>
    </section>
  );
}
