import type { Metadata } from "next";
import VouchersClient from "./VouchersClient";

export const metadata: Metadata = {
  title: "VOUCHERS | Tanmatra",
};

export default function VouchersPage() {
  return <VouchersClient />;
}
