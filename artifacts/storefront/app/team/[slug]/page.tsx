import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTeamProfile } from "@/lib/teamApi";
import { fetchMenu, findDish } from "@/lib/catalog";
import { formatPaise } from "@/lib/format";

type Params = { params: Promise<{ slug: string }> };
export const revalidate = 3600;

const ACCENT: Record<string, string> = {
  gold: "bg-gold text-[var(--gold-ink)]",
  sage: "bg-sage text-sage-foreground",
  blue: "bg-blue text-white",
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await getTeamProfile(slug);
  if (!data) return { title: "Profile not found" };
  return { title: data.profile.name, description: data.profile.title };
}

export default async function TeamMemberPage({ params }: Params) {
  const { slug } = await params;
  const data = await getTeamProfile(slug);
  if (!data) notFound();
  const p = data.profile;
  const accent = ACCENT[p.accent] ?? ACCENT.gold;

  // Resolve owned dish slugs against the live (or fallback) catalog.
  let dishes: NonNullable<ReturnType<typeof findDish>>[] = [];
  if (data.ownedDishSlugs.length > 0) {
    const { dishes: all } = await fetchMenu();
    dishes = data.ownedDishSlugs
      .map((s) => findDish(s, all))
      .filter((d): d is NonNullable<typeof d> => d != null);
  }
  const dishesTitle = p.role === "chef" ? "Dishes from this kitchen" : "Dishes signed off by this RD";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: p.name,
    jobTitle: p.title,
    description: p.bio,
    ...(p.credentials.length ? { hasCredential: p.credentials } : {}),
  };

  return (
    <article className="mx-auto max-w-2xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Link href="/team" className="text-sm text-ink-muted hover:text-ink">
        &larr; Our team
      </Link>
      <div className="mt-4 flex items-center gap-4">
        <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full font-mono text-lg font-bold ${accent}`}>
          {p.initials}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{p.name}</h1>
            {p.role === "rd" && (
              <span className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">RD</span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-ink-muted">
            {p.title} · {p.yearsExperience} yrs
          </p>
        </div>
      </div>

      {p.signatureLine && <p className="mt-5 text-sm italic leading-relaxed text-ink-muted">{p.signatureLine}</p>}
      {p.bio && <p className="mt-4 text-sm leading-relaxed text-ink-muted">{p.bio}</p>}

      {p.credentials.length > 0 && (
        <>
          <h2 className="mt-8 text-base font-semibold text-ink">Credentials</h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            {p.credentials.map((c, i) => (
              <li key={i} className="flex gap-2 text-sm text-ink-muted">
                <span aria-hidden className="text-ink-faint">&bull;</span>
                {c}
              </li>
            ))}
          </ul>
        </>
      )}

      {p.lifestyles.length > 0 && (
        <>
          <h2 className="mt-8 text-base font-semibold text-ink">Specialises in</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {p.lifestyles.map((l) => (
              <span key={l} className="rounded bg-surface-raised px-2 py-0.5 text-xs text-ink-muted">{l}</span>
            ))}
          </div>
        </>
      )}

      {dishes.length > 0 && (
        <>
          <h2 className="mt-8 text-base font-semibold text-ink">{dishesTitle}</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {dishes.map((d) => (
              <Link key={d.slug} href={`/dish/${d.slug}`} className="overflow-hidden rounded-lg border border-line bg-surface">
                <div className="aspect-square w-full bg-surface-raised">
                  {/* eslint-disable-next-line @next/next/no-img-element -- unoptimized <img>, see next.config */}
                  <img src={d.image} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="p-2">
                  <p className="truncate text-xs font-medium text-ink">{d.name}</p>
                  <p className="tabular text-[11px] text-ink-faint">
                    {d.macros.calories} kcal · {formatPaise(d.price)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </article>
  );
}
