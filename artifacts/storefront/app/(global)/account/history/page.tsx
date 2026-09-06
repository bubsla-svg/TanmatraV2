import type { Metadata } from "next";
import { AccountNav } from "@/components/account/AccountNav";
import { MealHistoryDashboard } from "@/components/history/MealHistoryDashboard";

export const metadata: Metadata = {
  title: "Meal History & Macro Dashboard",
  description: "See what you have eaten from Tanmatra, and how it added up against your daily targets.",
};

export default function MealHistoryPage() {
  return (
    <section
      data-ui-generation="stitch-74"
      data-screen-id="10.6"
      data-screen-state="default"
      className="mx-auto max-w-5xl px-4 py-12 flex flex-col gap-8"
    >
      <AccountNav active="history" />
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[.18em] text-accent">
          Your meals so far
        </span>
        <h1 className="font-display text-3xl font-semibold leading-[1.05] tracking-[-.02em] text-primary">
          Meal History Dashboard
        </h1>
        <p className="text-sm leading-relaxed text-ink-muted max-w-2xl">
          Every meal you have had from us, with the day's calories and protein totalled up and set against the targets you set.
        </p>
      </div>

      <MealHistoryDashboard />
    </section>
  );
}
