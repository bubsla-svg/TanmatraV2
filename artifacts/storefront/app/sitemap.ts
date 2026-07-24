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

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/menu`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/plans`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/trial`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
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

  return [...staticEntries, ...planEntries, ...dishEntries];
}
