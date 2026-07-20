import { type MetaFunction } from "react-router";
import MetabolicLandingView from "@/components/landing/MetabolicLandingView";

export const meta: MetaFunction = () => [
  { title: "Metabolic Meal Programs — Fat Loss & Lean Muscle | Tanmatra" },
  {
    name: "description",
    content:
      "RD-calibrated fat-loss and muscle-gain meal programs for Noida professionals. Published macros on every dish, fired after you order, delivered hot in 40–45 minutes.",
  },
  { property: "og:type", content: "website" },
  { property: "og:title", content: "Metabolic Meal Programs — Fat Loss & Lean Muscle | Tanmatra" },
  {
    property: "og:description",
    content:
      "Your macros, engineered. RD-designed fat-loss and lean-muscle programs with published per-dish nutrition, delivered hot in 40–45 minutes.",
  },
  { property: "og:image", content: "https://tanmatra.food/opengraph.jpg" },
  { property: "og:url", content: "https://tanmatra.food/metabolic" },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:title", content: "Metabolic Meal Programs — Fat Loss & Lean Muscle | Tanmatra" },
  {
    name: "twitter:description",
    content:
      "Your macros, engineered. RD-designed fat-loss and lean-muscle programs with published per-dish nutrition, delivered hot in 40–45 minutes.",
  },
  { name: "twitter:image", content: "https://tanmatra.food/opengraph.jpg" },
  { tagName: "link", rel: "canonical", href: "https://tanmatra.food/metabolic" },
  {
    "script:ld+json": {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Metabolic Meal Programs — Fat Loss & Lean Muscle | Tanmatra",
      url: "https://tanmatra.food/metabolic",
    },
  },
];

export const handle = { chrome: false };

export default function MetabolicLanding() {
  return <MetabolicLandingView />;
}
