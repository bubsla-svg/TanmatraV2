import Link from "next/link";
import { TopNav } from "@astryxdesign/core/TopNav";
import { PRIMARY_NAV } from "@/lib/nav";
import { CommandMenu } from "@/components/CommandMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DeliveryAddressBar } from "@/components/onboarding/DeliveryAddressBar";
import { FocusChromeGate } from "@/components/FocusLayout";

/**
 * Global chrome shell. Server component itself; it hosts one small client island
 * (CommandMenu, the ⌘K search). The primary links come from the central nav
 * config (lib/nav.ts) so route-parity waves extend the IA by editing data, not
 * this file. Primary links are desktop-only — on mobile the BottomNav carries them.
 *
 * FOCUS SHELL: on focus routes (lib/focusRoutes.ts — auth, checkout,
 * onboarding, dish PDP) the entire interactive endContent cluster is
 * suppressed and only the brand link survives. The location picker is the
 * canonical reason: /checkout carries its OWN address flow
 * (CheckoutAddress → LocationPickerFlow), and a second location state in the
 * chrome directly above it is a double-state collision — two widgets both
 * claiming to know the delivery address, each hydrated from a different
 * store. Same class of bug for ⌘K over any page with its own search input.
 * The brand link stays: a focus shell still needs one calm exit, and a plain
 * link home cannot collide with any page state.
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
            <FocusChromeGate>
            <nav aria-label="Primary" className="flex items-center gap-2">
              <div className="min-w-0">
                <DeliveryAddressBar />
              </div>
              
              <div className="hidden md:flex items-center gap-2 border-l border-line pl-3 ml-1">
                <div className="flex items-center gap-1.5 rounded-full border border-sage-strong/20 bg-sage-soft/30 px-2 py-1 shadow-sm">
                  <svg className="w-3.5 h-3.5 text-sage-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-sage-text">RD-Reviewed</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <CommandMenu />
                <Link href="/account" className="flex items-center justify-center w-8 h-8 rounded-full border border-line bg-surface hover:bg-surface-raised transition-colors overflow-hidden">
                  <svg className="w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </Link>
              </div>
            </nav>
            </FocusChromeGate>
          }
        />
      </div>
    </header>
  );
}

