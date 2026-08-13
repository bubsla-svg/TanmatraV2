"use client";
import React, { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export function GsapScrollImage({ children, className }: { children: React.ReactNode; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  useGSAP(() => {
    // WCAG 2.3.3 — see ScrubbingText.tsx for the full rationale. This one
    // matters more: the entrance scrubs `scale`, which is exactly the
    // "motion triggered by interaction" the criterion names. Gating both
    // timelines behind no-preference leaves the wrapper at its natural
    // scale: 1 / opacity: 1, so a reduced-motion visitor gets the settled
    // image rather than one frozen at 0.8 scale or 0.2 opacity.
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      if (!wrapperRef.current) return;

      // Start small and grow as it scrolls into view
      gsap.fromTo(wrapperRef.current,
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
          }
        }
      );

      // Fade out as it scrolls out of view
      gsap.to(wrapperRef.current, {
        opacity: 0.2,
        ease: "none",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "bottom 30%",
          end: "bottom top",
          scrub: true,
        }
      });
    });
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className={className}>
      <div ref={wrapperRef} className="w-full h-full">
        {children}
      </div>
    </div>
  );
}
