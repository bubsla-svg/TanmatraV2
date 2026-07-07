import V2Refunds from "@/tanmatra-v2/Refunds";

// Render the self-contained v2 experience without the legacy app chrome
// (header / promo banner / bottom nav) — root.tsx reads this handle.
export const handle = { chrome: false };

export default function Refunds() {
  return <V2Refunds />;
}
