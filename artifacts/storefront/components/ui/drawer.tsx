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

/**
 * SCRIM INVARIANT — read before touching this element.
 *
 * The overlay NEVER carries `data-stitch="dark"`, and its fill is `--scrim`
 * (dark in BOTH arms of the tuple), never a surface/ink token. Vaul and Radix
 * both reparent overlays onto document.body, so an overlay escapes every
 * [data-stitch] wrapper and resolves against whatever scope `body` is in — a
 * token that flips with scope would veil a dialog opened from a dark route in
 * white. The old `bg-[var(--ink)]/40` rendered correctly only by accident: it
 * escaped to the LIGHT arm of --ink (near-black) and so happened to look like a
 * scrim. Scoping the overlay to fix a white panel would have flipped --ink to
 * its near-white dark arm and turned every scrim milky. Scope the CONTENT, and
 * leave the scrim alone.
 *
 * z sits on the --z-modal tier: the mobile bottom nav is --z-nav, so anything
 * below it dims the page except the bottom 64px, where the nav stays lit on top
 * of the scrim.
 */
export function DrawerOverlay() {
  return (
    <VaulDrawer.Overlay className="fixed inset-0 z-[var(--z-modal)] bg-[var(--scrim)]" />
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
        className="fixed inset-x-0 bottom-0 z-[var(--z-modal)] mx-auto flex max-h-[100dvh] w-full max-w-2xl flex-col rounded-t-2xl border border-line bg-[var(--glass)] backdrop-blur-[12px] shadow-[var(--shadow-card)] outline-none pb-[env(safe-area-inset-bottom)]"
      >
        {/* Drag handle — always visible per §6. */}
        <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-line-strong" />
        {children}
      </VaulDrawer.Content>
    </DrawerPortal>
  );
}
