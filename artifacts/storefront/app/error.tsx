"use client";
// Root recovery boundary. Page/segment errors are caught by the NEARER
// (global)/(focus)/(b2b) error.tsx boundaries; this one only fires when a
// route-group layout itself throws — so it renders bare, inside the root
// layout, with no shell chrome to lean on. Unlike the group boundaries
// (which mount inside their layout's <main id="main">), nothing above this
// one renders a main landmark, so it must bring its own — the root layout's
// skip link (href="#main") is rendered unconditionally and would otherwise
// be a dead anchor here. app/global-error.tsx remains the last resort for
// the root layout itself throwing.
import SegmentError from "@/components/SegmentError";

export default function RootError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main">
      <SegmentError {...props} />
    </main>
  );
}
