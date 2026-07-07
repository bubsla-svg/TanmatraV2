import { type MetaFunction } from "react-router";
import V2Team from "@/tanmatra-v2/Team";

export const meta: MetaFunction = () => [
  { title: "Our Team | Tanmatra" },
  { name: "description", content: "Meet Tanmatra's registered dietitians, clinical nutritionists, and food scientists who design every meal to clinical standards." },
  { property: "og:title", content: "Our Team | Tanmatra" },
  { property: "og:description", content: "Meet the registered dietitians and clinical nutritionists behind every Tanmatra meal." },
  { property: "og:image", content: "https://tanmatra.food/opengraph.jpg" },
];

export const handle = { chrome: false };

export default function Team() {
  return <V2Team />;
}
