import type { MetaFunction } from "react-router";
import V2Appointments from "@/tanmatra-v2/Appointments";

export const meta: MetaFunction = () => [
  { title: "RD Appointments | Tanmatra" },
  { name: "description", content: "View and manage your consultations with registered dietitians. Sign in to see your appointments." },
  { name: "robots", content: "noindex, follow" },
];

export const handle = { chrome: false };

export default function Appointments() {
  return <V2Appointments />;
}
