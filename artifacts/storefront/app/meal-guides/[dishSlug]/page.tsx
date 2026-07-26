import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchMenu, findDish } from "@/lib/catalog";
import { ThermalInstructions } from "@/components/guides/ThermalInstructions";
import { SourcingTransparency } from "@/components/guides/SourcingTransparency";

type Params = { params: Promise<{ dishSlug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { dishSlug } = await params;
  const { dishes } = await fetchMenu();
  const dish = findDish(dishSlug, dishes);
  if (!dish) return { title: "Meal Guide Not Found | Tanmatra" };
  return {
    title: `${dish.name} - Prep & Reheating Guide | Tanmatra`,
    description: `Storage instructions, reheating sequence, and ingredient sourcing origin for ${dish.name}.`,
  };
}

export default async function MealGuidePage({ params }: Params) {
  const { dishSlug } = await params;
  const { dishes } = await fetchMenu();
  const dish = findDish(dishSlug, dishes);
  if (!dish) notFound();

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link href={`/dish/${dish.slug}`} className="text-xs font-semibold uppercase tracking-wider text-gold-text hover:underline">
          &larr; Back to {dish.name} Details
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          {dish.name} &mdash; Culinary Guide
        </h1>
        <p className="text-sm leading-relaxed text-ink-muted">
          Follow our exact registered dietitian and chef instructions to maximize warm thermal flavor while preserving bioavailable enzymes.
        </p>
      </div>

      <ThermalInstructions dish={dish} />
      <SourcingTransparency dish={dish} />

      <div className="rounded-2xl border border-line bg-surface p-5 text-center flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-ink">Have questions regarding ingredient preparation?</h3>
        <p className="text-xs text-ink-muted leading-relaxed">
          Our on-call Registered Dietitians answer clinical nutrition inquiries Monday through Friday.
        </p>
        <Link href="/rd" className="mt-2 inline-block text-xs font-semibold text-gold-text uppercase tracking-wider hover:underline">
          Consult Advisory Team &rarr;
        </Link>
      </div>
    </section>
  );
}
