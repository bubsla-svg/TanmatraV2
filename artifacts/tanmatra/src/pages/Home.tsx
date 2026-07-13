import { type MetaFunction } from "react-router";
import V2Home from "@/tanmatra-v2/Home";

const TITLE = "Tanmatra — Dietitian-Designed Meal Delivery in Noida, Delhi & Gurgaon";
const DESCRIPTION =
  "Dietitian-designed meals delivered fresh in 25–40 minutes across Noida, Delhi & Gurgaon. Calories, protein and allergens listed on every dish.";
const IMAGE = "https://tanmatra.food/opengraph.jpg";
const URL = "https://tanmatra.food/";

// Organization/FoodEstablishment JSON-LD is emitted globally in root.tsx —
// do not duplicate it here.
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
      "@type": "WebSite",
      "name": "Tanmatra",
      "url": "https://tanmatra.food",
    },
  },
];

// Render the self-contained v2 experience without the legacy app chrome
// (header / promo banner / bottom nav) — root.tsx reads this handle.
export const handle = { chrome: false };

export default function Home() {
  return <V2Home />;
}
