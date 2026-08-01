"use client";

import { useOverlayHistory } from "./useOverlayHistory";

export function NativeBottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  // Android/iOS back gesture closes the sheet, not the page. The shared hook
  // also fixes what the old inline effect got wrong: it depended on `onClose`
  // identity, so any parent re-render tore the trap down and popped history —
  // closing the sheet from an unrelated state change.
  useOverlayHistory(open, onClose);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] backdrop-blur-sm animate-fade-in select-none-ui">
      {/* Backdrop Tap */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden />

      {/* Bottom sheet: entrance is transform-only (animate-sheet-in) so the
          slide stays on the compositor. */}
      <div className="relative z-10 w-full max-w-lg animate-sheet-in rounded-t-3xl border-t border-line bg-surface p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-2xl max-h-[90vh] overflow-y-auto overscroll-contain">
        {/* Native Grabber Bar */}
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line-strong" />

        {title && (
          <h2 className="mb-4 text-lg font-bold tracking-tight text-ink">{title}</h2>
        )}

        {children}
      </div>
    </div>
  );
}
