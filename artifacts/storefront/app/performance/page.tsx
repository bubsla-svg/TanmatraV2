import type { Metadata } from "next";
import { ProtocolView } from "@/components/protocol/ProtocolView";
import { PROTOCOL_CONFIG } from "@/content/landing/protocol";
import { SITE_URL } from "@/lib/siteUrl";

const cfg = PROTOCOL_CONFIG.performance;

export const metadata: Metadata = {
  title: cfg.metaTitle,
  description: cfg.metaDescription,
  alternates: { canonical: "/performance" },
};

export const revalidate = 3600;

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: cfg.metaTitle,
  description: cfg.metaDescription,
  url: `${SITE_URL}/performance`,
};

/** `/performance` — Performance Protocol lander (route-parity Wave B). */
export default function PerformancePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ProtocolView which="performance" />
    </>
  );
}
