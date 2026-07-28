"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { COMPANY_LINKS, LEGAL_LINKS, SITE } from "@/lib/nav";

export type CoreTab = "home" | "menu" | "plan" | "account";

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
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    key: "plan",
    label: "My Plan",
    href: "/plans",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
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

  return (
    <>
      <nav
        aria-label="Native Mobile Navigation"
        className="fixed bottom-0 inset-x-0 z-50 border-t border-line bg-neutral-900/90 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] md:hidden select-none-ui"
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
                    onClick={() => setAccountSheetOpen(true)}
                    className={`flex flex-col items-center justify-center gap-1 w-full h-full min-h-[44px] transition-transform active:scale-95 ${
                      isActive ? "text-gold font-bold" : "text-neutral-400 hover:text-neutral-200"
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
                <Link
                  href={tab.href}
                  className={`flex flex-col items-center justify-center gap-1 w-full h-full min-h-[44px] transition-transform active:scale-95 ${
                    isActive ? "text-gold font-bold" : "text-neutral-400 hover:text-neutral-200"
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
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden animate-fade-in"
          onClick={() => setAccountSheetOpen(false)}
        >
          <div
            className="fixed bottom-0 inset-x-0 bg-neutral-950 border-t border-neutral-800 rounded-t-3xl p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] text-neutral-100 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto w-12 h-1.5 rounded-full bg-neutral-700 mb-6" />

            <h3 className="text-lg font-bold">Account &amp; Information</h3>
            <p className="text-xs text-neutral-400 mt-1">Manage profile, preferences, and policies</p>

            <div className="mt-6 flex flex-col gap-3">
              <Link
                href="/account"
                onClick={() => setAccountSheetOpen(false)}
                className="flex items-center justify-between p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-sm font-semibold"
              >
                <span>Account Dashboard</span>
                <span>&rarr;</span>
              </Link>
              <Link
                href="/account/orders"
                onClick={() => setAccountSheetOpen(false)}
                className="flex items-center justify-between p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-sm font-semibold"
              >
                <span>My Orders &amp; Subscriptions</span>
                <span>&rarr;</span>
              </Link>
            </div>

            <div className="mt-6 border-t border-neutral-800 pt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">Company &amp; Legal</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {COMPANY_LINKS.concat(LEGAL_LINKS).map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setAccountSheetOpen(false)}
                    className="p-2 text-neutral-300 hover:text-white"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-6 text-center text-[10px] text-neutral-500">
              {SITE.brand} · FSSAI {SITE.fssai}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
