import type { Metadata } from "next";
import PreferencesClient from "./PreferencesClient";

export const metadata: Metadata = {
  title: "PREFERENCES | Tanmatra",
};

export default function PreferencesPage() {
  return <PreferencesClient />;
}
