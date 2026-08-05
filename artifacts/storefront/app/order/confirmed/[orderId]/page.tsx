import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "[ORDERID] | Tanmatra",
};

export default function PlaceholderPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-surface-canvas text-ink-primary">
      <div className="text-center">
        <div className="font-label-caps text-[10px] text-primary uppercase tracking-widest mb-4">
          Focus Layout
        </div>
        <h1 className="font-headline-md text-2xl mb-2">/order/confirmed/[orderId]</h1>
        <p className="text-sm text-ink-secondary">Clean slate placeholder pending implementation.</p>
      </div>
    </div>
  );
}
