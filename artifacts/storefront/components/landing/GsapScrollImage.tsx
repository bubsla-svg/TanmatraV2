"use client";
// GSAP is loaded LAZILY, in an effect, and never as a static import.
//
// This component wraps the hero image on `/` — the LCP element. A static
// `import gsap` put gsap + ScrollTrigger + @gsap/react into the entry chunk
// the browser must parse before it can hydrate anything, all to run a
// decorative scrub. The image itself is server-rendered children and needs
// none of it, so the paint no longer waits on the library: the wrapper renders
// at its settled scale/opacity and the animation attaches whenever the code
// lands. It also makes the reduced-motion branch free — it downloads nothing.
import React, { useEffect, useRef } from "react";

export function GsapScrollImage({ children, className }: { children: React.ReactNode; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // WCAG 2.3.3 (Animation from Interactions). The entrance scrubs `scale`,
    // which is exactly the "motion triggered by interaction" the criterion
    // names. Bailing out before the import leaves the wrapper at its natural
    // scale: 1 / opacity: 1, so a reduced-motion visitor gets the settled
    // image rather than one frozen at 0.8 scale or 0.2 opacity.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let ctx: { revert: () => void } | undefined;
    let cancelled = false;

    void (async () => {
      const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled || !wrapperRef.current) return;
      gsap.registerPlugin(ScrollTrigger);

      // A context scoped to the container does what useGSAP's `scope` did:
      // every tween and ScrollTrigger created inside reverts together.
      ctx = gsap.context(() => {
        // Start small and grow as it scrolls into view.
        gsap.fromTo(
          wrapperRef.current,
          { scale: 0.8, opacity: 0.5 },
          {
            scale: 1,
            opacity: 1,
            ease: "power2.out",
            scrollTrigger: {
              trigger: containerRef.current,
              start: "top 95%",
              end: "top 50%",
              scrub: 1,
            },
          },
        );

        // Fade out as it scrolls out of view.
        gsap.to(wrapperRef.current, {
          opacity: 0.2,
          ease: "none",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "bottom 30%",
            end: "bottom top",
            scrub: true,
          },
        });
      }, containerRef);
    })();

    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, []);

  return (
    <div ref={containerRef} className={className}>
      <div ref={wrapperRef} className="w-full h-full">
        {children}
      </div>
    </div>
  );
}
