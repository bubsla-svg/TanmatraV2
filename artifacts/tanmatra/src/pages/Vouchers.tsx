import { type MetaFunction } from "react-router";
import V2Vouchers from "@/tanmatra-v2/Vouchers";

export const meta: MetaFunction = () => [
  { title: "Vouchers | Tanmatra" },
  { name: "description", content: "View and apply your Tanmatra discount vouchers and gift codes. Sign in to see your vouchers." },
  { name: "robots", content: "noindex, follow" },
];

export const handle = { chrome: false };

export default function Vouchers() {
  return <V2Vouchers />;
}
