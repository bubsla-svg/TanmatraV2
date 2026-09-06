import type { Metadata } from "next";
import { CommunityQaForum } from "@/components/qa/CommunityQaForum";

export const metadata: Metadata = {
  title: "Community Nutrition Q&A",
  description: "Questions other customers asked, answered by the Tanmatra team.",
};

export default function CommunityQaPage() {
  return (
    <section
      data-ui-generation="stitch-74"
      data-screen-id="11.8"
      data-screen-state="default"
      className="mx-auto max-w-7xl px-4 py-10 flex flex-col gap-8"
    >
      <div className="flex flex-col gap-2">
        <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-gold-text">
          Ask the kitchen
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Community Nutrition Q&amp;A Forum
        </h1>
        <p className="text-sm leading-relaxed text-ink-muted max-w-2xl">
          Read what we have already answered for other customers, or ask your own question and get a reply.
        </p>
      </div>

      <CommunityQaForum />
    </section>
  );
}
