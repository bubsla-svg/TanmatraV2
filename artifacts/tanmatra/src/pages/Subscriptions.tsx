import type { MetaFunction } from "react-router";
import V2Subscriptions from "@/tanmatra-v2/Subscriptions";

export const meta: MetaFunction = () => [
  { title: "My Plans | Tanmatra" },
  { name: "description", content: "View, pause, or modify your active Tanmatra meal plan subscriptions. Sign in to manage your plans." },
  { name: "robots", content: "noindex, follow" },
];

export const handle = { chrome: false };

// Money-CUJ crash containment (Pillar 2): render a styled recovery
// screen instead of a white screen; cart/drafts survive the reload.
export { MoneyPathErrorBoundary as ErrorBoundary } from "@/components/checkout/MoneyPathErrorBoundary";

export default function Subscriptions() {
  return <V2Subscriptions />;
}
