import Link from "next/link";

/**
 * Global chrome shell. Server component — it holds no state and needs no
 * interactivity, so it ships zero client JS. Browse (Menu / Plans) plus the
 * Account area (saved addresses; SF-04) — the session gate lives on the page.
 */
export function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-ink"
          aria-label="Tanmatra home"
        >
          Tanmatra
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1">
          <Link
            href="/menu"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            Menu
          </Link>
          <Link
            href="/plans"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            Plans
          </Link>
          <Link
            href="/account/subscriptions"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            Account
          </Link>
        </nav>
      </div>
    </header>
  );
}
