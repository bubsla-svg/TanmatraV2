import type { Metadata } from "next";
import CorporateWellnessClient from "./CorporateWellnessClient";

export const metadata: Metadata = {
  title: "Corporate Wellness & Employee Meal Subsidies | Tanmatra",
  description: "Clinically designed, high-performance executive and team nutrition protocols with managed employer subsidies.",
};

export default function CorporateWellnessPage() {
  return <CorporateWellnessClient />;
}
