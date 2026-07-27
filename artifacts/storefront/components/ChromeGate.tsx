"use client"; // usePathname — route-conditional chrome has to read the current URL.

import { usePathname } from "next/navigation";

/**
 * Hides the app-wide chrome on routes that bring their own.
 *
 * The M3 homepage is a self-contained 13-section landing composition: it
 * ships its own sticky nav (§0), bottom CTA bar (§11) and footer (§12).
 * The root layout, meanwhile, wraps every route in the global Header,
 * Footer, BottomNav and MiniCartBar. Stacked, that rendered two logos, two
 * navs and two footers on `/` — and on mobile, §11's sticky bar fought
 * BottomNav/MiniCartBar for the same bottom edge. This shipped in #433
 * because nothing asserts "exactly one nav"; a DOM test now does.
 *
 * usePathname is available during SSR, so the suppressed chrome is absent
 * from the server HTML too — no hydration flash of a second header.
 *
 * Deliberately a wrapper rather than logic inside Header/Footer: the
 * children stay server components (a client component may RENDER server
 * children passed as props), and the route list lives in exactly one place.
 */
const SELF_CHROMED_ROUTES = new Set<string>([]);

export function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (SELF_CHROMED_ROUTES.has(pathname)) return null;
  return <>{children}</>;
}
