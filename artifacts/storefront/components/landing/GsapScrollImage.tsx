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

  }, { scope: containerRef });

  return (
    <div ref={containerRef} className={className}>
      <div ref={wrapperRef} className="w-full h-full">
        {children}
      </div>
    </div>
  );
}
