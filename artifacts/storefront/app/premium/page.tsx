import type { Metadata } from "next";
import PremiumClient from "./PremiumClient";

export const metadata: Metadata = {
  title: "PREMIUM | Tanmatra",
};

export default function PremiumPage() {
  return <PremiumClient />;
}
