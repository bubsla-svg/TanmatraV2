import type { MetaFunction } from "react-router";
import V2Appointments from "@/tanmatra-v2/Appointments";

export const meta: MetaFunction = () => [
  { title: "Appointments | Tanmatra" },
  { name: "robots", content: "noindex, nofollow" },
];

export const handle = { chrome: false };

export default function Appointments() {
  return <V2Appointments />;
}
