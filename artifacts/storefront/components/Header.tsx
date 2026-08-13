import Link from "next/link";
import { TopNav } from "@astryxdesign/core/TopNav";
import { PRIMARY_NAV } from "@/lib/nav";
import { CommandMenu } from "@/components/CommandMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DeliveryAddressBar } from "@/components/onboarding/DeliveryAddressBar";

/**
 * Global chrome shell. Server component itself; it hosts one small client island
 * (CommandMenu, the ⌘K search). The primary links come from the central nav
 * config (lib/nav.ts) so route-parity waves extend the IA by editing data, not
 * this file. Primary links are desktop-only — on mobile the BottomNav carries them.
 *
 * Renders only from app/(global)/layout.tsx. Focus routes (app/(focus)/ —
 * auth, checkout, onboarding, dish PDP) never mount this header at all, so
 * the old FocusChromeGate that stripped the interactive cluster down to the
 * brand link on those routes is gone: the double-state collisions it guarded
 * against (chrome location picker over /checkout's own address flow, ⌘K over
 * a page's own search) are now impossible by construction — those pages live
 * in a group whose layout renders no header.
 */
export function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] backdrop-blur">
      <div className="mx-auto max-w-5xl">
        <TopNav
          label="Primary navigation"
          heading={
            <Link
              href="/"
              // Astryx's TopNav wraps `heading` in a flexShrink:0 box — same
              // constraint the ServiceabilityBar comment below describes for
              // endContent, but heading had no cap at all, so at narrow
              // widths (w=360) this text overflowed its own shrunk container
              // and visually painted over the endContent cluster instead of
              // shrinking. inline-block + a max-width gives it a bounded
              // content size the flex algorithm can actually respect; the cap
              // is well above "Tanmatra"'s natural width so nothing visibly
              // truncates today, it only clips in a future longer-brand case.
              className="inline-block max-w-[7.5rem] overflow-hidden text-ellipsis whitespace-nowrap align-middle text-lg font-semibold tracking-tight text-ink sm:max-w-none"
              aria-label="Tanmatra home"
            >
              Tanmatra
            </Link>
          }
          endContent={
            <nav aria-label="Primary" className="flex items-center gap-2">
              <div className="min-w-0">
                <DeliveryAddressBar />
              </div>
              <div className="hidden md:flex items-center gap-2 border-l border-line pl-3 ml-1">
                <div className="flex items-center gap-1.5 rounded-full border border-[var(--sage)]/20 bg-sage-soft/30 px-2 py-1 shadow-sm">
                  <svg className="w-3.5 h-3.5 text-sage-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-3xs font-bold uppercase tracking-wide text-sage-text">RD-Reviewed</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <CommandMenu />
                {/* D-09: ThemeToggle was imported here and never rendered —
                    ServiceabilityBar's own width-budget comment already
                    accounted for it ("heading + this + ⌘K + ThemeToggle"
                    at 44px), it just never actually landed in the tree. */}
                <ThemeToggle />
                <Link
                  href="/account"
                  aria-label="Account"
                  // Desktop-only, matching this file's own header comment
                  // ("Primary links are desktop-only — on mobile the
                  // BottomNav carries them") — MobileBottomNav.tsx already
                  // renders its own "Account" tab. Giving this link a real
                  // accessible name (above) is what surfaced the gap:
                  // single-chrome.spec.ts counts visible "Account" nav
                  // affordances per viewport and expects exactly one, and
                  // this link had no responsive class at all, so once it
                  // became name-able it counted as a second one on mobile
                  // alongside MobileBottomNav's.
                  className="hidden md:flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-surface hover:bg-surface-raised transition-colors overflow-hidden"
                >
                  <svg aria-hidden className="w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </Link>
              </div>
            </nav>
          }
        />
      </div>
    </header>
  );
}

