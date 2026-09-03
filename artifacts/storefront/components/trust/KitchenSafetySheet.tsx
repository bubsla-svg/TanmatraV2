"use client";
// Client: a bottom sheet (Vaul) opened from a chip — inherently interactive.
// Stitch dark scope on the sheet root, same as CartDrawer: the sheet floats
// over light and dark routes alike.
import "@/lib/themes/stitch.css";
import { useState } from "react";
import Link from "next/link";
import { SITE } from "@/lib/nav";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { useOverlayHistory } from "@/components/ui/useOverlayHistory";

/**
 * "Kitchen & safety" — the trust surface, one tap from Home, the dish page and
 * the pay bar (T-20). The credentials existed (a real FSSAI registration, the
 * ISO 22000 kitchen, RD review, the allergen policy) but on a phone they were
 * 11–12px footer text nobody could tap. Same sheet everywhere, so the claims
 * cannot drift between surfaces.
 *
 * Every line here is a claim the site already makes elsewhere — the
 * registration number from lib/nav's SITE (the footer's own source), the
 * ISO 22000 kitchen from /about, RD review from /rd. Nothing is added here
 * that a page cannot back. "Registered", never "licensed" — the certificate
 * is an FSSAI Registration (fssaiClaims.test.ts).
 */
export function KitchenSafetyChip({
  variant = "quiet",
  className = "",
}: {
  /** "quiet" is the hairline chip; "line" is a full-width text row. */
  variant?: "quiet" | "line";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  useOverlayHistory(open, () => setOpen(false));

  const chipCls =
    variant === "line"
      ? "inline-flex min-h-11 w-full items-center justify-center gap-1.5 text-xs font-medium text-ink-muted underline-offset-4 hover:underline"
      : "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-xs font-semibold text-ink transition-colors hover:border-line-strong";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="kitchen-safety-chip"
        className={`${chipCls} ${className}`}
      >
        <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-gold">
          <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" />
        </svg>
        {/* "Dietitians", not "RD-reviewed": the dish page must carry no
            per-dish RD-review string (finding F5, menu-image-integrity.spec) —
            the kitchen-level claim is stated inside the sheet, in full. */}
        FSSAI · ISO 22000 · Dietitians
        <span aria-hidden className="text-ink-faint">›</span>
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent data-stitch="dark" data-testid="kitchen-safety-sheet">
          <div className="flex min-h-0 flex-col overflow-y-auto overscroll-contain px-4 pb-6 pt-3">
            <div className="flex items-center justify-between gap-3">
              <DrawerTitle className="text-lg font-semibold text-ink">Kitchen &amp; safety</DrawerTitle>
              <DrawerClose aria-label="Close" className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink active:scale-95">
                <span aria-hidden className="text-xl leading-none">✕</span>
              </DrawerClose>
            </div>
            <DrawerDescription className="mt-1 text-sm text-ink-muted">
              What stands behind every plate, and where to check it.
            </DrawerDescription>

            <dl className="mt-5 flex flex-col divide-y divide-line">
              <div className="flex flex-col gap-1 py-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-faint">FSSAI registration</dt>
                <dd className="tabular text-base font-semibold text-ink">Reg. No. {SITE.fssai}</dd>
                <dd className="text-sm text-ink-muted">
                  A registered food business under the Food Safety and Standards Act. Look the number up on FoSCoS,
                  the food-business registration portal.
                </dd>
              </div>
              <div className="flex flex-col gap-1 py-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-faint">ISO 22000 kitchen</dt>
                <dd className="text-sm text-ink-muted">
                  Meals are cooked fresh after you order in an ISO 22000 certified kitchen at {SITE.address}.
                </dd>
              </div>
              <div className="flex flex-col gap-1 py-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Dietitian review</dt>
                <dd className="text-sm text-ink-muted">
                  Registered dietitians design the plans and review the menu&rsquo;s macros and allergen disclosures.{" "}
                  <Link href="/rd" className="font-medium text-gold-text underline-offset-4 hover:underline">
                    Meet the dietitians
                  </Link>
                </dd>
              </div>
              <div className="flex flex-col gap-1 py-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Allergens</dt>
                <dd className="text-sm text-ink-muted">
                  Every dish lists what it contains. A list marked &ldquo;under review&rdquo; is never shown as allergen-free.{" "}
                  <Link href="/legal/disclaimer" className="font-medium text-gold-text underline-offset-4 hover:underline">
                    Health &amp; nutrition disclaimer
                  </Link>
                </dd>
              </div>
            </dl>

            <Link
              href="/about"
              onClick={() => setOpen(false)}
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full border border-line px-5 text-sm font-semibold text-ink hover:bg-surface-raised"
            >
              About the kitchen
            </Link>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
