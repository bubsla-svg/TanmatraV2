import type { Metadata } from "next";
import LoyaltyClient from "./LoyaltyClient";

export const metadata: Metadata = {
  title: "REWARDS | Tanmatra",
};

export default function LoyaltyPage() {
  return <LoyaltyClient />;
}
