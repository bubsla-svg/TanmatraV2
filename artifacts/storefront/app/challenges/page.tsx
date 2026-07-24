import type { Metadata } from "next";
import { getChallenges } from "@/lib/challengesApi";
import { ChallengeCard } from "@/components/challenges/ChallengeCard";

export const metadata: Metadata = {
  title: "Challenges",
  description:
    "RD-led community challenges with a cohort, scheduled check-ins, and a shared feed. Join one and stay accountable.",
};

export const revalidate = 3600;

/** Challenges list (Community). Server-fetched grid. */
export default async function ChallengesPage() {
  const challenges = await getChallenges();
  return (
    <section className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">Community</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Challenges</h1>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
        RD-led programmes with a cohort, scheduled check-ins, and a shared feed. Join one and stay
        accountable.
      </p>
      {challenges.length === 0 ? (
        <p className="mt-10 text-sm text-ink-muted">No active challenges right now — check back soon.</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {challenges.map((c) => (
            <ChallengeCard key={c.slug} challenge={c} />
          ))}
        </div>
      )}
    </section>
  );
}
