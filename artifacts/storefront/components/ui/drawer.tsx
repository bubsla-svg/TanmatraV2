"use client";
// "use client" justification: Vaul's drawer is drag-physics + portal + focus
// management — inherently interactive. This is the §4.2 bottom-sheet primitive;
// per the motion contract its drag physics are native and never re-animated.
import { Drawer as VaulDrawer } from "vaul";

/**
 * Thin, token-styled wrapper over Vaul (the shadcn `drawer` engine, per
 * TNM-UIF-01 §1). Exposes only what the storefront consumes; overlay and
 * content are styled with semantic tokens, no raw colours.
 */
export const Drawer = VaulDrawer.Root;
export const DrawerTrigger = VaulDrawer.Trigger;
export const DrawerPortal = VaulDrawer.Portal;
export const DrawerClose = VaulDrawer.Close;
export const DrawerTitle = VaulDrawer.Title;
export const DrawerDescription = VaulDrawer.Description;

export function DrawerOverlay() {
  return (
    <VaulDrawer.Overlay className="fixed inset-0 z-40 bg-[var(--ink)]/40" />
  );
}

export function DrawerContent({
  children,
  ...props
}: React.ComponentProps<typeof VaulDrawer.Content>) {
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <VaulDrawer.Content
        {...props}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-t-2xl border border-line bg-surface shadow-[var(--shadow-card)] outline-none"
      >
        {/* Drag handle — always visible per §6. */}
        <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-line-strong" />
        {children}
      </VaulDrawer.Content>
    </DrawerPortal>
  );
}
