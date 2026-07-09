import { type MetaFunction } from "react-router";
import V2Refunds from "@/tanmatra-v2/Refunds";

const TITLE = "Refunds & Cancellation Policy | Tanmatra";
const DESCRIPTION =
  "Tanmatra's refund and cancellation policy — order cancellation windows, refund timelines, subscription pauses, and how to escalate to our Grievance Officer.";

export const meta: MetaFunction = () => [
  { title: TITLE },
  { name: "description", content: DESCRIPTION },
  { property: "og:type", content: "website" },
  { property: "og:title", content: TITLE },
  { property: "og:description", content: DESCRIPTION },
  { property: "og:image", content: "https://tanmatra.food/opengraph.jpg" },
  { property: "og:url", content: "https://tanmatra.food/refunds" },
  { name: "twitter:card", content: "summary" },
  { tagName: "link", rel: "canonical", href: "https://tanmatra.food/refunds" },
];

// Render the self-contained v2 experience without the legacy app chrome
// (header / promo banner / bottom nav) — root.tsx reads this handle.
export const handle = { chrome: false };

export default function Refunds() {
  return <V2Refunds />;
}
