import type { MetaFunction } from "react-router";
import V2RdDirectory from "@/tanmatra-v2/RdDirectory";

export const meta: MetaFunction = () => [
  { title: "Find a Registered Dietitian | Tanmatra" },
  { name: "description", content: "Browse and book consultations with Tanmatra's registered dietitians. Expert nutrition guidance for wellness, performance, and clinical goals." },
  { property: "og:title", content: "Find a Registered Dietitian | Tanmatra" },
  { property: "og:description", content: "Browse and book consultations with Tanmatra's registered dietitians." },
  { property: "og:image", content: "https://tanmatra.food/opengraph.jpg" },
];

export const handle = { chrome: false };

export default function RdDirectory() {
  return <V2RdDirectory />;
}
