import { type MetaFunction } from "react-router";
import V2ZenTracker from "@/tanmatra-v2/ZenTracker";

export const meta: MetaFunction = () => [
  { title: "Track Order | Tanmatra" },
  { name: "robots", content: "noindex, nofollow" },
];

export const handle = { chrome: false };

export default function ZenTracker() {
  return <V2ZenTracker />;
}
