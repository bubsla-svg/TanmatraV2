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
              {/* EXACTLY ONE ServiceabilityBar may exist per page, and this is
                  it. Its verdict/pincode state is per-instance — the component
                  reads localStorage once at mount and never subscribes to
                  `storage` — so a second copy desyncs permanently: check a
                  pincode in one and the other still reads "Select your
                  location" for the rest of the session. app/page.tsx used to
                  render a second one (placement="hero", `hidden sm:block`), so
                  both showed from sm up; that copy is gone. Deliberately NOT
                  breakpoint-gated — being the only instance, it has to render
                  at every width. min-w-0 lets it shrink (its label truncates)
                  instead of shoving ⌘K off a 360px bar: Astryx's TopNav
                  endContent slot is flex-shrink:0, so the cap has to come from
                  the widget itself.

                  DeliveryAddressBar WRAPS that single instance rather than
                  adding a second: signed out, or signed in with nothing saved,
                  it renders exactly the ServiceabilityBar that used to sit
                  here. Signed in with an address, it swaps in the ambient
                  "Delivering to: …" switcher instead. Either way the count of
                  mounted ServiceabilityBars stays 0-or-1, which is what the
                  invariant above actually requires. */}
              <div className="min-w-0">
                <DeliveryAddressBar />
              </div>
              <CommandMenu />
              <ThemeToggle />
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
            </FocusChromeGate>
          }
        />
      </div>
    </header>
  );
}

