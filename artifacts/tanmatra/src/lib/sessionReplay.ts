/**
 * Session Replay, Error Linking & Rage-Click Detector Engine
 * 
 * Step 1: Session Replay Capture (Records clicks, scrolls, DOM mutations, errors).
 * Step 2: Error Event Linking (Attaches session replay trace to error payloads).
 * Step 3: Rage-Click Detection (Flags >= 5 rapid clicks within 3 seconds as UX failure).
 */

export interface SessionReplayEvent {
  type: "click" | "scroll" | "input" | "error" | "rage_click";
  targetSelector?: string;
  targetText?: string;
  path?: string;
  errorStack?: string;
  timestamp: number;
}

export interface LinkedErrorPayload {
  errorName: string;
  errorMessage: string;
  stackTrace?: string;
  url: string;
  timestamp: string;
  sessionReplayTrace: SessionReplayEvent[];
}

const MAX_REPLAY_EVENTS = 100;
const replayEventBuffer: SessionReplayEvent[] = [];

// Step 1: Record user session interaction events
export function recordSessionEvent(event: Omit<SessionReplayEvent, "timestamp">): SessionReplayEvent {
  const fullEvent: SessionReplayEvent = {
    ...event,
    timestamp: Date.now(),
  };

  replayEventBuffer.push(fullEvent);
  if (replayEventBuffer.length > MAX_REPLAY_EVENTS) {
    replayEventBuffer.shift(); // Maintain rolling window
  }

  return fullEvent;
}

export function getSessionReplayBuffer(): SessionReplayEvent[] {
  return [...replayEventBuffer];
}

export function clearSessionReplayBufferForTesting(): void {
  replayEventBuffer.length = 0;
}

// Step 3: Rage-Click Detector State
const clickTrackerWindow: { selector: string; timestamps: number[] }[] = [];

export function trackClickForRageDetection(
  targetSelector: string,
  targetText?: string
): { isRageClick: boolean; event?: SessionReplayEvent } {
  const now = Date.now();
  const RAGE_TIME_WINDOW_MS = 3000; // 3 seconds
  const RAGE_CLICK_THRESHOLD = 5; // 5 clicks

  let tracker = clickTrackerWindow.find((t) => t.selector === targetSelector);
  if (!tracker) {
    tracker = { selector: targetSelector, timestamps: [] };
    clickTrackerWindow.push(tracker);
  }

  // Filter out timestamps older than 3 seconds
  tracker.timestamps = tracker.timestamps.filter((t) => now - t <= RAGE_TIME_WINDOW_MS);
  tracker.timestamps.push(now);

  // Record normal click event in replay buffer
  recordSessionEvent({
    type: "click",
    targetSelector,
    targetText,
  });

  if (tracker.timestamps.length >= RAGE_CLICK_THRESHOLD) {
    // Clear timestamps to prevent repeated alerts for the same burst
    tracker.timestamps = [];

    const rageEvent = recordSessionEvent({
      type: "rage_click",
      targetSelector,
      targetText: `Rage click detected on '${targetText ?? targetSelector}' (${RAGE_CLICK_THRESHOLD}+ clicks in <3s)`,
    });

    return { isRageClick: true, event: rageEvent };
  }

  return { isRageClick: false };
}

// Step 2: Link Session Replay Trace to Sentry / Error Reporting Engine
export async function reportLinkedError(
  err: Error | string,
  extraContext?: Record<string, unknown>
): Promise<LinkedErrorPayload> {
  const errorMessage = typeof err === "string" ? err : err.message;
  const stackTrace = typeof err === "string" ? undefined : err.stack;

  // Record error event inside replay buffer
  recordSessionEvent({
    type: "error",
    errorStack: stackTrace ?? errorMessage,
  });

  const payload: LinkedErrorPayload = {
    errorName: typeof err === "string" ? "UnhandledError" : err.name,
    errorMessage,
    stackTrace,
    url: typeof window !== "undefined" ? window.location.href : "server",
    timestamp: new Date().toISOString(),
    sessionReplayTrace: getSessionReplayBuffer(),
  };

  try {
    if (typeof window !== "undefined") {
      await fetch("/api/v1/error-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
  } catch (fetchErr) {
    console.warn("Failed to dispatch linked error report to server", fetchErr);
  }

  return payload;
}
