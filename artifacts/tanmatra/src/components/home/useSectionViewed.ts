import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";

/**
 * Scroll-depth instrumentation for the homepage scroll architecture
 * (playbook §1.1 S0–S13, event dictionary Part 8): fires a single
 * `section_viewed` event per section per mount, the first time the attached
 * element becomes meaningfully visible (40% in view).
 *
 * Attach the returned ref to the section's root element. Sections that
 * render nothing (e.g. social proof with no reviews) never attach the ref,
 * so they correctly never emit.
 */
export function useSectionViewed<T extends HTMLElement = HTMLElement>(
  section: string,
) {
  const ref = useRef<T | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    // Re-arm only if the section identity itself changes (it normally never
    // does within a mount — this preserves the once-per-mount contract).
    firedRef.current = false;
    const node = ref.current;
    if (!node) return;
    // SSR prerender / very old browsers: skip silently rather than guess.
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !firedRef.current) {
            firedRef.current = true;
            track("section_viewed", { section });
            observer.disconnect();
          }
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [section]);

  return ref;
}
