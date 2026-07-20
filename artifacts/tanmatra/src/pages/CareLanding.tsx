import { useParams, type MetaFunction } from "react-router";
import CareLandingView, { isCareCondition } from "@/components/landing/CareLandingView";
import NotFound from "./not-found";

/**
 * `/care/:condition` (Playbook §3.2) — thin SEO wrapper around the shared
 * CareLandingView template. Valid conditions: `pcos` | `diabetes`; anything
 * else renders the standard 404 page. Meta copy follows §7.6: diet-descriptive
 * only, the clinical promise rides on the RD consult service.
 */

const CARE_META: Record<string, { title: string; description: string }> = {
  pcos: {
    title: "Hormone-Aware Meals, Designed by RDs | Tanmatra Care",
    description:
      "A low-GI, anti-inflammatory, fibre-forward menu designed by registered dietitians, plus a free 15-minute RD intro consult. Published nutrition on every dish, delivered hot across Noida.",
  },
  diabetes: {
    title: "Low-GI, Sugar-Conscious Meals — Measured, Not Marketed | Tanmatra Care",
    description:
      "Published GI bands, carbs and sugar on every dish, with meals held to measured caps — and a free 15-minute consult with a registered dietitian. Delivered hot across Noida.",
  },
};

export const meta: MetaFunction = ({ params }) => {
  const condition = typeof params.condition === "string" ? params.condition : "";
  const entry = CARE_META[condition];
  if (!entry) {
    return [
      { title: "Care Protocols | Tanmatra" },
      { name: "robots", content: "noindex, follow" },
    ];
  }
  const url = `https://tanmatra.food/care/${condition}`;
  return [
    { title: entry.title },
    { name: "description", content: entry.description },
    { property: "og:type", content: "website" },
    { property: "og:title", content: entry.title },
    { property: "og:description", content: entry.description },
    { property: "og:image", content: "https://tanmatra.food/opengraph.jpg" },
    { property: "og:url", content: url },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: entry.title },
    { name: "twitter:description", content: entry.description },
    { name: "twitter:image", content: "https://tanmatra.food/opengraph.jpg" },
    { tagName: "link", rel: "canonical", href: url },
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: entry.title,
        url,
      },
    },
  ];
};

export const handle = { chrome: false };

export default function CareLanding() {
  const { condition } = useParams();
  if (!isCareCondition(condition)) {
    return <NotFound />;
  }
  return <CareLandingView condition={condition} />;
}
