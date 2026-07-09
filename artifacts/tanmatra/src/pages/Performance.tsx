import { type MetaFunction } from "react-router";
import V2Protocol from "@/tanmatra-v2/Protocol";

export const meta: MetaFunction = () => [
  { title: "Performance Protocol | Tanmatra" },
  { name: "description", content: "High-protein, macro-calibrated meals built for athletes, gym-goers, and anyone optimising for physical performance and recovery." },
  { property: "og:title", content: "Performance Protocol | Tanmatra" },
  { property: "og:description", content: "High-protein meals built for athletes and anyone optimising for physical performance." },
  { property: "og:image", content: "https://tanmatra.food/opengraph.jpg" },
  { property: "og:type", content: "website" },
  { property: "og:url", content: "https://tanmatra.food/performance" },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:title", content: "Performance Protocol | Tanmatra" },
  { name: "twitter:description", content: "High-protein meals built for athletes and anyone optimising for physical performance." },
  { name: "twitter:image", content: "https://tanmatra.food/opengraph.jpg" },
  { tagName: "link", rel: "canonical", href: "https://tanmatra.food/performance" },
  {
    "script:ld+json": {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Performance Protocol | Tanmatra",
      "url": "https://tanmatra.food/performance",
    },
  },
];

export const handle = { chrome: false };

export default function Performance() {
  return <V2Protocol which="performance" />;
}
