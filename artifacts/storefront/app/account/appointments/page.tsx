import type { Metadata } from "next";
import AppointmentsClient from "./AppointmentsClient";

export const metadata: Metadata = {
  title: "CONSULTS | Tanmatra",
};

export default function AppointmentsPage() {
  return <AppointmentsClient />;
}
