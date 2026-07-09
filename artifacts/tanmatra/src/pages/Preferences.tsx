import type { MetaFunction } from "react-router";
import V2Preferences from "@/tanmatra-v2/Preferences";

export const meta: MetaFunction = () => [
  { title: "Health Preferences & Assessment | Tanmatra" },
  { name: "description", content: "Set your dietary preferences, allergies, and health goals to personalize your meals. Sign in to update your assessment." },
  { name: "robots", content: "noindex, follow" },
];

export const handle = { chrome: false };

export default function Preferences() {
  return <V2Preferences />;
}
