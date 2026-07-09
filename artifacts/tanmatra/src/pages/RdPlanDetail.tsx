import { type MetaFunction } from "react-router";
import { getRdPlanBySlug } from "@/lib/rdPlans";
import V2RdPlanDetail from "@/tanmatra-v2/RdPlanDetail";

export const meta: MetaFunction = ({ params }) => {
  const plan = getRdPlanBySlug(params.slug ?? "");
  if (!plan) return [{ title: "Meal Plan | Tanmatra" }];
  const title = `${plan.name} — RD Meal Plan | Tanmatra`;
  const image = "https://tanmatra.food/opengraph.jpg";
  const url = `https://tanmatra.food/plans/${plan.slug}`;
  const price = (plan.pricePerWeekPaise / 100).toFixed(0);
  return [
    { title },
    { name: "description", content: plan.tagline },
    { property: "og:type", content: "product" },
    { property: "og:title", content: title },
    { property: "og:description", content: plan.tagline },
    { property: "og:image", content: image },
    { property: "og:url", content: url },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: plan.tagline },
    { name: "twitter:image", content: image },
    { tagName: "link", rel: "canonical", href: url },
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": plan.name,
        "description": plan.description,
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
          { "@type": "ListItem", "position": 2, "name": "Plans", "item": "https://tanmatra.food/plans" },
          { "@type": "ListItem", "position": 3, "name": plan.name, "item": url },
        ],
      },
    },
  ];
};

export const handle = { chrome: false };

export default function RdPlanDetail() {
  return <V2RdPlanDetail />;
}
