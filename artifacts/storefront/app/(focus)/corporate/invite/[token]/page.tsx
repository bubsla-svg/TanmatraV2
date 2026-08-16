import type { Metadata } from "next";
import { CompanyInvite } from "@/components/corporate/CompanyInvite";
import { FocusHeader } from "@/components/FocusHeader";

interface PageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  return {
    title: `Corporate Invite ${token}`,
    robots: { index: false },
  };
}

/** Shared invite link → accept to join a company meal program. Real
 *  server-backed accept (GET /companies/invites/:token, POST .../accept) —
 *  the company name, role and discount all come from that response, never
 *  fabricated from the token string. See CompanyInvite for the 401/403/404
 *  handling. */
export default async function CorporateInvitePage({ params }: PageProps) {
  const { token } = await params;
  return (
    <section
      data-ui-generation="stitch-74"
      data-screen-id="12.1"
      data-screen-state="default"
      className="mx-auto max-w-md px-4 py-12"
    >
      <FocusHeader backLabel="Back" />
      <CompanyInvite token={token} />
    </section>
  );
}
