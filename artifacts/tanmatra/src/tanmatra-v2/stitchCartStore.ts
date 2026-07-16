import { create } from "zustand";

/**
 * Minimal Zustand cart store for the Stitch "Nocturnal Nourishment" preview
 * screens (shared UI state across the previews). The production checkout uses
 * the server-authoritative cart; wiring these previews to it is a follow-up.
 */
export interface StitchCartLine {
  slug: string;
  name: string;
  pricePaise: number;
  kcal: number;
  qty: number;
}

interface StitchCartState {
  lines: StitchCartLine[];
  count: number;
  add: (line: Omit<StitchCartLine, "qty">) => void;
  clear: () => void;
}

export const useStitchCart = create<StitchCartState>((set) => ({
  lines: [],
  count: 0,
  add: (line) =>
    set((s) => {
      const existing = s.lines.find((l) => l.slug === line.slug);
      const lines = existing
        ? s.lines.map((l) => (l.slug === line.slug ? { ...l, qty: l.qty + 1 } : l))
        : [...s.lines, { ...line, qty: 1 }];
      return { lines, count: s.count + 1 };
    }),
  clear: () => set({ lines: [], count: 0 }),
}));
