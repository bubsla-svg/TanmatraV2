import type { MetaFunction } from "react-router";
import V2Recipes from "@/tanmatra-v2/Recipes";

export const meta: MetaFunction = () => [
  { title: "Healthy Recipes | Tanmatra" },
  { name: "description", content: "Explore dietitian-curated recipes built around whole ingredients, balanced macros, and real flavour. Filter by goal, diet, and prep time." },
  { property: "og:title", content: "Healthy Recipes | Tanmatra" },
  { property: "og:description", content: "Dietitian-curated recipes with balanced macros. Filter by goal, diet, and prep time." },
  { property: "og:image", content: "https://tanmatra.food/opengraph.jpg" },
];

export const handle = { chrome: false };

export default function Recipes() {
  return <V2Recipes />;
}
