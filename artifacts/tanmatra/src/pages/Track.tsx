import type { MetaFunction } from "react-router";
import V2Track from "@/tanmatra-v2/Track";

export const meta: MetaFunction = () => [
  { title: "Track Your Order | Tanmatra" },
  { name: "description", content: "Enter your order ID to check the live status of your Tanmatra delivery." },
  { name: "robots", content: "noindex, follow" },
];

export const handle = { chrome: false };

export default function Track() {
  return <V2Track />;
}
