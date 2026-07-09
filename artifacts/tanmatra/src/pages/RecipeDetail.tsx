import { type MetaFunction } from "react-router";
import V2RecipeDetail from "@/tanmatra-v2/RecipeDetail";

// Recipe content is API-fetched at runtime, so at meta time only the slug is
// available. Humanize it for a readable fallback title.
function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export const meta: MetaFunction = ({ params }) => {
  const slug = params.slug ?? "";
  const canonical = `https://tanmatra.food/recipes/${slug}`;
  const name = humanizeSlug(slug) || "Recipe";
  const title = `Recipe: ${name} | Tanmatra`;
  const description = `${name} — a dietitian-curated recipe on Tanmatra, built around whole ingredients and balanced macros.`;
  const image = "https://tanmatra.food/opengraph.jpg";
  return [
    { title },
    { name: "description", content: description },
    { property: "og:type", content: "article" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: image },
    { property: "og:url", content: canonical },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
    { tagName: "link", rel: "canonical", href: canonical },
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "Recipe",
        "name": name,
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
          { "@type": "ListItem", "position": 3, "name": name, "item": canonical },
        ],
      },
    },
  ];
};

export const handle = { chrome: false };

export default function RecipeDetail() {
  return <V2RecipeDetail />;
}
