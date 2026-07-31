import { Fragment } from "react";
import Link from "next/link";
import { LayoutFooter } from "@astryxdesign/core/Layout";
import { navGroup, COMPANY_LINKS, LEGAL_LINKS, SITE, type NavLink } from "@/lib/nav";

/**
 * Global footer — the public-facing site IA + legal links + the FSSAI/entity
 * disclosure, rendered from the central nav config (lib/nav.ts) so waves extend
 * it by editing data, not this file.
 */
const COLUMNS: { label: string; links: NavLink[] }[] = [
  { label: "Eat", links: navGroup("eat").links },
  { label: "Plan", links: navGroup("plan").links },
  { label: "Company", links: COMPANY_LINKS },
  { label: "Legal", links: LEGAL_LINKS },
];

export function Footer() {
  return (
    // pt-16, not mt-16: the gap above the footer has to be INSIDE the footer's
    // own background. A top margin here does not collapse — its previous
    // sibling is <main> — so those 64px stayed transparent and let
    // html{background:var(--bg)} show through, banding a light grey stripe
    // between a dark page and this surface: a black → grey → white staircase.
    <footer className="border-t border-line bg-surface pt-16 max-md:hidden">
      <LayoutFooter>
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="grid grid-cols-2 gap-6 md:gap-8 md:grid-cols-4">
            {COLUMNS.map((col) => (
              <nav key={col.label} aria-label={col.label} className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                  {col.label}
                </p>
                {col.links.map((l, i) => {
                  const openSection = Boolean(l.section && l.section !== col.links[i - 1]?.section);
                  return (
                    <Fragment key={l.href + l.label}>
                      {openSection && (
                        <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                          {l.section}
                        </p>
                      )}
                      <Link
                        href={l.href}
                        className="text-sm text-ink-muted transition-colors hover:text-ink"
                      >
                        {l.label}
                      </Link>
                    </Fragment>
                  );
                })}
              </nav>
            ))}
          </div>
          {/* Every <p> in here restates text-xs/text-ink-faint even though the
              container already sets them. Not redundant: lib/themes/tanmatra.css
              has a `:where(p){font-size;color}` reset that matches these tags
              DIRECTLY, and a direct match beats an inherited value whatever the
              specificity — so bare <p>s rendered 14px near-black and out-shouted
              the nav columns above. A class on the tag itself is what wins. */}
          <div className="mt-10 flex flex-col gap-1 border-t border-line pt-6 text-xs text-ink-faint">
            <p className="text-sm font-semibold text-ink">{SITE.brand}</p>
            <p className="text-xs text-ink-faint">{SITE.tagline}</p>
            <p className="mt-1 text-xs text-ink-faint">FSSAI Licence No. {SITE.fssai} · RD-reviewed kitchen · Made in India</p>
            <p className="text-xs text-ink-faint">&copy; {SITE.brand}. All rights reserved.</p>
          </div>
        </div>
      </LayoutFooter>
    </footer>
  );
}

