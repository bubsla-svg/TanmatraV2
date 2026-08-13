import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TEAM",
};

export default function PlaceholderPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-bg text-ink">
      <div className="text-center">
        <div className="font-bold text-3xs text-primary uppercase tracking-widest mb-4">
          Global Layout
        </div>
        <h1 className="font-bold text-2xl mb-2">/team</h1>
        <p className="text-sm text-ink-muted">Clean slate placeholder pending implementation.</p>
      </div>
    </div>
  );
}
