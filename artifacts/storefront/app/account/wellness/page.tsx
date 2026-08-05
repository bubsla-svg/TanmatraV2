import type { Metadata } from "next";
import WellnessClient from "./WellnessClient";

export const metadata: Metadata = {
  title: "WELLNESS | Tanmatra",
};

export default function WellnessPage() {
  return <WellnessClient />;
}
