import type { MetaFunction } from "react-router";
import V2Corporate from "@/tanmatra-v2/Corporate";

export const meta: MetaFunction = () => [
  { title: "Corporate Wellness | Tanmatra" },
  { name: "description", content: "Bring clinical-grade nutrition to your workplace. Tanmatra's corporate wellness programme delivers dietitian-designed meals and team nutrition plans." },
  { property: "og:type", content: "website" },
  { property: "og:title", content: "Corporate Wellness | Tanmatra" },
  { property: "og:description", content: "Bring clinical-grade nutrition to your workplace with dietitian-designed meals and team nutrition plans." },
  { property: "og:image", content: "https://tanmatra.food/opengraph.jpg" },
  { property: "og:url", content: "https://tanmatra.food/corporate" },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:title", content: "Corporate Wellness | Tanmatra" },
  { name: "twitter:description", content: "Bring clinical-grade nutrition to your workplace with dietitian-designed meals and team nutrition plans." },
  { name: "twitter:image", content: "https://tanmatra.food/opengraph.jpg" },
  { tagName: "link", rel: "canonical", href: "https://tanmatra.food/corporate" },
];

export const handle = { chrome: false };

export default function Corporate() {
  return <V2Corporate />;
}
