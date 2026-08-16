import type { Metadata } from "next";
import { FocusHeader } from "@/components/FocusHeader";

export const metadata: Metadata = {
  title: "[ID]",
};

export default function PlaceholderPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-bg text-ink">
      <FocusHeader backLabel="Back" />
      <div className="text-center">
        <div className="font-bold text-3xs text-primary uppercase tracking-widest mb-4">
          Focus Layout
        </div>
        <h1 className="font-bold text-2xl mb-2">/office-lunch/[id]</h1>
        <p className="text-sm text-ink-muted">Clean slate placeholder pending implementation.</p>
      </div>
    </div>
  );
}
