"use client";

// A plain reload, not a router refresh: service-worker fallback responses
// never change the address bar (respondWith swaps the body, not the URL), so
// location.reload() re-issues the ORIGINAL failed navigation. If the network
// is back, sw.js's network-first handleNavigation() fetches it for real this
// time; if not, the worker just re-serves this same fallback.
export default function OfflineRetryButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="touch-target-min rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-[var(--gold-ink)]"
    >
      Try again
    </button>
  );
}
