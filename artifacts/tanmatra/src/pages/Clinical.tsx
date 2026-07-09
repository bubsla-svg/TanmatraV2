import { type MetaFunction } from "react-router";
import V2Protocol from "@/tanmatra-v2/Protocol";

export const meta: MetaFunction = () => [
  { title: "Clinical Nutrition Protocol | Tanmatra" },
  { name: "description", content: "Evidence-based therapeutic meal plans for diabetes, hypertension, PCOS, thyroid disorders, and post-surgical recovery — supervised by registered dietitians." },
  { property: "og:title", content: "Clinical Nutrition Protocol | Tanmatra" },
  { property: "og:description", content: "Evidence-based therapeutic meal plans for diabetes, PCOS, and other clinical conditions — supervised by registered dietitians." },
  { property: "og:image", content: "https://tanmatra.food/opengraph.jpg" },
  { property: "og:type", content: "website" },
  { property: "og:url", content: "https://tanmatra.food/clinical" },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:title", content: "Clinical Nutrition Protocol | Tanmatra" },
  { name: "twitter:description", content: "Therapeutic meal plans designed to support diabetes, PCOS, and other clinical nutrition goals — supervised by registered dietitians." },
  { name: "twitter:image", content: "https://tanmatra.food/opengraph.jpg" },
  { tagName: "link", rel: "canonical", href: "https://tanmatra.food/clinical" },
  {
    "script:ld+json": {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Clinical Nutrition Protocol | Tanmatra",
      "url": "https://tanmatra.food/clinical",
    },
  },
];

export const handle = { chrome: false };

export default function Clinical() {
  return <V2Protocol which="clinical" />;
}
