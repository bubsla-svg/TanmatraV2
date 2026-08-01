"use client"; // usePathname — the focus shell is route-conditional chrome subtraction.

import { usePathname } from "next/navigation";
import { isFocusRoute } from "@/lib/focusRoutes";

/**
 * FocusLayout — the strict shell for high-intent flows (auth, checkout,
 * onboarding, dish PDP), implemented as chrome SUBTRACTION.
 *
 * In the App Router the root layout owns the global chrome (Header,
 * MobileBottomNav, MiniCartBar), so a nested per-route layout cannot
 * un-render it. The focus shell is therefore applied once, at the chrome
 * itself: every piece of global chrome that must vanish inside a focus
 * route is wrapped in (or checks) this gate, and the route set lives in
 * exactly one place — lib/focusRoutes.ts. That registry doubles as the
 * contract's unit-test surface (focusRoutes.test.ts).
 *
 * Its predecessor, ChromeGate, decayed into exactly the failure this file
 * replaces: layout.tsx imported it but no longer rendered it, and its route
 * set (["/"]) described a homepage composition that no longer exists. A
 * disconnected gate fails silently — nothing asserts "this wrapper is
 * actually in the tree" — so the replacement keeps the wired surface tiny:
 * one pure matcher, one client gate, both unit-tested.
 *
 * usePathname is available during SSR, so suppressed chrome is absent from
 * the server HTML too — no hydration flash of a tab bar that then vanishes.
 *
 * Deliberately a wrapper rather than logic inside Header: the children stay
 * server components (a client component may RENDER server children passed
 * as props).
 */
export function FocusChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (isFocusRoute(pathname)) return null;
  return <>{children}</>;
}
