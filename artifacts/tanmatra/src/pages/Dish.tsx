import { type MetaFunction } from "react-router";
import { getDishBySlug } from "@/lib/menuData";
import V2Dish from "@/tanmatra-v2/Dish";

export const meta: MetaFunction = ({ params }) => {
  const dish = getDishBySlug(params.slug ?? "");
  if (!dish) return [{ title: "Dish | Tanmatra" }];
  const price = (dish.price / 100).toFixed(0);
  const image = dish.image ?? "https://tanmatra.food/opengraph.jpg";
  const url = `https://tanmatra.food/dish/${dish.slug}`;
  return [
    { title: `${dish.name} | Tanmatra` },
    { name: "description", content: dish.description },
    { property: "og:type", content: "product" },
    { property: "og:title", content: dish.name },
    { property: "og:description", content: dish.description },
    { property: "og:image", content: image },
    { property: "og:url", content: url },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: dish.name },
    { name: "twitter:description", content: dish.description },
    { name: "twitter:image", content: image },
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": dish.name,
        "description": dish.description,
        "image": image,
        "url": url,
        "brand": { "@type": "Brand", "name": "Tanmatra" },
        "offers": {
          "@type": "Offer",
          "price": price,
          "priceCurrency": "INR",
          "availability": "https://schema.org/InStock",
          "seller": { "@type": "Organization", "name": "Tanmatra" },
        },
      },
    },
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://tanmatra.food/" },
          { "@type": "ListItem", "position": 2, "name": "Menu", "item": "https://tanmatra.food/menu" },
          { "@type": "ListItem", "position": 3, "name": dish.name, "item": url },
        ],
      },
    },
  ];
};

export default function Dish() {
  return <V2Dish />;
}
