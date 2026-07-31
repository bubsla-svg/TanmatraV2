import Link from "next/link";
import { TopNav } from "@astryxdesign/core/TopNav";
import { PRIMARY_NAV } from "@/lib/nav";
import { CommandMenu } from "@/components/CommandMenu";
import { ServiceabilityBar } from "@/components/onboarding/ServiceabilityBar";

/**
 * Global chrome shell. Server component itself; it hosts one small client island
 * (CommandMenu, the ⌘K search). The primary links come from the central nav
 * config (lib/nav.ts) so route-parity waves extend the IA by editing data, not
 * this file. Primary links are desktop-only — on mobile the BottomNav carries them.
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
              className="text-lg font-semibold tracking-tight text-ink"
              aria-label="Tanmatra home"
            >
              Tanmatra
            </Link>
          }
          endContent={
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
                  the widget itself. */}
              <div className="min-w-0">
                <ServiceabilityBar placement="menu" />
              </div>
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
          }
        />
      </div>
    </header>
  );
}

