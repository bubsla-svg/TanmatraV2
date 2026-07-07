import { type MetaFunction } from "react-router";
import V2Rewards from "@/tanmatra-v2/Rewards";

export const meta: MetaFunction = () => [
  { title: "Rewards | Tanmatra" },
  { name: "robots", content: "noindex, nofollow" },
];

export const handle = { chrome: false };

export default function Rewards() {
  return <V2Rewards />;
}
