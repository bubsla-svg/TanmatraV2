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
import { isFocusRoute } from "@/lib/focusRoutes";

export type CoreTab = "home" | "menu" | "plans" | "account";

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
    key: "plans",
    label: "Plan",
    href: "/plans",
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

export function MobileBottomNav() {
  const pathname = usePathname();
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);

  // Back gesture closes the account sheet, not the page.
  useOverlayHistory(accountSheetOpen, () => setAccountSheetOpen(false));

  // FOCUS SHELL LAW (components/FocusLayout.tsx): the global tab bar never
  // renders inside a high-intent flow — auth, checkout, onboarding, PDP own
  // their bottom edge (their money bars anchor at bottom-0 there). Checked
  // AFTER the hooks so the hook order stays unconditional.
  if (isFocusRoute(pathname)) return null;

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
        className="fixed bottom-0 inset-x-0 z-50 border-t border-line bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] backdrop-blur-xl pb-[env(safe-area-inset-bottom)] md:hidden select-none-ui"
      >
        <ul className="flex h-16 items-stretch justify-around">
          {TABS.map((tab) => {
            const isActive =
              tab.href === "/"
                ? pathname === "/"
                : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

            if (tab.key === "account") {
              return (
                <li key={tab.key} className="flex-1">
                  <button
                    type="button"
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setAccountSheetOpen(true)}
                    className={`flex flex-col items-center justify-center gap-1 w-full h-full min-h-[44px] transition-transform active:scale-95 ${
                      isActive ? "text-gold font-bold" : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    {tab.icon}
                    <span className="text-[10px] tracking-tight">{tab.label}</span>
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
                  aria-current={isActive ? "page" : undefined}
                  className={`flex flex-col items-center justify-center gap-1 w-full h-full min-h-[44px] transition-transform active:scale-95 ${
                    isActive ? "text-gold font-bold" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {tab.icon}
                  <span className="text-[10px] tracking-tight">{tab.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Account Info Sheet */}
      {accountSheetOpen && (
        <div
          className="fixed inset-0 z-50 bg-[var(--scrim)] backdrop-blur-sm md:hidden animate-fade-in"
          onClick={() => setAccountSheetOpen(false)}
        >
          {/* Same reasoning as the bar: the sheet is a sibling of the <nav>, not
              a descendant, so it needs its own data-stitch to put its token
              subtree on the dark arm — its panel is painted near-black on every
              route. */}
          <div
            data-stitch="dark"
            className="fixed bottom-0 inset-x-0 animate-sheet-in bg-surface border-t border-line rounded-t-3xl p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] text-ink max-h-[85vh] overflow-y-auto overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto w-12 h-1.5 rounded-full bg-line-strong mb-6" />

            <h3 className="text-lg font-bold">Account &amp; Information</h3>
            <p className="text-xs text-ink-muted mt-1">Manage profile, preferences, and policies</p>

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

            <div className="mt-6 text-center text-[10px] text-ink-faint">
              {SITE.brand} · FSSAI {SITE.fssai}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
