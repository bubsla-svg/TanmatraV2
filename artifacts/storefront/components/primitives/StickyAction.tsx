import type { ComponentPropsWithoutRef, Ref } from "react";
import { cn } from "@/lib/utils";

/**
 * The base every sticky bottom action shares (PR-11b — brief "Sticky
 * actions", matrix #4): fixed to the viewport edges, the safe-area inset,
 * and one of two chromes. Extracted from the four bars that each carried
 * their own copy — the checkout pay bar, the mini-cart pill, the landing CTA
 * bar and the plan ledger — so the chrome is spelled once.
 *
 * What stays with the caller, on purpose, is the vertical anchor and the
 * stacking level: those are the contract with the shell the bar mounts in.
 * `bottom-0` in the (focus) shell, which has no tab bar; `bottom-16` in the
 * (global) shell, above the tab bar's band; the landing bar's `calc()`
 * offsets that stack above the mini-cart. A bar that gets those wrong covers
 * the last form field or another bar (brief: "never cover"), and the callers
 * already document each offset next to the reason for it.
 *
 *  - chrome "glass"   — translucent bar with a hairline top edge (money bars)
 *  - chrome "surface" — near-opaque bar (landing CTA)
 *  - chrome "none"    — positioning only; the caller draws a floating pill
 *  - safeArea         — pads `env(safe-area-inset-bottom)`; off when the
 *                       caller folds the inset into its own offset maths
 */
export type StickyActionProps = ComponentPropsWithoutRef<"div"> & {
  chrome?: "glass" | "surface" | "none";
  safeArea?: boolean;
  /** React 19 ref-as-prop (no forwardRef, so the bar stays usable from server components). */
  ref?: Ref<HTMLDivElement>;
};

export function StickyAction({ chrome = "glass", safeArea = true, className, ref, ...rest }: StickyActionProps) {
  return (
    <div
      ref={ref}
      className={cn(
        "fixed inset-x-0",
        chrome === "glass" && "border-t border-line bg-glass backdrop-blur-md",
        chrome === "surface" && "border-t border-line bg-surface/95 backdrop-blur-md",
        safeArea && "pb-[env(safe-area-inset-bottom)]",
        className,
      )}
      {...rest}
    />
  );
}
