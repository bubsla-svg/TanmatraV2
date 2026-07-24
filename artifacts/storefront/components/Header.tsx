import Link from "next/link";
import { PRIMARY_NAV } from "@/lib/nav";
import { CommandMenu } from "@/components/CommandMenu";

/**
 * Global chrome shell. Server component itself; it hosts one small client island
 * (CommandMenu, the ⌘K search). The primary links come from the central nav
 * config (lib/nav.ts) so route-parity waves extend the IA by editing data, not
 * this file. Primary links are desktop-only — on mobile the BottomNav carries them.
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
          <CommandMenu />
          <div className="hidden items-center gap-1 md:flex">
            {PRIMARY_NAV.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </header>
  );
}
