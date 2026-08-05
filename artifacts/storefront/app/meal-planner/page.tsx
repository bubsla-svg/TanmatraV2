import type { Metadata } from "next";
import MealPlannerClient from "./MealPlannerClient";

export const metadata: Metadata = {
  title: "Meal Planner | Tanmatra",
};

export default function MealPlannerPage() {
  return <MealPlannerClient />;
}
