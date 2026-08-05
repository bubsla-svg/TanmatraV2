import type { Metadata } from "next";
import GymsClient from "./GymsClient";

export const metadata: Metadata = {
  title: "Gym & Athletic Facility Partnerships | Tanmatra",
  description: "Deploy Tanmatra performance coolers and member nutrition subsidies at your fitness facility.",
};

export default function GymsPartnerPage() {
  return <GymsClient />;
}
