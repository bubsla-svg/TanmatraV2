import type { Metadata } from "next";
import { CompanyInvite } from "@/components/corporate/CompanyInvite";

export const metadata: Metadata = {
  title: "Company invite",
  robots: { index: false },
};

/** corporate/invite/[token] (route-parity Wave E). Shared invite link → accept
 *  to join a company meal program. Token-linked, so noindex. */
export default async function CompanyInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <section className="mx-auto max-w-md px-4 py-12">
      <CompanyInvite token={token} />
    </section>
  );
}
