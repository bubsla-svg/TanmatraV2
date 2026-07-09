import { type MetaFunction } from "react-router";
import V2MarketplaceItem from "@/tanmatra-v2/MarketplaceItem";

// Marketplace items are API-fetched at runtime, so at meta time only the slug
// is available. Humanize it for a readable fallback title.
function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export const meta: MetaFunction = ({ params }) => {
  const slug = params.slug ?? "";
  const canonical = `https://tanmatra.food/marketplace/${slug}`;
  const name = humanizeSlug(slug) || "Marketplace Item";
  const title = `${name} | Tanmatra Marketplace`;
  const description = `${name} on the Tanmatra Marketplace — dietitian-approved health foods, supplements, and pantry staples.`;
  const image = "https://tanmatra.food/opengraph.jpg";
  return [
    { title },
    { name: "description", content: description },
    { property: "og:type", content: "product" },
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
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://tanmatra.food/" },
          { "@type": "ListItem", "position": 2, "name": "Marketplace", "item": "https://tanmatra.food/marketplace" },
          { "@type": "ListItem", "position": 3, "name": name, "item": canonical },
        ],
      },
    },
  ];
};

export const handle = { chrome: false };

export default function MarketplaceItem() {
  return <V2MarketplaceItem />;
}
