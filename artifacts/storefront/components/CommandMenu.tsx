"use client";
// Command menu (⌘K) — global route search. A search trigger lives in the Header;
// ⌘K / Ctrl+K also toggles it. Lists every nav route from lib/nav.ts, so a route
// becomes searchable the moment a wave registers it in the config. Radix Dialog
// handles focus-trap, Escape, and scroll-lock.
// ⌘K opens over light and dark routes alike. Radix portals the panel to
// document.body, but that no longer means it escapes theme scope: data-stitch
// lives on <html> (app/layout.tsx), a DOM ancestor of document.body, so
// color-scheme inherits through the portal with no scope attribute needed
// here — the panel just matches whatever route it was opened from.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { NAV_GROUPS, COMPANY_LINKS, LEGAL_LINKS } from "@/lib/nav";
import { useOverlayHistory } from "@/components/ui/useOverlayHistory";

interface Entry {
  label: string;
  href: string;
  group: string;
}

/** The minimal projection Header passes down — see its own comment for why
 *  this is {id, name, slug} and not the full DishData. */
export interface DishSearchEntry {
  id: number;
  name: string;
  slug: string;
}

const ENTRIES: Entry[] = [
  ...NAV_GROUPS.flatMap((g) => g.links.map((l) => ({ label: l.label, href: l.href, group: g.label }))),
  ...COMPANY_LINKS.map((l) => ({ label: l.label, href: l.href, group: "Company" })),
  ...LEGAL_LINKS.map((l) => ({ label: l.label, href: l.href, group: "Legal" })),
].filter((e, i, a) => a.findIndex((x) => x.href === e.href) === i);

export function CommandMenu({ dishes = [] }: { dishes?: DishSearchEntry[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const router = useRouter();

  // Back gesture (or the platform swipe) closes ⌘K instead of leaving the page.
  useOverlayHistory(open, () => setOpen(false));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Idle (no query): page routes only, same as before — 116 dishes would
  // swamp the default view. Once the customer types, dish name matches lead:
  // the catalog page reads "116 dishes · order today", so the search icon in
  // the header is what a food-app customer expects to find food with.
  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return ENTRIES;
    const dishMatches: Entry[] = dishes
      .filter((d) => d.name.toLowerCase().includes(term))
      .map((d) => ({ label: d.name, href: `/dish/${d.slug}`, group: "Dishes" }));
    const pageMatches = ENTRIES.filter(
      (e) => e.label.toLowerCase().includes(term) || e.group.toLowerCase().includes(term),
    );
    return [...dishMatches, ...pageMatches];
  }, [q, dishes]);

  function go(href: string) {
    setOpen(false);
    setQ("");
    router.push(href);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Search pages and dishes"
          className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden rounded border border-line px-1.5 text-3xs leading-4 text-ink-faint md:inline">⌘K</kbd>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        {/* Scrim: --scrim, never data-stitch — see the invariant on
            components/ui/drawer.tsx's DrawerOverlay. */}
        <Dialog.Overlay className="fixed inset-0 z-[var(--z-modal)] animate-fade-in bg-[var(--scrim)] backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-20 z-[var(--z-modal)] w-[92vw] max-w-lg -translate-x-1/2 animate-dialog-in overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
        >
          <Dialog.Title className="sr-only">Search pages and dishes</Dialog.Title>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search pages and dishes…"
            className="w-full border-b border-line bg-transparent px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-faint"
          />
          <ul className="max-h-[50vh] overflow-y-auto py-2">
            {results.length === 0 && (
              <li className="px-4 py-3 text-sm text-ink-muted">No results found.</li>
            )}
            {results.map((e) => (
              <li key={e.href}>
                <button
                  type="button"
                  onClick={() => go(e.href)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-2 text-left hover:bg-bg"
                >
                  <span className="text-sm text-ink">{e.label}</span>
                  <span className="text-2xs text-ink-faint">{e.group}</span>
                </button>
              </li>
            ))}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
