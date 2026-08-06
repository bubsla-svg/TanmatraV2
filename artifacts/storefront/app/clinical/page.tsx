import type { Metadata } from "next";
import { ProtocolView } from "@/components/protocol/ProtocolView";
import { PROTOCOL_CONFIG } from "@/content/landing/protocol";
import { SITE_URL } from "@/lib/siteUrl";

const cfg = PROTOCOL_CONFIG.clinical;

export const metadata: Metadata = {
  title: cfg.metaTitle,
  description: cfg.metaDescription,
  alternates: { canonical: "/clinical" },
};

export const revalidate = 3600;

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: cfg.metaTitle,
  description: cfg.metaDescription,
  url: `${SITE_URL}/clinical`,
};

/** `/clinical` — Clinical Protocol lander (route-parity Wave B). Diet-descriptive
 *  copy + safety disclaimer; the clinical promise rides on the RD consult. */
export default function ClinicalPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ProtocolView which="clinical" />
    </>
  );
}
