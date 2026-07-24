import type { MetadataRoute } from "next";
import { PLAN_CATALOG } from "@workspace/subscription-rules";
import { fetchMenu } from "@/lib/catalog";
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
    { path: "/about", priority: 0.5, changeFrequency: "monthly" },
    { path: "/faq", priority: 0.5, changeFrequency: "monthly" },
  ];
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path === "/" ? "" : r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

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

  return [...staticEntries, ...planEntries, ...dishEntries];
}
