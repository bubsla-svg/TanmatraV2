import { type MetaFunction } from "react-router";
import V2RecipeDetail from "@/tanmatra-v2/RecipeDetail";

export const meta: MetaFunction = ({ params }) => {
  const slug = params.slug ?? "";
  const canonical = `https://tanmatra.food/recipes/${slug}`;
  return [
    { title: "Recipe | Tanmatra" },
    { property: "og:type", content: "article" },
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "Recipe",
        "publisher": { "@type": "Organization", "name": "Tanmatra", "url": "https://tanmatra.food" },
        "url": canonical,
      },
    },
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://tanmatra.food/" },
          { "@type": "ListItem", "position": 2, "name": "Recipes", "item": "https://tanmatra.food/recipes" },
          { "@type": "ListItem", "position": 3, "name": "Recipe", "item": canonical },
        ],
      },
    },
  ];
};

export const handle = { chrome: false };

export default function RecipeDetail() {
  return <V2RecipeDetail />;
}
