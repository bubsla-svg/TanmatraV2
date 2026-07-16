import type { MetaFunction } from "react-router";
import { Navigate, useLocation } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Your Plan | Tanmatra" },
  { name: "robots", content: "noindex, follow" },
];

export const handle = { chrome: false };

// Plan management lives at /subscriptions (with billing/mandates at
// /account/billing). Forward the legacy /account/plan URL there instead of a
// dead-end stub; /subscriptions is auth-gated by UserAuthLayout, so an
// anonymous visitor is bounced to /login with the correct `next`.
export default function PlanStub() {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: "/subscriptions", search, hash }} replace />;
}
