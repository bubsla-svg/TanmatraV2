import { globalCopy } from "@/content/copy/global";

/**
 * D-06(b): quiet notice for menu/PDP when fetchMenu() served the static
 * fallback catalog instead of the live API. Server component — no state, no
 * dismissal, just present while the condition holds.
 */
export function FallbackMenuBanner() {
  return (
    <p
      role="status"
      className="mb-4 rounded-2xl border border-line bg-surface-raised px-4 py-3 text-sm text-ink-muted"
    >
      {globalCopy.menu.fallbackBanner}
    </p>
  );
}
