import type { Metadata } from "next";
import { getTeamProfiles, type TeamProfile } from "@/lib/teamApi";
import { TeamCard } from "@/components/team/TeamCard";

export const metadata: Metadata = {
  title: "Our team",
  description:
    "Meet the chefs and registered dietitians behind Tanmatra — the people who design, review, and cook your clinical-grade meals.",
};

export const revalidate = 3600;

function Group({ title, people }: { title: string; people: TeamProfile[] }) {
  return (
    <div className="mt-10">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{title}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {people.map((p) => (
          <TeamCard key={p.slug} profile={p} />
        ))}
      </div>
    </div>
  );
}

/** Team roster (Community). Server-fetched; grouped by role. */
export default async function TeamPage() {
  const profiles = await getTeamProfiles();
  const rds = profiles.filter((p) => p.role === "rd");
  const chefs = profiles.filter((p) => p.role === "chef");
  return (
    <section className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">Community</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Our team</h1>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
        The chefs and registered dietitians who design, review, and cook every Tanmatra meal.
      </p>
      {rds.length > 0 && <Group title="Registered Dietitians" people={rds} />}
      {chefs.length > 0 && <Group title="Chefs" people={chefs} />}
      {profiles.length === 0 && (
        <p className="mt-10 text-sm text-ink-muted">Team profiles are coming soon.</p>
      )}
    </section>
  );
}
