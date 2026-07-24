import type { Metadata } from "next";
import { ProtocolView } from "@/components/protocol/ProtocolView";
import { PROTOCOL_CONFIG } from "@/content/landing/protocol";
import { SITE_URL } from "@/lib/siteUrl";

const cfg = PROTOCOL_CONFIG.wellness;

export const metadata: Metadata = {
  title: cfg.metaTitle,
  description: cfg.metaDescription,
  alternates: { canonical: "/wellness" },
};

export const revalidate = 3600;

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: cfg.metaTitle,
  description: cfg.metaDescription,
  url: `${SITE_URL}/wellness`,
};

/**
 * `/wellness` — public Wellness Protocol lander (route-parity Wave B), built on
 * the shared ProtocolView template.
 *
 * SCOPE: the legacy `/wellness` is primarily an AUTHENTICATED personal health
 * tracker (food/water logging, Apple Health / Google Fit wearable sync, daily
 * targets — all mutating + PHI). That tracker is a separate, DPDPA/PHI
 * checkpoint-gated slice (Track 4 territory) and is deliberately NOT built here.
 * This ships the public, signed-out experience only.
 */
export default function WellnessPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ProtocolView which="wellness" />
    </>
  );
}
