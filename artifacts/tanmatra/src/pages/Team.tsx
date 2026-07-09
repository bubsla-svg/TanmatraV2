import { type MetaFunction } from "react-router";
import { TEAM } from "@/lib/teamData";
import V2Team from "@/tanmatra-v2/Team";

export const meta: MetaFunction = () => [
  { title: "Our Team | Tanmatra" },
  { name: "description", content: "Meet Tanmatra's registered dietitians, clinical nutritionists, and food scientists who design every meal to clinical standards." },
  { property: "og:type", content: "website" },
  { property: "og:title", content: "Our Team | Tanmatra" },
  { property: "og:description", content: "Meet the registered dietitians and clinical nutritionists behind every Tanmatra meal." },
  { property: "og:image", content: "https://tanmatra.food/opengraph.jpg" },
  { property: "og:url", content: "https://tanmatra.food/team" },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:title", content: "Our Team | Tanmatra" },
  { name: "twitter:description", content: "Meet the registered dietitians and clinical nutritionists behind every Tanmatra meal." },
  { name: "twitter:image", content: "https://tanmatra.food/opengraph.jpg" },
  { tagName: "link", rel: "canonical", href: "https://tanmatra.food/team" },
  {
    "script:ld+json": {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "Tanmatra Team",
      "url": "https://tanmatra.food/team",
      "itemListElement": TEAM.map((member, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "item": {
          "@type": "Person",
          "name": member.name,
          "jobTitle": member.title,
          "url": `https://tanmatra.food/team/${member.slug}`,
        },
      })),
    },
  },
];

export const handle = { chrome: false };

export default function Team() {
  return <V2Team />;
}
