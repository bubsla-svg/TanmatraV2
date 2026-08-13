import type { Metadata } from "next";
import { getChallengesOrReason } from "@/lib/challengesApi";
import { ChallengeCard } from "@/components/challenges/ChallengeCard";

export const metadata: Metadata = {
  title: "Challenges",
  description:
    "RD-led community challenges with a cohort, scheduled check-ins, and a shared feed. Join one and stay accountable.",
};

export const revalidate = 3600;

/** Challenges list (Community). Server-fetched grid. Uses getChallengesOrReason
 *  rather than the collapsing getChallenges — an API outage must render as
 *  "briefly unavailable," not "No active challenges right now," which is an
 *  active lie about the outage and (with revalidate below) could sit cached
 *  for up to an hour. */
export default async function ChallengesPage() {
  const lookup = await getChallengesOrReason();
  const challenges = lookup.ok ? lookup.challenges : [];
  return (
    <section
      data-ui-generation="stitch-74"
      data-screen-id="13.1"
      data-screen-state="default"
      className="mx-auto max-w-5xl px-4 py-10"
    >
      <p className="text-2xs font-bold uppercase tracking-widest text-gold-text">Community</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Challenges</h1>
      <p className="mt-3 max-w-xl text-base leading-relaxed text-ink-muted">
        RD-led programmes with a cohort, scheduled check-ins, and a shared feed. Join one and stay
        accountable.
      </p>
      {!lookup.ok ? (
        <p className="mt-10 rounded-2xl border border-dashed border-line bg-surface p-10 text-center text-sm text-ink-muted">
          Challenges are briefly unavailable — please check back shortly.
        </p>
      ) : challenges.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed border-line bg-surface p-10 text-center text-sm text-ink-muted">
          No active challenges right now — check back soon.
        </p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {challenges.map((c) => (
            <ChallengeCard key={c.slug} challenge={c} />
          ))}
        </div>
      )}
    </section>
  );
}
