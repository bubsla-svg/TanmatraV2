import Link from "next/link";
import { TopNav } from "@astryxdesign/core/TopNav";
import { HeaderShell } from "@/components/HeaderShell";
import { CommandMenu } from "@/components/CommandMenu";
import { PrimaryNav } from "@/components/PrimaryNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DeliveryAddressBar } from "@/components/onboarding/DeliveryAddressBar";
import { fetchMenu } from "@/lib/catalog";

/**
 * Global chrome shell. Server component itself; it hosts two small client
 * islands — CommandMenu (⌘K) and PrimaryNav (desktop nav links, needs
 * usePathname() for the active-state match). The primary links come from the
 * central nav config (lib/nav.ts) so route-parity waves extend the IA by
 * editing data, not this file or PrimaryNav.tsx. Desktop-only — on mobile
 * BottomNav carries the same core destinations.
 *
 * Renders only from app/(global)/layout.tsx. Focus routes (app/(focus)/ —
 * auth, checkout, onboarding, dish PDP) never mount this header at all, so
 * the old FocusChromeGate that stripped the interactive cluster down to the
 * brand link on those routes is gone: the double-state collisions it guarded
 * against (chrome location picker over /checkout's own address flow, ⌘K over
 * a page's own search) are now impossible by construction — those pages live
 * in a group whose layout renders no header.
 */
export async function Header() {
  // Minimal {id, name, slug} projection for CommandMenu's dish search — not
  // the full DishData (price, macros, images, ingredients, …), since ⌘K only
  // ever needs to match a name and hand off to /dish/[slug]. Reuses
  // fetchMenu()'s existing hourly revalidate cache (the same call the
  // homepage and /menu already make), so this costs no extra network
  // round-trip in steady state — same "catalog is already loaded" data flow.
  const { dishes } = await fetchMenu();
  const dishIndex = dishes.map((d) => ({ id: d.id, name: d.name, slug: d.slug }));

  return (
    // HeaderShell owns the <header> element and its retreat-on-scroll
    // behavior (the sticky/border/backdrop classes moved with it); this
    // file stays a Server Component and its content crosses the boundary
    // as children.
    <HeaderShell>
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
              // touch-target-min raises the 74x28 box to 44px (global chrome,
              // so that one finding was counted on all seven audited routes).
              // `justify-start` overrides the utility's centring — this is the
              // leading brand element and must stay flush left — and the
              // -mx-2/px-2 pair buys horizontal tap area without moving the
              // wordmark a pixel.
              //
              // The truncation moved to an inner span deliberately:
              // `text-overflow: ellipsis` needs a block container, and the
              // utility makes this anchor inline-flex, which would turn the
              // text into an anonymous flex item and silently stop clipping.
              className="touch-target-min -mx-2 justify-start px-2"
              aria-label="Tanmatra home"
            >
              <span className="inline-block max-w-[7.5rem] overflow-hidden text-ellipsis whitespace-nowrap align-middle text-lg font-semibold tracking-tight text-ink sm:max-w-none">
                Tanmatra
              </span>
            </Link>
          }
          centerContent={<PrimaryNav />}
          endContent={
            <nav aria-label="Primary" className="flex items-center gap-2">
              <div className="min-w-0">
                <DeliveryAddressBar />
              </div>
              {/* The "RD-Reviewed" chip that sat here is REMOVED, for the
                  same reason /menu's trust strip withheld the identical
                  claim before that strip itself came out (the record now
                  lives in components/menu/MacroLegend.tsx): finding F5.
                  It rested on `rdVerified`, which is true on all
                  145 live dishes — and on `rdReviewState`, which is
                  "reviewed" on all 145 for the same reason (POS imports are
                  written in pre-reviewed by lib/petpooja.ts). Neither is a
                  dietitian's sign-off, so a site-wide chip asserting one was
                  a compliance claim with nothing behind it, sitting above a
                  menu where 17 dishes cannot even state their macros.

                  Unlike the strip's, this claim was UNCONDITIONAL — it could
                  not degrade, because it read no data at all. There is
                  nothing to gate it on, so it comes out entirely; it returns
                  when F5 is resolved and a real per-dish signal exists. */}

              <div className="flex items-center gap-1">
                <CommandMenu dishes={dishIndex} />
                {/* D-09: ThemeToggle was imported here and never rendered —
                    ServiceabilityBar's own width-budget comment already
                    accounted for it ("heading + this + ⌘K + ThemeToggle"
                    at 44px), it just never actually landed in the tree. */}
                <ThemeToggle />
                <Link
                  href="/account"
                  aria-label="Account"
                  // Desktop-only, matching this file's own header comment —
                  // MobileBottomNav.tsx already renders its own "Account"
                  // tab, and PrimaryNav (centerContent, above) deliberately
                  // drops /account from PRIMARY_NAV for the same reason this
                  // icon exists. Giving this link a real
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
    </HeaderShell>
  );
}

