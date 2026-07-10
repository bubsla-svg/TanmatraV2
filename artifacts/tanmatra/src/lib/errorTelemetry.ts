/**
 * Client error telemetry — beacons uncaught errors into the funnel_events
 * table so production failures surface in data instead of waiting for a
 * customer to describe them. Wired once from root.tsx.
 *
 * Privacy: only error message/stack-head, path, and UA reach the server —
 * never form contents or user data. Rate-limited client-side so an error
 * loop can't flood the API.
 */
import { API_BASE } from "./apiBase";

let sent = 0;
const MAX_PER_SESSION = 10;
const seen = new Set<string>();

function report(kind: string, message: string, extra?: Record<string, unknown>): void {
  try {
    if (sent >= MAX_PER_SESSION) return;
    const key = `${kind}:${message.slice(0, 120)}`;
    if (seen.has(key)) return;
    seen.add(key);
    sent += 1;
    void fetch(`${API_BASE}/events`, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "client_error",
        props: {
          kind,
          message: message.slice(0, 240),
          path: location.pathname,
          ua: navigator.userAgent.slice(0, 120),
          ...extra,
        },
        ts: Date.now(),
      }),
    }).catch(() => undefined);
  } catch {
    // telemetry must never throw
  }
}

export function installErrorTelemetry(): void {
  if (typeof window === "undefined") return;
  const w = window as Window & { __tanmatraErrTelemetry?: boolean };
  if (w.__tanmatraErrTelemetry) return;
  w.__tanmatraErrTelemetry = true;

  window.addEventListener("error", (e) => {
    report("error", e.message || String(e.error ?? "unknown"), {
      source: e.filename ? `${e.filename.split("/").pop()}:${e.lineno}` : undefined,
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    report("unhandledrejection", r instanceof Error ? r.message : String(r).slice(0, 240), {
      stackHead: r instanceof Error && r.stack ? r.stack.split("\n").slice(0, 2).join(" | ").slice(0, 200) : undefined,
    });
  });
}
