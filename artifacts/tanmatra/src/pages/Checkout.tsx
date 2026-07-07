import type { MetaFunction } from "react-router";
import V2Checkout from "@/tanmatra-v2/Checkout";

export const meta: MetaFunction = () => [
  { title: "Checkout | Tanmatra" },
  { name: "robots", content: "noindex, nofollow" },
];

export const handle = { chrome: false };

export default function Checkout() {
  return <V2Checkout />;
}
