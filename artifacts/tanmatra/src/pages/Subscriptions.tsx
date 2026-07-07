import type { MetaFunction } from "react-router";
import V2Subscriptions from "@/tanmatra-v2/Subscriptions";

export const meta: MetaFunction = () => [
  { title: "My Subscriptions | Tanmatra" },
  { name: "robots", content: "noindex, nofollow" },
];

export const handle = { chrome: false };

export default function Subscriptions() {
  return <V2Subscriptions />;
}
