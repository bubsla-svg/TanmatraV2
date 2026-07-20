import { type MetaFunction } from "react-router";
import CorporateWellnessView from "@/components/landing/CorporateWellnessView";

export const meta: MetaFunction = () => [
  { title: "Corporate Wellness — RD-Designed Team Lunches in Noida | Tanmatra" },
  {
    name: "description",
    content:
      "Subsidised, RD-designed team lunches delivered hot inside Noida IT parks. Company budgets, office order windows, one consolidated delivery per floor, single GST invoice. Book a 20-minute pilot call.",
  },
  { property: "og:type", content: "website" },
  {
    property: "og:title",
    content: "Corporate Wellness — RD-Designed Team Lunches in Noida | Tanmatra",
  },
  {
    property: "og:description",
    content:
      "The lunch benefit your team actually uses: RD-designed, subsidised lunches delivered hot inside Candor TechSpace, Advant Navis, Stellar 135 and offices across the Noida corridor.",
  },
  { property: "og:image", content: "https://tanmatra.food/opengraph.jpg" },
  { property: "og:url", content: "https://tanmatra.food/corporate-wellness" },
  { name: "twitter:card", content: "summary_large_image" },
  {
    name: "twitter:title",
    content: "Corporate Wellness — RD-Designed Team Lunches in Noida | Tanmatra",
  },
  {
    name: "twitter:description",
    content:
      "RD-designed, subsidised team lunches delivered hot inside Noida IT parks. Book a 20-minute pilot call.",
  },
  { name: "twitter:image", content: "https://tanmatra.food/opengraph.jpg" },
  { tagName: "link", rel: "canonical", href: "https://tanmatra.food/corporate-wellness" },
  {
    "script:ld+json": {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Corporate Wellness — RD-Designed Team Lunches in Noida | Tanmatra",
      url: "https://tanmatra.food/corporate-wellness",
    },
  },
];

export const handle = { chrome: false };

export default function CorporateWellnessLanding() {
  return <CorporateWellnessView />;
}
