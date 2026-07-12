import type { MetaFunction } from "react-router";
import { Navigate, useLocation } from "react-router";

/**
 * `/profile` is a common URL users type (and that external links/QR codes
 * point at), but the canonical account surface lives at `/account`. Rather
 * than 404, permanently forward `/profile` → `/account`. The target is
 * auth-gated by UserAuthLayout, so an unauthenticated visitor is then bounced
 * to /login with the correct `next` — same as visiting /account directly.
 */
export const meta: MetaFunction = () => [
  { title: "Account | Tanmatra" },
  { name: "robots", content: "noindex, follow" },
];

export const handle = { chrome: false };

export default function ProfileRedirect() {
  // Preserve any query string / hash on the incoming /profile URL so deep
  // links like /profile?tab=orders survive the redirect to /account.
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: "/account", search, hash }} replace />;
}
