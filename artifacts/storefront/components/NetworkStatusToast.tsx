"use client";

import { useEffect, useState } from "react";
import { globalCopy } from "@/content/copy/global";

type NetworkState = "online" | "offline" | "recovered";

const RECOVERED_MS = 2500;

/**
 * App-wide network-status indicator. A dropped connection has to read as a
 * dropped connection: the service worker deliberately does NOT serve a cached
 * response for /checkout, /account/* or /api/*, so offline those surfaces fail
 * rather than showing a stale price or a stale session. This is what tells the
 * user why, instead of leaving them with an opaque fetch error or a spinner
 * that never resolves.
 *
 * Floats over the sticky header rather than displacing it: the bottom edge is
 * already occupied by the mini-cart bar and the mobile nav, and an offline
 * state that pushes the whole page down would reflow whatever the user was
 * mid-way through reading.
 */
export function NetworkStatusToast() {
  const [state, setState] = useState<NetworkState>("online");

  useEffect(() => {
    const goOffline = () => setState("offline");
    const goOnline = () =>
      setState((previous) => (previous === "offline" ? "recovered" : "online"));

    // navigator.onLine is only meaningful after mount — the server has no view
    // of it, so the first render is always the neutral "online" state.
    if (!navigator.onLine) goOffline();
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  useEffect(() => {
    if (state !== "recovered") return;
    const timer = setTimeout(() => setState("online"), RECOVERED_MS);
    return () => clearTimeout(timer);
  }, [state]);

  if (state === "online") return null;

  const offline = state === "offline";
  const signal = offline ? "var(--warning)" : "var(--success)";

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[var(--z-modal)] flex justify-center px-4"
    >
      <p
        className="flex max-w-full items-center gap-2 rounded-[var(--radius-full)] border bg-surface px-4 py-2 text-sm text-ink shadow-[var(--shadow-raised)]"
        style={{ borderColor: signal }}
      >
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-[var(--radius-full)]"
          style={{ backgroundColor: signal }}
        />
        {offline ? globalCopy.offline.banner : "Back online."}
      </p>
    </div>
  );
}
