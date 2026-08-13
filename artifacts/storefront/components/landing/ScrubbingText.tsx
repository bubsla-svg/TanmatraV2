"use client";
import React, { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export function ScrubbingText({ text, className }: { text: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useGSAP(() => {
    // WCAG 2.3.3. The blanket @media block in app/globals.css collapses CSS
    // transitions/animations only — it cannot reach a GSAP timeline, which
    // drives inline styles from JS. gsap.matchMedia() is the equivalent: the
    // callback runs only while the query matches, and GSAP reverts every
    // property it set (here the scrub-word opacity) if it stops matching.
    // Skipping the fromTo leaves the words at their natural opacity: 1, so the
    // reduced-motion fallback is the fully-readable end state, not the 0.1
    // start state.
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const words = gsap.utils.toArray<HTMLElement>('.scrub-word');
      if (!words.length) return;

      gsap.fromTo(words,
        { opacity: 0.1 },
        {
          opacity: 1,
          stagger: 0.1,
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 80%",
            end: "bottom 50%",
            scrub: true,
          }
        }
      );
    });
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className={className}>
      {text.split(' ').map((word, i) => (
        <span key={i} className="scrub-word inline-block mr-[0.25em]">
          {word}
        </span>
      ))}
    </div>
  );
}
