import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

/**
 * Allow the whole public site; only the JSON API surface is never worth
 * crawling. De-indexing of session/checkout/account/track pages is handled by
 * each route's own `robots: { index: false }` metadata — NOT by Disallow here,
 * since a Disallowed URL can't be crawled to see its noindex directive.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
