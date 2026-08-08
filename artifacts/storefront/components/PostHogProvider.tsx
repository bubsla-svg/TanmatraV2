"use client";

import { useEffect } from "react";
import { capturePostHogEvent } from "@/lib/analyticsSanitizer";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;

/**
 * Analytics init only — no posthog-js/react context Provider, because nothing
 * in this app calls usePostHog(). The posthog-js import is dynamic and gated
 * on the env vars so the SDK is never fetched by a browser that will never
 * send an event — today's production build has neither var set, and the
 * previous unconditional top-level import shipped the full SDK anyway.
 *
 * autocapture and session recording are both explicitly OFF (P0 §24 —
 * privacy-analytics-contract.md §3 flagged both as an undecided posture).
 * This is a clinical app: DOM autocapture and session replay can surface a
 * form field's text or an interacted element's attributes verbatim, and
 * ANALYTICS_KEY_ALLOWLIST below has no visibility into either — it can only
 * filter properties this app explicitly sends. Every event this app DOES
 * send goes through capturePostHogEvent, never posthog.capture directly, so
 * a clinical field can't slip through unreviewed.
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
        autocapture: false,
        disable_session_recording: true,
      });
      capturePostHogEvent(
        (event, properties) => posthog.capture(event, properties),
        "$pageview",
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <>{children}</>;
}
