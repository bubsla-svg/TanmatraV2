import type { Metadata } from "next";
import PerformanceClient from "./PerformanceClient";

export const metadata: Metadata = {
  title: "Performance Protocol | Tanmatra",
  description: "Engineered metabolic fueling strategies for peak athletic performance and accelerated recovery.",
};

export default function PerformancePage() {
  return <PerformanceClient />;
}
