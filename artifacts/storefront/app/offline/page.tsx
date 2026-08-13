import type { Metadata } from "next";
import { globalCopy } from "@/content/copy/global";
import OfflineRetryButton from "@/components/OfflineRetryButton";

// public/sw.js's OFFLINE_URL fallback. Precached at install time (cache.add
// only stores a 200, so this route existing and returning one is what makes
// the fallback real — see the sw.js file header for the cache strategy).
//
// Chrome-less by design, unlike app/not-found.tsx: Header's search/cart/
// account icons and Footer/MobileBottomNav's links mostly point at routes
// that are NOT precached (see sw.js's PRECACHE_ROUTES), so showing them here
// would offer actions that just bounce back to this same page — the exact
// "affordance failure" this app's own coherence sweep audits for elsewhere.
// One honest action only: retry the page that actually failed.
export const metadata: Metadata = {
  title: globalCopy.offline.title,
};

export default function OfflinePage() {
  return (
    <main id="main">
      <section className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
        <p className="text-2xs font-bold uppercase tracking-widest text-ink-muted">No connection</p>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{globalCopy.offline.title}</h1>
        <p className="text-sm text-ink-muted">{globalCopy.offline.subtitle}</p>
        <div className="mt-2">
          <OfflineRetryButton />
        </div>
      </section>
    </main>
  );
}
