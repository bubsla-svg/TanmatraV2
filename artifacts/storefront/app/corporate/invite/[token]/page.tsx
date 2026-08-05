import type { Metadata } from "next";
import CorporateInviteClient from "./CorporateInviteClient";

interface PageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  return {
    title: `Corporate Invite ${token} | Tanmatra`,
    robots: { index: false },
  };
}

export default async function CorporateInvitePage({ params }: PageProps) {
  const { token } = await params;
  return <CorporateInviteClient token={token} />;
}
