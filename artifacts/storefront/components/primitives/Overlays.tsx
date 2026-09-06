"use client";
import React from "react";
import { Dialog } from "radix-ui";

/**
 * The two overlay shapes, on Radix Dialog.
 *
 * They used to be hand-rolled: a fixed div, a click-to-close backdrop, and an
 * icon-only close button. That div was not a dialog to anything but a sighted
 * mouse user — no `role`, no `aria-modal`, no accessible name, no focus trap,
 * no Escape, and nothing stopping a screen reader walking straight out of it
 * into the page behind. The file's own comment said "for production, this
 * would integrate with Radix Dialog or Vaul"; /styleguide is where the rest of
 * the app copies its patterns from, so shipping the placeholder there was
 * teaching the wrong one.
 *
 * Radix supplies all of the above, and Title is what names the dialog — the
 * same visible <h2> as before, so nothing moves.
 */
interface OverlayProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

/** Radix's onOpenChange fires with `false` for Escape, backdrop and Close
 *  alike, so all three routes land on the caller's single onClose. */
function useDismiss(onClose: () => void) {
  return React.useCallback((open: boolean) => {
    if (!open) onClose();
  }, [onClose]);
}

function CloseButton() {
  return (
    <Dialog.Close
      aria-label="Close"
      className="touch-target-min -mr-2 p-2 text-ink-muted transition-all hover:text-ink active:scale-95"
    >
      <svg aria-hidden className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </Dialog.Close>
  );
}

export const BottomSheet: React.FC<OverlayProps> = ({ isOpen, onClose, title, children }) => {
  const onOpenChange = useDismiss(onClose);
  return (
  <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[var(--z-modal)] bg-scrim backdrop-blur-sm transition-opacity" />
      <Dialog.Content
        aria-describedby={undefined}
        className="fixed inset-x-0 bottom-0 z-[var(--z-modal)] flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-2xl outline-none animate-in slide-in-from-bottom"
      >
        <div className="flex justify-center pt-4 pb-2">
          <div aria-hidden className="w-12 h-1.5 bg-surface-raised rounded-full" />
        </div>
        <div className="px-6 pb-4 pt-2 border-b border-line flex justify-between items-center">
          <Dialog.Title className="text-xl font-bold text-ink tracking-tight">{title}</Dialog.Title>
          <CloseButton />
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
  );
};

export const Modal: React.FC<OverlayProps> = ({ isOpen, onClose, title, children }) => {
  const onOpenChange = useDismiss(onClose);
  return (
  <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[var(--z-modal)] bg-scrim backdrop-blur-sm transition-opacity" />
      <Dialog.Content
        aria-describedby={undefined}
        className="fixed left-1/2 top-1/2 z-[var(--z-modal)] flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl outline-none animate-in zoom-in-95 duration-200"
      >
        <div className="px-6 py-5 border-b border-line flex justify-between items-center">
          <Dialog.Title className="text-xl font-bold text-ink tracking-tight">{title}</Dialog.Title>
          <CloseButton />
        </div>
        <div className="p-6">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
  );
};
