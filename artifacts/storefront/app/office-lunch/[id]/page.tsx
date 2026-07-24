import type { Metadata } from "next";
import { OfficeLunch } from "@/components/corporate/OfficeLunch";

export const metadata: Metadata = {
  title: "Office lunch",
  robots: { index: false },
};

/** office-lunch/[id] (route-parity Wave E). A scheduled team lunch — members RSVP
 *  by picking their meal within budget; admins close the window. noindex. */
export default async function OfficeLunchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  return (
    <section className="mx-auto max-w-lg px-4 py-10">
      {Number.isInteger(n) && n > 0 ? <OfficeLunch id={n} /> : <p className="text-sm text-ink-muted">Not found.</p>}
    </section>
  );
}
