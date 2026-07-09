import type { MetaFunction } from "react-router";
import { listRds } from "@/lib/rdBookingData";
import V2RdDirectory from "@/tanmatra-v2/RdDirectory";

export const meta: MetaFunction = () => [
  { title: "Find a Registered Dietitian | Tanmatra" },
  { name: "description", content: "Browse and book consultations with Tanmatra's registered dietitians. Expert nutrition guidance for wellness, performance, and clinical goals." },
  { property: "og:type", content: "website" },
  { property: "og:title", content: "Find a Registered Dietitian | Tanmatra" },
  { property: "og:description", content: "Browse and book consultations with Tanmatra's registered dietitians." },
  { property: "og:image", content: "https://tanmatra.food/opengraph.jpg" },
  { property: "og:url", content: "https://tanmatra.food/rd" },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:title", content: "Find a Registered Dietitian | Tanmatra" },
  { name: "twitter:description", content: "Browse and book consultations with Tanmatra's registered dietitians." },
  { name: "twitter:image", content: "https://tanmatra.food/opengraph.jpg" },
  { tagName: "link", rel: "canonical", href: "https://tanmatra.food/rd" },
  {
    "script:ld+json": {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "Tanmatra Registered Dietitians",
      "url": "https://tanmatra.food/rd",
      "itemListElement": listRds().map(({ profile, member }, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "item": {
          "@type": "Person",
          "name": member.name,
          "jobTitle": "Registered Dietitian",
          "url": `https://tanmatra.food/rd/${profile.slug}`,
        },
      })),
    },
  },
];

export const handle = { chrome: false };

export default function RdDirectory() {
  return <V2RdDirectory />;
}
