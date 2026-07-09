import type { MetaFunction } from "react-router";
import V2Orders from "@/tanmatra-v2/Orders";

export const meta: MetaFunction = () => [
  { title: "Order History | Tanmatra" },
  { name: "description", content: "View your past and current Tanmatra orders and reorder your favorites. Sign in to see your order history." },
  { name: "robots", content: "noindex, follow" },
];

export const handle = { chrome: false };

export default function Orders() {
  return <V2Orders />;
}
