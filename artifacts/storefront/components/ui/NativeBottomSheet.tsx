"use client";

import { useEffect } from "react";

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
  // Android Back-Button Trap: Push state to History API when opened
  useEffect(() => {
    if (!open) return;

    const stateKey = `sheet_${Date.now()}`;
    window.history.pushState({ sheetOpen: true, key: stateKey }, "");

    const handlePopState = () => {
      onClose();
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (window.history.state?.sheetOpen) {
        window.history.back();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in select-none-ui">
      {/* Backdrop Tap */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden />

      {/* Spring Physics Bottom Sheet Container */}
      <div className="relative z-10 w-full max-w-lg rounded-t-3xl border-t border-line bg-surface p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-2xl transition-transform duration-300 max-h-[90vh] overflow-y-auto">
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
