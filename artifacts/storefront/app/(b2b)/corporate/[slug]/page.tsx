import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "[SLUG]",
};

export default function PlaceholderPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-bg text-ink">
      <div className="text-center">
        <div className="font-bold text-2xs text-primary uppercase tracking-widest mb-4">
          B2B Layout
        </div>
        <h1 className="font-display font-bold text-2xl mb-2 text-primary">/corporate/[slug]</h1>
        <p className="text-sm text-ink-muted">Clean slate placeholder pending implementation.</p>
      </div>
    </div>
  );
}
