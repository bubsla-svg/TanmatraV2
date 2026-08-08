"use client";
// Group-level recovery boundary: renders inside THIS group's layout, so the
// shell the visitor was in stays up while only the failing segment's content
// is replaced. The UI lives in components/SegmentError.tsx — one
// implementation, three mounts.
export { default } from "@/components/SegmentError";
