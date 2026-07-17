import { type MetaFunction } from "react-router";
import { DISHES as STATIC_DISHES } from "@/lib/menuData";
import V2Menu from "@/tanmatra-v2/Menu";

export const meta: MetaFunction = () => [
  { title: "Clinical Menu | Tanmatra" },
  { name: "description", content: "Browse Tanmatra's curated clinical menu — therapeutic meals formulated by registered dietitians for wellness, performance, and clinical protocols." },
  { property: "og:title", content: "Clinical Menu | Tanmatra" },
  { property: "og:description", content: "Therapeutic meals for every goal — weight management, gut health, metabolic balance, and more. Designed by RDs, delivered fresh." },
  { property: "og:type", content: "website" },
  { property: "og:image", content: "https://tanmatra.food/opengraph.jpg" },
  { property: "og:url", content: "https://tanmatra.food/menu" },
  { name: "twitter:card", content: "summary_large_image" },
  {
    "script:ld+json": {
      "@context": "https://schema.org",
      "@type": "Menu",
      "name": "Tanmatra Clinical Menu",
      "url": "https://tanmatra.food/menu",
      "hasMenuItem": STATIC_DISHES.map((dish) => ({
        "@type": "MenuItem",
        "name": dish.name,
        "description": dish.description,
        "offers": {
          "@type": "Offer",
          "price": (dish.price / 100).toFixed(2),
          "priceCurrency": "INR",
        },
        ...(dish.allergens?.length ? { "allergenDeclaration": dish.allergens.join(", ") } : {}),
      })),
    },
  },
];

export const handle = { chrome: false };

export default function Menu() {
  return <V2Menu />;
}
