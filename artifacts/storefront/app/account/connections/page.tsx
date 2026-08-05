import type { Metadata } from "next";
import ConnectionsClient from "./ConnectionsClient";

export const metadata: Metadata = {
  title: "HEALTH CONNECTIONS | Tanmatra",
  robots: { index: false },
};

export default function ConnectionsPage() {
  return <ConnectionsClient />;
}
