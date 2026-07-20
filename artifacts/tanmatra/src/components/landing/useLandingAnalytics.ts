import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { track } from "@/lib/analytics";

/**
 * Shared landing-page instrumentation (Playbook Part 8 §8.2, "Acquisition &
 * landing"). Fires `landing_viewed` once per landing slug on mount, carrying
 * whatever UTM/sector context arrived on the query string, and returns a
 * `trackCta` helper so every CTA on the page reports `landing_cta_clicked`
 * with the same `landing_slug`.
 *
 * The `sector` param (`?sector=62`, Playbook §3.4 ad-traffic variants) is also
 * returned so pages can personalise the hero eyebrow ("Delivering into Sector
 * 62 daily"). It is accepted only as a plain 1–4 digit number — anything else
 * is ignored, never rendered, never tracked.
 */
export function useLandingAnalytics(landingSlug: string): {
  /** Sanitised `?sector=` value, or null when absent/invalid. */
  sector: string | null;
  /** Fire `landing_cta_clicked` for a CTA on this landing page. */
  trackCta: (ctaId: string, target: string) => void;
} {
  const [searchParams] = useSearchParams();
  const rawSector = searchParams.get("sector");
  const sector =
    rawSector && /^\d{1,4}$/.test(rawSector.trim()) ? rawSector.trim() : null;
  const utmSource = searchParams.get("utm_source");
  const utmCampaign = searchParams.get("utm_campaign");

  // One view event per landing slug per mount — but if the same component
  // instance transitions between slugs (e.g. /care/pcos → /care/diabetes via
  // client-side nav), the new slug fires its own view.
  const viewedFor = useRef<string | null>(null);
  useEffect(() => {
    if (viewedFor.current === landingSlug) return;
    viewedFor.current = landingSlug;
    const props: Record<string, unknown> = { landing_slug: landingSlug };
    if (utmSource) props.utm_source = utmSource;
    if (utmCampaign) props.utm_campaign = utmCampaign;
    if (sector) props.sector = sector;
    track("landing_viewed", props);
  }, [landingSlug, utmSource, utmCampaign, sector]);

  const trackCta = useCallback(
    (ctaId: string, target: string) => {
      track("landing_cta_clicked", {
        landing_slug: landingSlug,
        cta_id: ctaId,
        target,
      });
    },
    [landingSlug],
  );

  return { sector, trackCta };
}
