import { type MetaFunction } from "react-router";
import V2Faq, { FAQS } from "@/tanmatra-v2/Faq";

export const handle = { chrome: false };

export const meta: MetaFunction = () => [
  { title: "FAQ | Tanmatra" },
  { name: "description", content: "Frequently asked questions about Tanmatra's clinical meal delivery — ordering, delivery, plans, ingredients, and refunds." },
  { property: "og:title", content: "FAQ | Tanmatra" },
  { property: "og:url", content: "https://tanmatra.food/faq" },
  {
    "script:ld+json": {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": FAQS.map(({ q, a }) => ({
        "@type": "Question",
        "name": q,
        "acceptedAnswer": { "@type": "Answer", "text": a },
      })),
    },
  },
];

export default function Faq() {
  return <V2Faq />;
}
