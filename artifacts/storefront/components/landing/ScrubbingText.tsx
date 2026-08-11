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
