import { type MetaFunction } from "react-router";
import V2Cart from "@/tanmatra-v2/Cart";

export const meta: MetaFunction = () => [
  { title: "Cart | Tanmatra" },
  { name: "robots", content: "noindex, nofollow" },
];

export default function Cart() {
  return <V2Cart />;
}
