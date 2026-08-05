import type { Metadata } from "next";
import CareConditionClient from "./CareConditionClient";

interface PageProps {
  params: Promise<{ condition: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { condition } = await params;
  const title = condition
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return {
    title: `${title} Clinical Care Protocol | Tanmatra`,
    description: `Targeted clinical nutritional protocol for ${title} management, designed by registered dietitians.`,
  };
}

export default async function CareConditionPage({ params }: PageProps) {
  const { condition } = await params;
  return <CareConditionClient condition={condition} />;
}
