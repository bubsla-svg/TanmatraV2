import { useCallback, useEffect, useRef, type KeyboardEvent } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessibility for hand-rolled modal overlays: focus trap, Escape-to-close,
 * and focus restore on close — the parts a raw `position:fixed` div omits.
 * Mirrors the manual pattern in CartDrawer so keyboard/screen-reader users
 * aren't stranded on the money-path charge gates.
 *
 * Wire the returned `panelRef` + `onKeyDown` onto the dialog panel, and add
 * `role="dialog" aria-modal="true" aria-labelledby={...}` yourself. `onClose`
 * should carry any guard the backdrop click uses (e.g. don't close mid-charge).
 */
export function useDialogA11y<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  onClose: () => void,
) {
  const panelRef = useRef<T>(null);
  // Keep the latest onClose without re-binding the (stable) key handler.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // On open: focus the first focusable inside the panel (unless something in it
  // already has focus, e.g. an autofocused OTP box). On close/unmount: restore
  // focus to whatever was focused when the dialog opened.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      if (document.activeElement && panel.contains(document.activeElement)) return;
      panel.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    });
    return () => {
      cancelAnimationFrame(raf);
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [open]);

  const onKeyDown = useCallback((e: KeyboardEvent<T>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onCloseRef.current();
      return;
    }
    if (e.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null,
    );
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  return { panelRef, onKeyDown };
}
