/**
 * FocusLayout — the strict shell for high-intent flows (P0 §9): auth,
 * checkout, trial, quick-setup, custom-build, PDPs, order confirmation,
 * group/office-lunch carts, corporate invite activation.
 *
 * No global chrome, structurally: no Header, no MobileBottomNav, no Footer,
 * no MiniCartBar. Each flow owns its full canvas and bottom edge — its
 * sticky money bar anchors at bottom-0 and renders its own back affordance.
 * Membership is a property of living under app/(focus)/, not of a runtime
 * pathname check (the old FocusChromeGate mechanism this replaces).
 *
 * Only the safe-area inset is padded — a focus route's own sticky bar still
 * needs to clear the home indicator / notch. This replaces the
 * `body[data-focus-route]` override + beforeInteractive pathname script that
 * used to cancel the global shell's 8rem clearance at runtime.
 */
export default function FocusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main id="main" className="pb-[env(safe-area-inset-bottom)]">
      {children}
    </main>
  );
}
