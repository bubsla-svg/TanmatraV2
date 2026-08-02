/**
 * Internal surfaces route registry — the single source of truth for routes
 * that belong to the operations ERP rather than the consumer storefront.
 * 
 * On these routes, ALL consumer chrome (Header, Footer, BottomNav, MiniCartBar)
 * is entirely suppressed. The route provides its own chrome (like AdminShell).
 */
export const INTERNAL_ROUTES = [
  "/admin",
] as const;

export function isInternalSurface(pathname: string): boolean {
  let path = pathname.split(/[?#]/)[0] ?? "";
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return INTERNAL_ROUTES.some(
    (route) => path === route || path.startsWith(`${route}/`)
  );
}
