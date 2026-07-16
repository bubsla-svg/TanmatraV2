import type { MetaFunction } from "react-router";
import { Navigate, useParams } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Trial Details | Tanmatra" },
  { name: "robots", content: "noindex, follow" },
];

export const handle = { chrome: false };

// The real trial recap/upgrade surface is /subscription/bridge, keyed by
// subscription_id. Forward the legacy /trial/:id URL there rather than showing
// a dead-end stub; the bridge renders a graceful "trial details not found"
// state if the id doesn't resolve.
export default function TrialStub() {
  const { id } = useParams();
  const search = id ? `?subscription_id=${encodeURIComponent(id)}` : "";
  return <Navigate to={{ pathname: "/subscription/bridge", search }} replace />;
}
