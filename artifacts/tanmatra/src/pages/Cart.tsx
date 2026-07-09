import { type MetaFunction } from "react-router";
import V2Cart from "@/tanmatra-v2/Cart";

export const meta: MetaFunction = () => [
  { title: "Your Cart | Tanmatra" },
  { name: "description", content: "Review the meals in your cart, adjust quantities, and proceed to checkout for fresh Tanmatra delivery." },
  { name: "robots", content: "noindex, follow" },
];

export const handle = { chrome: false };

export default function Cart() {
  return <V2Cart />;
}
