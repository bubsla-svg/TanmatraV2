import type { MetadataRoute } from "next";
import { PLAN_CATALOG } from "@workspace/subscription-rules";
import { LEGAL_DOCS } from "@/content/legal";
import { fetchMenu } from "@/lib/catalog";
import { getRecipes } from "@/lib/recipesApi";
import { getRds } from "@/lib/rdApi";
import { SITE_URL } from "@/lib/siteUrl";

// Only public, indexable routes belong here. /login, /checkout, /track,
// /order/confirmed, /account/*, and /styleguide each carry their own
// `robots: { index: false }` metadata and are deliberately excluded — a
// sitemap is a positive index of canonical content, not a route dump.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Public, indexable static routes. Route-parity waves APPEND their new
  // content routes here as they land (Wave A → /about, /faq; legal-pages →
  // /legal/*) — one line each, so the sitemap grows with the site. Only list a
  // path once its page actually exists on this branch, or the URL 404s.
  const STATIC_ROUTES: { path: string; priority: number; changeFrequency: "weekly" | "monthly" }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/menu", priority: 0.9, changeFrequency: "weekly" },
    { path: "/plans", priority: 0.9, changeFrequency: "monthly" },
    { path: "/trial", priority: 0.8, changeFrequency: "monthly" },
    { path: "/corporate", priority: 0.6, changeFrequency: "monthly" },
    { path: "/corporate-wellness", priority: 0.6, changeFrequency: "monthly" },
    { path: "/about", priority: 0.5, changeFrequency: "monthly" },
    { path: "/faq", priority: 0.5, changeFrequency: "monthly" },
    { path: "/recipes", priority: 0.7, changeFrequency: "weekly" },
    { path: "/rd", priority: 0.7, changeFrequency: "monthly" },
    { path: "/partners/gyms", priority: 0.5, changeFrequency: "monthly" },
    { path: "/partners/fitness-clubs", priority: 0.5, changeFrequency: "monthly" },
  ];
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path === "/" ? "" : r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  // Legal / policy pages (legal-pages wave): the /legal index + one page per
  // registered document. Iterates LEGAL_DOCS so a new policy is listed the
  // moment it's added to the registry.
  const legalEntries: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/legal`,
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    },
    ...LEGAL_DOCS.map((d) => ({
      url: `${SITE_URL}/legal/${d.slug}`,
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];

  // Every catalog plan has a /plan/<id> page (a blocked plan renders a waitlist
  // — still real, indexable content). trial_3day is excluded: its canonical
  // surface is /trial, already listed above.
  const planEntries: MetadataRoute.Sitemap = Object.keys(PLAN_CATALOG)
    .filter((id) => id !== "trial_3day")
    .map((id) => ({
      url: `${SITE_URL}/plan/${id}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    }));

  // Dish detail pages. fetchMenu() is build-safe — it falls back to the static
  // catalog package when the API is cold — so even a no-network build emits a
  // complete sitemap rather than dropping every dish URL.
  let dishEntries: MetadataRoute.Sitemap = [];
  try {
    const { dishes } = await fetchMenu();
    dishEntries = dishes.map((d) => ({
      url: `${SITE_URL}/dish/${d.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
  } catch {
    // fetchMenu already catches internally; this is a last-resort guard so the
    // sitemap is always emitted even if enumeration itself throws.
  }

  // Recipe detail pages. getRecipes() returns [] on a cold/unreachable API, so
  // this never breaks the build — the recipe URLs simply appear once the API is
  // reachable at revalidate time.
  let recipeEntries: MetadataRoute.Sitemap = [];
  try {
    const recipes = await getRecipes();
    recipeEntries = recipes.map((r) => ({
      url: `${SITE_URL}/recipes/${r.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));
  } catch {
    // getRecipes already swallows failures; last-resort guard.
  }

  // RD profile pages. getRds() returns [] on a cold/unreachable API, so this
  // never breaks the build — profile URLs appear once the API is reachable.
  let rdEntries: MetadataRoute.Sitemap = [];
  try {
    const rds = await getRds();
    rdEntries = rds.map((r) => ({
      url: `${SITE_URL}/rd/${r.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));
  } catch {
    // getRds already swallows failures; last-resort guard.
  }

  return [...staticEntries, ...legalEntries, ...planEntries, ...dishEntries, ...recipeEntries, ...rdEntries];
}
