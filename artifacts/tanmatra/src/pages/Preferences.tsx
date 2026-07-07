import type { MetaFunction } from "react-router";
import V2Preferences from "@/tanmatra-v2/Preferences";

export const meta: MetaFunction = () => [
  { title: "Preferences | Tanmatra" },
  { name: "robots", content: "noindex, nofollow" },
];

export const handle = { chrome: false };

export default function Preferences() {
  return <V2Preferences />;
}
