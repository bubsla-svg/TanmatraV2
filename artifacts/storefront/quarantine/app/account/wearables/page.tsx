import { permanentRedirect } from "next/navigation";

/**
 * 308 Permanent Redirect: Legacy /account/wearables -> Canonical /account/connections
 */
export default function WearablesRedirectPage() {
  permanentRedirect("/account/connections");
}
