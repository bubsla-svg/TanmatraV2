"use client";
// Root recovery boundary. Page/segment errors are caught by the NEARER
// (global)/(focus)/(b2b) error.tsx boundaries; this one only fires when a
// route-group layout itself throws — so it renders bare, inside the root
// layout, with no shell chrome to lean on. app/global-error.tsx remains the
// last resort for the root layout itself throwing.
export { default } from "@/components/SegmentError";
