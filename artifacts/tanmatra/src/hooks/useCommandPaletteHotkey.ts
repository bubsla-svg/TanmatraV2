import { useEffect, useState } from "react";

export interface CommandPaletteContextValue {
  open: boolean;
  setOpen: (next: boolean) => void;
}

/**
 * Split out of CommandPalette.tsx (OA-MED-1.21) so Header.tsx — global
 * chrome mounted on every page — doesn't have to statically import the
 * palette's heavy module graph (useMenuCatalog's 116-dish static catalog,
 * MobileSearchSheet, the cmdk UI) just to wire up the Cmd+K listener. The
 * palette component itself is loaded lazily; this hook stays eager since it
 * only needs a keydown listener and open/close state.
 */
export function useCommandPaletteHotkey(): CommandPaletteContextValue {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  return { open, setOpen };
}
