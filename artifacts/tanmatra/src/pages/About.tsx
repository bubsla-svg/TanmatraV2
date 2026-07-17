import { type MetaFunction } from "react-router";
import AboutV2 from "@/tanmatra-v2/About";

const TITLE = "Our Story — Dietitian-Designed Meal Delivery | Tanmatra";
const DESCRIPTION =
  "Learn about Tanmatra'''s mission to bring clinical-grade nutrition to everyday life, our dietitian-designed meal protocols, and our certified kitchens.";
const IMAGE = "https://tanmatra.food/opengraph.jpg";
const URL = "https://tanmatra.food/about";

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
  { name: "robots", content: "index, follow" },
  { tagName: "link", rel: "canonical", href: URL },
  {
    "script:ld+json": {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Tanmatra",
      "url": "https://tanmatra.food",
      "logo": "https://tanmatra.food/tanmatra-logo.png"
    }
  }
];

export const handle = { chrome: false };

export default function About() {
  return <AboutV2 />;
}
