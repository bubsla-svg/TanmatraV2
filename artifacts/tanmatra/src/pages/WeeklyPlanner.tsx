import { type MetaFunction } from "react-router";
import V2WeeklyPlanner from "@/tanmatra-v2/WeeklyPlanner";

export const meta: MetaFunction = () => [
  { title: "Meal Planner | Tanmatra" },
  { name: "robots", content: "noindex, nofollow" },
];

export const handle = { chrome: false };

export default function WeeklyPlanner() {
  return <V2WeeklyPlanner />;
}
