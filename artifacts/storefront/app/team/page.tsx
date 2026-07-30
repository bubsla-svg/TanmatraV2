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
    <div className="mt-14">
      <div className="flex items-center gap-6">
        <h2 className="shrink-0 text-lg font-semibold text-ink">{title}</h2>
        <div className="h-px flex-1 bg-line" />
      </div>
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
      <p className="text-[11px] font-bold uppercase tracking-widest text-gold-text">Community</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Our team</h1>
      <p className="mt-3 max-w-xl text-base leading-relaxed text-ink-muted">
        The chefs and registered dietitians who design, review, and cook every Tanmatra meal.
      </p>
      {rds.length > 0 && <Group title="Registered Dietitians" people={rds} />}
      {chefs.length > 0 && <Group title="Chefs" people={chefs} />}
      {profiles.length === 0 && (
        <p className="mt-10 rounded-2xl border border-dashed border-line bg-surface p-10 text-center text-sm text-ink-muted">
          Team profiles are coming soon.
        </p>
      )}
    </section>
  );
}
