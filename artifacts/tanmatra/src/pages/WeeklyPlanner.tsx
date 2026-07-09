import { type MetaFunction } from "react-router";
import V2WeeklyPlanner from "@/tanmatra-v2/WeeklyPlanner";

export const meta: MetaFunction = () => [
  { title: "Weekly Meal Planner | Tanmatra" },
  { name: "description", content: "Plan and customize your Tanmatra meals for the week ahead. Sign in to edit your weekly menu." },
  { name: "robots", content: "noindex, follow" },
];

export const handle = { chrome: false };

export default function WeeklyPlanner() {
  return <V2WeeklyPlanner />;
}
