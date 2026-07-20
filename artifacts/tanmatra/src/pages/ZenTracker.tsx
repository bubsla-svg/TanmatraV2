import { type MetaFunction } from "react-router";
import V2ZenTracker from "@/tanmatra-v2/ZenTracker";

// Playbook §5.2 naming fix: the order-tracking surface is "Live Kitchen";
// the "Zen Tracker" name now belongs to the habit/streak surface (Zone 3).
export const meta: MetaFunction = () => [
  { title: "Live Kitchen — Order Tracking | Tanmatra" },
  { name: "description", content: "Follow your Tanmatra order in real time, from kitchen prep to doorstep delivery." },
  { name: "robots", content: "noindex, follow" },
];

export const handle = { chrome: false };

export default function ZenTracker() {
  return <V2ZenTracker />;
}
