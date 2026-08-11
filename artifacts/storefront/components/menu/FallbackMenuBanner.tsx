import { globalCopy } from "@/content/copy/global";

/**
 * D-06(b): quiet notice for menu/PDP when fetchMenu() served the static
 * fallback catalog instead of the live API. Server component — no state, no
 * dismissal, just present while the condition holds.
 *
 * No `role="status"`: this is static SSR content read in normal document
 * order, not a dynamic announcement, and /menu already has a genuine live
 * region (the delivery-address switcher's out-of-zone status) — a second
 * `role="status"` on the same page made `getByRole("status")` ambiguous
 * there (caught by active-address-serviceability.spec.ts in CI).
 */
export function FallbackMenuBanner() {
  return (
    <p className="mb-4 rounded-2xl border border-line bg-surface-raised px-4 py-3 text-sm text-ink-muted">
      {globalCopy.menu.fallbackBanner}
    </p>
  );
}
