"use client";
// Mobile bottom navigation (md:hidden) — the 5-group IA from lib/nav.ts as a
// fixed bar. Active group is derived from the pathname; Track's /account/orders
// is matched before Account's /account (NAV_GROUPS order) so orders highlights
// Track, not Account. Desktop uses the Header instead.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS, type NavGroupKey } from "@/lib/nav";

const MATCH: Record<NavGroupKey, string[]> = {
  eat: ["/menu", "/dish"],
  plan: ["/plans", "/plan", "/trial"],
  track: ["/account/orders", "/track"],
  community: ["/recipes", "/corporate"],
  account: ["/account"],
};

const ICON: Record<NavGroupKey, React.ReactNode> = {
  eat: (
    <>
      <path d="M5 11a7 7 0 0 1 14 0" />
      <path d="M3 11h18l-1.4 8.5a1 1 0 0 1-1 .5H5.4a1 1 0 0 1-1-.5Z" />
    </>
  ),
  plan: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" />
    </>
  ),
  track: (
    <>
      <path d="M3 7l9-4 9 4v10l-9 4-9-4Z" />
      <path d="M3 7l9 4 9-4M12 11v10" />
    </>
  ),
  community: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 5.6a3.5 3.5 0 0 1 0 6.8M22 20a6 6 0 0 0-4-5.7" />
    </>
  ),
  account: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
};

function activeKey(pathname: string): NavGroupKey | null {
  for (const g of NAV_GROUPS) {
    if (MATCH[g.key].some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return g.key;
    }
  }
  return null;
}

export function BottomNav() {
  const pathname = usePathname();
  const active = activeKey(pathname);
  return (
    <nav
      aria-label="Primary mobile"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {NAV_GROUPS.map((g) => {
          const on = active === g.key;
          return (
            <li key={g.key} className="flex-1">
              <Link
                href={g.href}
                aria-current={on ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2 text-[10px] font-medium ${on ? "text-ink" : "text-ink-faint"}`}
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  {ICON[g.key]}
                </svg>
                {g.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
