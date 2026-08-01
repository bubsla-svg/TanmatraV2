"use client";

import { useEffect } from "react";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;

/**
 * Analytics init only — no posthog-js/react context Provider, because nothing
 * in this app calls usePostHog(). The posthog-js import is dynamic and gated
 * on the env vars so the SDK is never fetched by a browser that will never
 * send an event — today's production build has neither var set, and the
 * previous unconditional top-level import shipped the full SDK anyway.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!POSTHOG_KEY || !POSTHOG_HOST) return;
    let cancelled = false;
    import("posthog-js").then(({ default: posthog }) => {
      if (cancelled) return;
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        person_profiles: "identified_only",
        capture_pageview: false, // manual capture below, right after init
      });
      posthog.capture("$pageview");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <>{children}</>;
}
