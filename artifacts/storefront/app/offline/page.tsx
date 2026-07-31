import type { Metadata } from "next";
import Link from "next/link";
import { globalCopy } from "@/content/copy/global";

export const metadata: Metadata = {
  title: "You're offline",
  robots: { index: false },
};

// Precached by public/sw.js and reachable without a network. Only routes that
// carry no price, no stock and no session state belong here — the worker
// precaches exactly this set, and the money path is never cached at all.
const READABLE_OFFLINE = [
  { href: "/about", label: "About Tanmatra" },
  { href: "/faq", label: "Frequently asked questions" },
  { href: "/legal", label: "Legal & policies" },
];

/**
 * Offline fallback. The service worker serves this for any navigation that
 * fails with no network — except /checkout, /account/* and /api/*, which it
 * never intercepts, so a cached shell can never stand in for a live price or a
 * live session.
 *
 * A real route rather than a standalone public/offline.html: it inherits the
 * token bridge, the fonts and the site chrome, so it cannot drift from the rest
 * of the app the way a hand-styled static document would, and it is reachable
 * at /offline for review and e2e. sw.js precaches the stylesheet and font files
 * this document references, so it still paints correctly with no network.
 *
 * Everything here works unhydrated: offline the JS chunks never load, so this
 * page is plain links and no handlers by design.
 */
export default function OfflinePage() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-16 md:py-24">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--warning)]">
        No connection
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
        You&rsquo;re offline
      </h1>
      <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-muted">
        {globalCopy.offline.banner} Ordering, payment and your account need a
        live connection — nothing is charged or confirmed from a cached page, so
        those screens wait for the network rather than showing you a stale one.
      </p>

      <div className="mt-8 rounded-[var(--radius-lg)] border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold text-ink">Readable without a connection</h2>
        <ul className="mt-3 space-y-2">
          {READABLE_OFFLINE.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="text-sm font-medium text-gold-text underline underline-offset-4"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-8 text-sm text-ink-muted">
        Back on Wi-Fi or mobile data?{" "}
        <Link href="/" className="font-semibold text-gold-text underline underline-offset-4">
          {globalCopy.buttons.retry}
        </Link>
      </p>
    </section>
  );
}
