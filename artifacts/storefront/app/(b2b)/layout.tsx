import Link from "next/link";
import { SITE } from "@/lib/nav";

/**
 * B2BLayout — the enterprise/partner acquisition shell (P0 §9): /corporate,
 * /corporate-wellness, /partners/*, /rd-partners.
 *
 * Tanmatra-led branding with a compact B2B header and no consumer chrome —
 * no four-tab MobileBottomNav, no MiniCartBar, no consumer Header. Before
 * route groups these routes had their chrome subtracted by B2BChromeGate
 * with NOTHING rendered in its place, so a visitor landing on /corporate had
 * no on-page way to navigate anywhere (docs/architecture/layout-contracts.md
 * §5.1). This shell closes that defect: brand exit home, one cross-link
 * between the corporate and partner families, and the storefront entry.
 */
export default function B2BLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-line bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] backdrop-blur">
        <div className="mx-auto flex min-h-14 max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2">
          <Link
            href="/"
            aria-label="Tanmatra home"
            className="shrink-0 whitespace-nowrap text-lg font-semibold tracking-tight text-ink"
          >
            {SITE.brand}
            <span className="ml-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
              For business
            </span>
          </Link>
          <nav aria-label="Business" className="ml-auto flex min-w-0 items-center gap-3 text-sm">
            <Link href="/corporate-wellness" className="inline-flex min-h-11 items-center px-1 text-ink-muted hover:text-ink">
              Corporate
            </Link>
            <Link href="/rd-partners" className="inline-flex min-h-11 items-center px-1 text-ink-muted hover:text-ink">
              Partners
            </Link>
            <Link
              href="/menu"
              className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full border border-line px-3 py-1.5 font-medium text-ink hover:bg-secondary"
            >
              Explore meals
            </Link>
          </nav>
        </div>
      </header>
      <main id="main" className="pb-[env(safe-area-inset-bottom)]">
        {children}
      </main>
    </>
  );
}
