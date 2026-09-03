/**
 * Brand values read OUTSIDE the CSS pipeline.
 *
 * Almost every colour in the storefront flows through tokens.css →
 * globals.css → Tailwind utilities, and lint:tokens bans literals in
 * components/app. Two consumers cannot read CSS custom properties:
 *
 *  - tanmatraTheme.ts, which builds the Astryx theme tuples, and
 *  - third-party surfaces that take a literal — today, Razorpay's checkout
 *    modal `theme.color` (lib/razorpayAdapter.ts).
 *
 * This file is the one sanctioned home for those literals (CLAUDE.md: theme
 * files are the one place colours are meant to live). It RESTATES
 * tanmatraTheme's `--color-accent` light arm rather than feeding it —
 * astryxBridge.test.ts parses tanmatraTheme.ts for literal tuples, so the
 * tuple must stay literal there. The restatement is pinned against that
 * tuple by razorpayAdapter.test.ts ("cannot drift" test), so a repoint of
 * either site fails the build and names the other.
 *
 * Deliberately dependency-free: lib/razorpayAdapter.test.ts runs under bare
 * node --test + tsx, and must not pull the Astryx theme pipeline in.
 */

/**
 * The LIGHT-arm action colour (`--color-accent` light stop). Since PR-11a
 * (docs/MOBILE-FIRST-CX-BRIEF.md "Foundations 0") that is the delivered
 * revision's green primary, not a gold — the export keeps its name because
 * lib/razorpayAdapter.ts (money path, frozen for the restyle series) imports
 * it by this name. This is the value for third-party LIGHT UIs: Razorpay's
 * modal is a light sheet that sets white text over `theme.color`; white on
 * this green measures 7.4:1. The dark arm (the revision's amber, #d08a3e)
 * measures ~2.5:1 under white text — never hand it to a surface that renders
 * white on top of it.
 */
export const ACCENT_GOLD_LIGHT = "#2e5c4f";
