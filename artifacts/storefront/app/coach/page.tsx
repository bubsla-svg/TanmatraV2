import type { Metadata } from "next";
import CoachClient from "./CoachClient";

export const metadata: Metadata = {
  title: "AI Metabolic Coach & Meal Advisory | Tanmatra",
  description: "Chat with your Tanmatra AI Metabolic Coach for instant dish macro explanations, fiber sequencing tips, and meal suggestions.",
};

export default function CoachPage() {
  return <CoachClient />;
}
