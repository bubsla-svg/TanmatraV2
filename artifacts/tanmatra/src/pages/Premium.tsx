import { type MetaFunction } from "react-router";
import V2Premium from "@/tanmatra-v2/Premium";

export const meta: MetaFunction = () => [
  { title: "Tanmatra Premium" },
  { name: "description", content: "Unlock exclusive dishes, priority delivery, advanced meal planning, and direct access to your personal registered dietitian with Tanmatra Premium." },
  { property: "og:title", content: "Tanmatra Premium" },
  { property: "og:description", content: "Unlock exclusive dishes, priority delivery, and direct access to your personal registered dietitian." },
  { property: "og:image", content: "https://tanmatra.food/opengraph.jpg" },
];

export const handle = { chrome: false };

export default function Premium() {
  return <V2Premium />;
}
