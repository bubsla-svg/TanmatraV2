import type { Metadata } from "next";
import HistoryClient from "./HistoryClient";

export const metadata: Metadata = {
  title: "HISTORY | Tanmatra",
};

export default function HistoryPage() {
  return <HistoryClient />;
}
