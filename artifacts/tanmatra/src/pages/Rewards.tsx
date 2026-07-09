import { type MetaFunction } from "react-router";
import V2Rewards from "@/tanmatra-v2/Rewards";

export const meta: MetaFunction = () => [
  { title: "Rewards | Tanmatra" },
  { name: "description", content: "Check your reward points balance and redeem perks on Tanmatra orders. Sign in to view your rewards." },
  { name: "robots", content: "noindex, follow" },
];

export const handle = { chrome: false };

export default function Rewards() {
  return <V2Rewards />;
}
