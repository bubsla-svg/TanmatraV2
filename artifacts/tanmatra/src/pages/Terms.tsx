import type { MetaFunction } from "react-router";
import V2Terms from "@/tanmatra-v2/Terms";

export const meta: MetaFunction = () => [
  { title: "Terms of Service · Tanmatra" },
  {
    name: "description",
    content:
      "The terms governing your use of Tanmatra — accounts, orders, payments, refunds, content and liability.",
  },
  { property: "og:type", content: "website" },
  { property: "og:title", content: "Terms of Service · Tanmatra" },
  {
    property: "og:description",
    content:
      "The terms governing your use of Tanmatra — accounts, orders, payments, refunds, content and liability.",
  },
  { property: "og:image", content: "https://tanmatra.food/opengraph.jpg" },
  { property: "og:url", content: "https://tanmatra.food/terms" },
  { name: "twitter:card", content: "summary" },
  { tagName: "link", rel: "canonical", href: "https://tanmatra.food/terms" },
];

export const handle = { chrome: false };

export default function Terms() {
  return <V2Terms />;
}
