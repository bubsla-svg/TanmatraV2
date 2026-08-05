"use client";

import { usePathname } from "next/navigation";

// A route matcher for B2B routes (e.g. /corporate, /group, /partners)
export function isB2BRoute(pathname: string) {
  return (
    pathname.startsWith("/corporate") ||
    pathname.startsWith("/group") ||
    pathname.startsWith("/office-lunch") ||
    pathname.startsWith("/rd-partners") ||
    pathname.startsWith("/partners")
  );
}

/**
 * B2BChromeGate
 * Similar to FocusChromeGate but applies a B2B-specific theme/header override.
 * Un-renders standard global chrome in favor of B2B navigation.
 */
export function B2BChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (isB2BRoute(pathname)) {
    return null; // The B2B layout will render its own specialized chrome
  }
  return <>{children}</>;
}
