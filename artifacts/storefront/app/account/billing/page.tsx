import type { Metadata } from "next";
import BillingClient from "./BillingClient";

export const metadata: Metadata = {
  title: "BILLING | Tanmatra",
};

export default function BillingPage() {
  return <BillingClient />;
}
