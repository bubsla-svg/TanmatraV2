import { type MetaFunction } from "react-router";
import V2Addresses from "@/tanmatra-v2/Addresses";

export const meta: MetaFunction = () => [
  { title: "Addresses | Tanmatra" },
  { name: "robots", content: "noindex, nofollow" },
];

export const handle = { chrome: false };

export default function Addresses() {
  return <V2Addresses />;
}
