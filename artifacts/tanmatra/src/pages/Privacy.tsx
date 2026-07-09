import { type MetaFunction } from "react-router";
import V2Privacy from "@/tanmatra-v2/Privacy";

const TITLE = "Privacy Policy | Tanmatra";
const DESCRIPTION =
  "How Tanmatra collects, uses, stores and protects your personal data — accounts, orders, payments, dietary preferences and your rights as a user.";

export const meta: MetaFunction = () => [
  { title: TITLE },
  { name: "description", content: DESCRIPTION },
  { property: "og:type", content: "website" },
  { property: "og:title", content: TITLE },
  { property: "og:description", content: DESCRIPTION },
  { property: "og:image", content: "https://tanmatra.food/opengraph.jpg" },
  { property: "og:url", content: "https://tanmatra.food/privacy" },
  { name: "twitter:card", content: "summary" },
  { tagName: "link", rel: "canonical", href: "https://tanmatra.food/privacy" },
];

export const handle = { chrome: false };

export default function Privacy() {
  return <V2Privacy />;
}
