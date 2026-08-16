"use client";

// Stitch dark scope (component-scoped — this bar is layout chrome, so it floats
// over light and dark routes alike; data-stitch sits on the bar root, not a page
// wrapper) — see lib/themes/stitch.css, same pattern as MiniCartBar/CartDrawer.
import "@/lib/themes/stitch.css";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { COMPANY_LINKS, LEGAL_LINKS, SITE } from "@/lib/nav";
import { useOverlayHistory } from "@/components/ui/useOverlayHistory";
import { useScrollHide } from "@/lib/useScrollHide";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";

export type CoreTab = "home" | "menu" | "care" | "account";

// useScrollHide moved to lib/ (owner feedback 2026-08-16): the header now
// retreats with the SAME hook, so top and bottom chrome move on identical
// thresholds — see lib/useScrollHide.ts for the extraction note.

interface TabConfig {
  key: CoreTab;
  label: string;
  href: string;
  icon: React.ReactNode;
}

const TABS: TabConfig[] = [
  {
    key: "home",
    label: "Home",
    href: "/",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5z" />
      </svg>
    ),
  },
  {
    key: "menu",
    label: "Menu",
    href: "/menu",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M18 8V3M14 8V3M18 13v8M14 13v8M6 21v-8a4 4 0 0 1 4-4v0a4 4 0 0 1 4 4v8M6 3v5a4 4 0 0 0 4 4v0a4 4 0 0 0 4-4V3" />
      </svg>
    ),
  },
  {
    key: "care",
    label: "Care",
    href: "/care",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    key: "account",
    label: "Account",
    href: "/account",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

/** Care matches /care, /care/*, and /clinical — never /plans (D-17 ruling:
 *  no misleading active states now that Plan -> Care no longer owns /plans). */
function isTabActive(tab: TabConfig, pathname: string): boolean {
  if (tab.key === "care") {
    return pathname === "/care" || pathname.startsWith("/care/") || pathname === "/clinical" || pathname.startsWith("/clinical/");
  }
  if (tab.href === "/") return pathname === "/";
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const scrollHidden = useScrollHide(accountSheetOpen);
  // The bar slides away for two independent reasons: scrolled away, or the
  // account sheet covers where it sits.
  const barHidden = scrollHidden || accountSheetOpen;

  // …but only ONE of those may also `inert` it, and it is not the sheet.
  //
  // The Account tab's trigger button lives inside this bar. Marking the bar
  // inert while the sheet is open therefore inerts the very element that
  // still holds focus at that instant, and Chrome refuses:
  //
  //   Blocked aria-hidden on an element because its descendant retained
  //   focus. […] Ancestor with aria-hidden: <nav …>
  //
  // (The `aria-hidden` in that message is not ours — the sheet is a Radix
  // Dialog via Vaul, and Radix marks background content hidden itself. Our
  // `inert` is what pinned a focused node inside it.)
  //
  // It also broke focus RESTORE: Radix returns focus to the trigger on close,
  // and an inert trigger cannot receive it, so dismissing the sheet dropped
  // focus to <body> and a keyboard user lost their place in the tab bar.
  //
  // Scroll-hide still inerts, and must: that bar is genuinely gone from the
  // layout with no dialog managing anything, so its links must leave the tab
  // order. The dialog case needs no help from us — Radix already makes the
  // background inert while it is open.
  const barInert = scrollHidden;

  // Back gesture closes the account sheet, not the page.
  useOverlayHistory(accountSheetOpen, () => setAccountSheetOpen(false));

  // No pathname gate here any more: this bar mounts only from
  // app/(global)/layout.tsx and app/not-found.tsx, and both want it
  // unconditionally — focus/b2b routes never mount it at all (their layouts
  // render no global chrome), and a 404 always offers the tab bar so a lost
  // visitor can navigate whatever shape the bad URL had.

  return (
    <>
      {/* data-stitch on the bar root, not a page wrapper: this bar is painted
          dark on every route, but it renders from app/layout.tsx — OUTSIDE the
          route wrappers that carry the dark scope. Without it the tokens here
          resolve their LIGHT arm on a near-black bar, and the selected tab is
          the worst offender: text-gold gives the light-mode saffron at 3.37:1
          while the three unselected tabs sit at 7.10:1, so the current tab is
          the least legible thing in the bar (10px labels — AA needs 4.5:1, and
          the currentColor icon needs 1.4.11's 3:1). The scope flips --gold to
          the dark arm (8.53:1) and --line to the 6% hairline instead of a
          bright light-mode rule. */}
      <nav
        data-stitch="dark"
        aria-label="Native Mobile Navigation"
        inert={barInert || undefined}
        className={`fixed bottom-0 inset-x-0 z-50 border-t border-line bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] backdrop-blur-xl pb-[env(safe-area-inset-bottom)] md:hidden select-none-ui transition-transform duration-200 ${
          barHidden ? "translate-y-full" : "translate-y-0"
        }`}
      >
        <ul className="flex h-16 items-stretch justify-around">
          {TABS.map((tab) => {
            const isActive = isTabActive(tab, pathname);

            // Astryx TabList idiom (stage 3): selection is expressed
            // STRUCTURALLY — data-selected on the tab plus a separate
            // indicator element — not by colour/weight alone. The indicator
            // doubles as a second non-colour cue alongside aria-current
            // (SC 1.4.1). Astryx ships no bottom tab BAR primitive (MobileNav
            // is a side drawer), so per the runbook this adopts the styling
            // idiom while the tab-bar interaction model stays — a product
            // decision, not a skin.
            const tabCls = `relative flex flex-col items-center justify-center gap-1 w-full h-full min-h-[44px] transition-transform active:scale-95 ${
              isActive ? "text-gold font-semibold" : "text-ink-muted hover:text-ink"
            }`;
            const indicator = (
              <span
                aria-hidden="true"
                data-selected={isActive || undefined}
                className={`pointer-events-none absolute top-0 h-0.5 w-8 rounded-full transition-opacity duration-200 bg-gold ${
                  isActive ? "opacity-100" : "opacity-0"
                }`}
              />
            );

            if (tab.key === "account") {
              return (
                <li key={tab.key} className="flex-1">
                  <button
                    type="button"
                    data-selected={isActive || undefined}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setAccountSheetOpen(true)}
                    className={tabCls}
                  >
                    {indicator}
                    {tab.icon}
                    <span className="text-3xs tracking-tight">{tab.label}</span>
                  </button>
                </li>
              );
            }

            return (
              <li key={tab.key} className="flex-1">
                {/* aria-current is the non-colour fallback for selection — the
                    gold/muted split alone fails SC 1.4.1. components/BottomNav.tsx
                    has always carried it; this bar had dropped it. */}
                <Link
                  href={tab.href}
                  data-selected={isActive || undefined}
                  aria-current={isActive ? "page" : undefined}
                  className={tabCls}
                >
                  {indicator}
                  {tab.icon}
                  <span className="text-3xs tracking-tight">{tab.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Account Info Sheet — the Drawer primitive (Vaul over Radix Dialog),
          same as CartDrawer/DishDrawer: role="dialog", aria-modal, focus
          move/trap and Escape-to-close all come from the primitive instead of
          the hand-rolled scrim-div this replaced (no dialog role, no focus
          trap, no Escape, dismiss was scrim-tap or back-gesture only). The
          platform back-gesture behaviour is unchanged — useOverlayHistory
          above still owns it, same division of labour CartDrawer's own
          comment describes: "Vaul owns the slide; history ownership lives
          here." Rendered unconditionally (not `{accountSheetOpen && ...}`) so
          Vaul's own close transition can play instead of the content being
          yanked out of the tree immediately. data-stitch="dark" moves onto
          DrawerContent itself, matching CartDrawer's placement — the sheet is
          a sibling of the <nav>, not a descendant, so it needs its own dark
          scope; its panel painted near-black on every route without it. */}
      <Drawer open={accountSheetOpen} onOpenChange={setAccountSheetOpen}>
        <DrawerContent data-stitch="dark" className="md:hidden">
          <div className="flex flex-col overflow-y-auto overscroll-contain px-6 pb-6 text-ink">
            <DrawerTitle className="text-lg font-bold">Account &amp; Information</DrawerTitle>
            <DrawerDescription className="text-xs text-ink-muted mt-1">
              Manage profile, preferences, and policies
            </DrawerDescription>

            <div className="mt-6 flex flex-col gap-3">
              <Link
                href="/account"
                onClick={() => setAccountSheetOpen(false)}
                className="flex items-center justify-between p-3 rounded-xl bg-surface-raised border border-line text-sm font-semibold"
              >
                <span>Account Dashboard</span>
                <span>&rarr;</span>
              </Link>
              <Link
                href="/account/orders"
                onClick={() => setAccountSheetOpen(false)}
                className="flex items-center justify-between p-3 rounded-xl bg-surface-raised border border-line text-sm font-semibold"
              >
                <span>My Orders &amp; Subscriptions</span>
                <span>&rarr;</span>
              </Link>
            </div>

            <div className="mt-6 border-t border-line pt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-2">Company &amp; Legal</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {COMPANY_LINKS.concat(LEGAL_LINKS).map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setAccountSheetOpen(false)}
                    className="p-2 text-ink-muted hover:text-ink"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-6 text-center text-3xs text-ink-faint">
              {SITE.brand} · FSSAI {SITE.fssai}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
