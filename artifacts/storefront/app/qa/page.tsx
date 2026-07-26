import type { Metadata } from "next";
import { CommunityQaForum } from "@/components/qa/CommunityQaForum";

export const metadata: Metadata = {
  title: "Community Clinical Q&A & Social Forum | Tanmatra",
  description: "Browse peer dietary inquiries and inspect official therapeutic answers authored by certified Registered Dietitians.",
};

export default function CommunityQaPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">
          Collective Wisdom &amp; Advisory Care
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Community Nutrition Q&amp;A Forum
        </h1>
        <p className="text-sm leading-relaxed text-ink-muted max-w-2xl">
          Explore evidence-grounded responses from our clinical advisory team and submit personalized dietary questions directly to our registered dietitians.
        </p>
      </div>

      <CommunityQaForum />
    </section>
  );
}
