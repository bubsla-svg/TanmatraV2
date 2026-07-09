import { type MetaFunction } from "react-router";
import { RD_PLANS } from "@/lib/rdPlans";
import V2RdPlans from "@/tanmatra-v2/RdPlans";

const TITLE = "RD-Designed Meal Plans | Tanmatra";
const DESCRIPTION =
  "Weekly meal plans designed by registered dietitians — weight loss, lean muscle, PCOS balance, diabetic-friendly and more. Macro-calibrated menus designed to support your goals, delivered fresh.";
const IMAGE = "https://tanmatra.food/opengraph.jpg";
const URL = "https://tanmatra.food/plans";

export const meta: MetaFunction = () => [
  { title: TITLE },
  { name: "description", content: DESCRIPTION },
  { property: "og:type", content: "website" },
  { property: "og:title", content: TITLE },
  { property: "og:description", content: DESCRIPTION },
  { property: "og:image", content: IMAGE },
  { property: "og:url", content: URL },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:title", content: TITLE },
  { name: "twitter:description", content: DESCRIPTION },
  { name: "twitter:image", content: IMAGE },
  { tagName: "link", rel: "canonical", href: URL },
  {
    "script:ld+json": {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "RD-Designed Meal Plans",
      "url": URL,
      "itemListElement": RD_PLANS.map((plan, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "item": {
          "@type": "Product",
          "name": plan.name,
          "description": plan.tagline,
          "url": `https://tanmatra.food/plans/${plan.slug}`,
          "brand": { "@type": "Brand", "name": "Tanmatra" },
          "offers": {
            "@type": "Offer",
            "price": (plan.pricePerWeekPaise / 100).toFixed(0),
            "priceCurrency": "INR",
            "availability": "https://schema.org/InStock",
          },
        },
      })),
    },
  },
];

export const handle = { chrome: false };

export default function RdPlans() {
  return <V2RdPlans />;
}
