import type { MetaFunction } from "react-router";
import V2Challenges from "@/tanmatra-v2/Challenges";

export const meta: MetaFunction = () => [
  { title: "Wellness Challenges | Tanmatra" },
  { name: "description", content: "Join structured wellness challenges designed by registered dietitians. Build lasting habits with community accountability and expert guidance." },
  { property: "og:title", content: "Wellness Challenges | Tanmatra" },
  { property: "og:description", content: "Join structured wellness challenges designed by registered dietitians. Build lasting habits with expert guidance." },
  { property: "og:image", content: "https://tanmatra.food/opengraph.jpg" },
];

export const handle = { chrome: false };

export default function Challenges() {
  return <V2Challenges />;
}
