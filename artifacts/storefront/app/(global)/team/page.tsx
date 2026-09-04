import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TEAM",
};

export default function PlaceholderPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-6 text-ink">
      <div className="text-center">
        <div className="mb-4 text-[11px] font-bold uppercase tracking-[.18em] text-accent">
          Global Layout
        </div>
        <h1 className="font-display text-3xl font-semibold leading-[1.05] tracking-[-.02em] text-primary">/team</h1>
        <p className="mt-3 text-base leading-7 text-ink-muted">Clean slate placeholder pending implementation.</p>
      </div>
    </div>
  );
}
