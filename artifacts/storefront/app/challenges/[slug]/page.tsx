import type { Metadata } from "next";
import ChallengeDetailClient from "./ChallengeDetailClient";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const title = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return {
    title: `${title} | Tanmatra Cohort Challenge`,
    description: `Join the Tanmatra ${title} guided metabolic cohort with daily clinical meal kits and registered dietitian check-ins.`,
  };
}

export default async function ChallengeDetailPage({ params }: PageProps) {
  const { slug } = await params;
  return <ChallengeDetailClient slug={slug} />;
}
