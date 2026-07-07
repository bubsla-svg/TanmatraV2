import type { MetaFunction } from "react-router";
import V2Orders from "@/tanmatra-v2/Orders";

export const meta: MetaFunction = () => [
  { title: "My Orders | Tanmatra" },
  { name: "robots", content: "noindex, nofollow" },
];

export const handle = { chrome: false };

export default function Orders() {
  return <V2Orders />;
}
