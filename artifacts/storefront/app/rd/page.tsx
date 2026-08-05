import type { Metadata } from "next";
import RdClient from "./RdClient";

export const metadata: Metadata = {
  title: "Registered Dietitians & Clinical Board | Tanmatra",
  description: "Consult with board-certified clinical dietitians to calibrate your personalized metabolic meal protocols.",
};

export default function RdPage() {
  return <RdClient />;
}
