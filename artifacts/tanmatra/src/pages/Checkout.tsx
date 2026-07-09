import type { MetaFunction } from "react-router";
import V2Checkout from "@/tanmatra-v2/Checkout";

export const meta: MetaFunction = () => [
  { title: "Checkout | Tanmatra" },
  { name: "description", content: "Enter your delivery details and payment method to place your Tanmatra order." },
  { name: "robots", content: "noindex, follow" },
];

export const handle = { chrome: false };

export default function Checkout() {
  return <V2Checkout />;
}
