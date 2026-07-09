import { type MetaFunction } from "react-router";
import V2ZenTracker from "@/tanmatra-v2/ZenTracker";

export const meta: MetaFunction = () => [
  { title: "Live Order Tracking | Tanmatra" },
  { name: "description", content: "Follow your Tanmatra order in real time, from kitchen prep to doorstep delivery." },
  { name: "robots", content: "noindex, follow" },
];

export const handle = { chrome: false };

export default function ZenTracker() {
  return <V2ZenTracker />;
}
