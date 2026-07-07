import { type MetaFunction } from "react-router";
import V2Wellness from "@/tanmatra-v2/Wellness";

export const meta: MetaFunction = () => [
  { title: "Wellness Protocol | Tanmatra" },
  { name: "description", content: "Dietitian-designed meals and plans for everyday wellness, immune support, gut health, and sustainable healthy habits." },
  { property: "og:title", content: "Wellness Protocol | Tanmatra" },
  { property: "og:description", content: "Dietitian-designed meals for everyday wellness, immune support, and sustainable healthy habits." },
  { property: "og:image", content: "https://tanmatra.food/opengraph.jpg" },
];

export const handle = { chrome: false };

export default function Wellness() {
  return <V2Wellness />;
}
