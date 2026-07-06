import V2Home from "@/tanmatra-v2/Home";

// Render the self-contained v2 experience without the legacy app chrome
// (header / promo banner / bottom nav) — root.tsx reads this handle.
export const handle = { chrome: false };

export default function Home() {
  return <V2Home />;
}
