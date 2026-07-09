import { type MetaFunction } from "react-router";
import V2Premium from "@/tanmatra-v2/Premium";

const TITLE = "Tanmatra Premium";
const DESCRIPTION =
  "Unlock exclusive dishes, priority delivery, advanced meal planning, and direct access to your personal registered dietitian with Tanmatra Premium.";
const URL = "https://tanmatra.food/premium";
const IMAGE = "https://tanmatra.food/opengraph.jpg";

export const meta: MetaFunction = () => [
  { title: TITLE },
  { name: "description", content: DESCRIPTION },
  { property: "og:type", content: "website" },
  { property: "og:title", content: TITLE },
  { property: "og:description", content: "Unlock exclusive dishes, priority delivery, and direct access to your personal registered dietitian." },
  { property: "og:image", content: IMAGE },
  { property: "og:url", content: URL },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:title", content: TITLE },
  { name: "twitter:description", content: "Unlock exclusive dishes, priority delivery, and direct access to your personal registered dietitian." },
  { name: "twitter:image", content: IMAGE },
  { tagName: "link", rel: "canonical", href: URL },
  {
    "script:ld+json": {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": "Tanmatra Premium",
      "description":
        "Monthly membership with priority delivery, one free registered-dietitian consult per month, premium-only dishes, and exclusive add-ons.",
      "image": IMAGE,
      "url": URL,
      "brand": { "@type": "Brand", "name": "Tanmatra" },
      "offers": {
        // Mirrors the client fallback price in src/tanmatra-v2/Premium.tsx
        // (pricePaise ?? 99900 → ₹999 / month).
        "@type": "Offer",
        "price": "999",
        "priceCurrency": "INR",
        "availability": "https://schema.org/InStock",
        "seller": { "@type": "Organization", "name": "Tanmatra" },
      },
    },
  },
];

export const handle = { chrome: false };

export default function Premium() {
  return <V2Premium />;
}
