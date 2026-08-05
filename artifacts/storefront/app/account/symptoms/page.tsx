import type { Metadata } from "next";
import SymptomsClient from "./SymptomsClient";

export const metadata: Metadata = {
  title: "SYMPTOMS | Tanmatra",
};

export default function SymptomsPage() {
  return <SymptomsClient />;
}
