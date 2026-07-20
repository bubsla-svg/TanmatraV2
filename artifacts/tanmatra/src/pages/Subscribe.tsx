import { type MetaFunction } from "react-router";
import V2Subscribe from "@/tanmatra-v2/Subscribe";

export const meta: MetaFunction = () => [
  { title: "Build Your Meal Plan | Tanmatra" },
  { name: "description", content: "Configure an RD-designed weekly meal plan — pick your days, meals, and start date. Sign in to subscribe." },
  { name: "robots", content: "noindex, follow" },
];

export const handle = { chrome: false };

// Money-CUJ crash containment (Pillar 2): render a styled recovery
// screen instead of a white screen; cart/drafts survive the reload.
export { MoneyPathErrorBoundary as ErrorBoundary } from "@/components/checkout/MoneyPathErrorBoundary";

export default function Subscribe() {
  return <V2Subscribe />;
}
