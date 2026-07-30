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
    <article className="mx-auto max-w-3xl px-4 py-10 md:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Link href="/team" className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink">
        <span aria-hidden>&larr;</span> Our team
      </Link>

      {/* Header: avatar + name + RD badge + title/experience */}
      <header className="mt-8 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full font-mono text-2xl font-bold ${accent}`}>
          {p.initials}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-3xl font-semibold tracking-tight text-ink">{p.name}</h1>
            {p.role === "rd" && (
              <span className="rounded-full bg-gold px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--gold-ink)]">
                RD
              </span>
            )}
          </div>
          <p className="mt-1.5 text-base text-ink-muted">
            {p.title} <span aria-hidden className="text-ink-faint">&middot;</span>{" "}
            <span className="tabular">{p.yearsExperience} yrs</span>
          </p>
        </div>
      </header>

      {/* Signature line: a pull-quote, not a caption — this is the article's voice */}
      {p.signatureLine && (
        <blockquote className="mt-8 max-w-prose text-xl italic leading-snug text-ink">
          &ldquo;{p.signatureLine}&rdquo;
        </blockquote>
      )}

      {/* Bio prose: real article measure and line-height, not card-compressed text */}
      {p.bio && <p className="mt-6 max-w-prose text-base leading-relaxed text-ink-muted">{p.bio}</p>}

      {p.credentials.length > 0 && (
        <section className="mt-12 max-w-prose">
          <h2 className="text-lg font-semibold text-ink">Credentials</h2>
          <ul className="mt-3 flex flex-col gap-2.5">
            {p.credentials.map((c, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-ink-muted">
                <span aria-hidden className="mt-0.5 text-gold-text">✓</span>
                {c}
              </li>
            ))}
          </ul>
        </section>
      )}

      {p.lifestyles.length > 0 && (
        <section className="mt-10 max-w-prose">
          <h2 className="text-lg font-semibold text-ink">Specialises in</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {p.lifestyles.map((l) => (
              <span key={l} className="rounded-full bg-surface-raised px-3 py-1 text-xs text-ink-muted">{l}</span>
            ))}
          </div>
        </section>
      )}

      {dishes.length > 0 && (
        <section className="mt-14">
          <h2 className="border-b border-line pb-4 text-lg font-semibold text-ink">{dishesTitle}</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {dishes.map((d) => (
              <Link
                key={d.slug}
                href={`/dish/${d.slug}`}
                className="group overflow-hidden rounded-2xl border border-line bg-surface transition-transform duration-200 hover:-translate-y-0.5"
              >
                <div className="aspect-square w-full overflow-hidden bg-surface-raised">
                  {/* eslint-disable-next-line @next/next/no-img-element -- unoptimized <img>, see next.config */}
                  <img src={d.image} alt="" className="h-full w-full object-cover transition-opacity group-hover:opacity-90" />
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-medium text-ink">{d.name}</p>
                  <p className="tabular mt-0.5 text-xs text-ink-faint">
                    {d.macros.calories} kcal · {formatPaise(d.price)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
