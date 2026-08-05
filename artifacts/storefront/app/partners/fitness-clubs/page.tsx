import type { Metadata } from "next";
import FitnessClubsClient from "./FitnessClubsClient";

export const metadata: Metadata = {
  title: "Fitness Clubs & Endurance Communities | Tanmatra",
  description: "Cohort metabolic nutrition and race-day fueling for run clubs, triathletes, and CrossFit boxes.",
};

export default function FitnessClubsPartnerPage() {
  return <FitnessClubsClient />;
}
