import type { Metadata } from "next";
import { CoachChat } from "@/components/coach/CoachChat";

export const metadata: Metadata = {
  title: "Nutrition coach",
  robots: { index: false },
};

/**
 * Nutrition coach (/coach). Session-gated chat over POST /coach-agent/chat.
 * The standing disclaimer sits in the header; the coach also appends a
 * per-reply disclaimer and routes clinical questions to /rd server-side.
 */
export default function CoachPage() {
  return (
    <section className="mx-auto flex min-h-[70vh] max-w-md flex-col px-4 py-8">
      <div className="border-b border-line pb-4">
        <h1 className="text-xl font-bold text-ink">Nutrition coach</h1>
        <p className="mt-1 text-xs text-ink-muted">
          General nutrition guidance, not medical advice. Clinical questions go to a Registered Dietitian.
        </p>
      </div>
      <div className="mt-5 flex-1">
        <CoachChat />
      </div>
    </section>
  );
}
