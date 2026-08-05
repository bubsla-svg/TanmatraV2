import type { Metadata } from "next";
import QaClient from "./QaClient";

export const metadata: Metadata = {
  title: "Clinical Q&A & Ingredient Transparency | Tanmatra",
  description: "Explore the scientific evidence, cooking fat standards, and clinical rationales behind Tanmatra metabolic meal protocols.",
};

export default function QaPage() {
  return <QaClient />;
}
