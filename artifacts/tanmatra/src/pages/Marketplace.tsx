import type { MetaFunction } from "react-router";
import V2Marketplace from "@/tanmatra-v2/Marketplace";

export const meta: MetaFunction = () => [
  { title: "Marketplace | Tanmatra" },
  { name: "description", content: "Shop dietitian-approved health foods, supplements, and pantry staples — curated to complement your Tanmatra meal plan." },
  { property: "og:type", content: "website" },
  { property: "og:title", content: "Marketplace | Tanmatra" },
  { property: "og:description", content: "Shop dietitian-approved health foods and supplements curated to complement your meal plan." },
  { property: "og:image", content: "https://tanmatra.food/opengraph.jpg" },
  { property: "og:url", content: "https://tanmatra.food/marketplace" },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:title", content: "Marketplace | Tanmatra" },
  { name: "twitter:description", content: "Shop dietitian-approved health foods and supplements curated to complement your meal plan." },
  { name: "twitter:image", content: "https://tanmatra.food/opengraph.jpg" },
  { tagName: "link", rel: "canonical", href: "https://tanmatra.food/marketplace" },
];

export const handle = { chrome: false };

export default function Marketplace() {
  return <V2Marketplace />;
}
