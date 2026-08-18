# Tanmatra (Wellness Foods) — Premium iOS-Grade Refactor Plan

## Step 1: Environment Setup & Codebase Audit — COMPLETE

### Repository
- Real source: private repo `chan8822/Wellness-Foods` (the public `https-github.com-chan8822-Wellness-Foods` is a partial mirror missing `lib/`).
- Full monorepo migrated into this workspace: storefront, API server, and all 8 shared `lib/` packages (including the real `menu-catalog` dish data).

### Tech stack (verified running)
| Layer | Technology |
|---|---|
| Storefront (`artifacts/tanmatra`) | React 19 + React Router v7 (SSR) + Vite 7, TypeScript |
| Styling | Tailwind CSS v4, shadcn/Radix UI |
| Motion | Framer Motion (installed) |
| State / data | TanStack React Query, Zustand, React contexts (`cartContext`, `ordersContext`, `preferencesContext`), socket.io client |
| Fonts | Inter Variable, Instrument Serif, JetBrains Mono |
| Backend (`artifacts/api-server`) | Express + Drizzle ORM + PostgreSQL + Zod; Socket.IO at `/api/socket.io` |
| Shared libs | `menu-catalog` (dish data + nutrition calc), `preferences-match`, `api-client-react`, `api-zod`, `db`, `integrations-gemini-ai` |

### Current status
- `pnpm install` clean; full typecheck passes.
- DB schema pushed to the workspace Postgres; API healthy (`/api/healthz` → ok).
- Storefront renders end-to-end with the real dish catalog (dark "Tanmatra Clinical Nutrition" brand, mobile bottom-nav shell already present).
- Known pre-existing quirks to address during refactor: a React hydration mismatch on the home loader element; `VITE_GOOGLE_MAPS_API_KEY` unset (map picker falls back to manual address entry); `REDIS_URL` unset (background jobs skipped — fine for dev).

### Money-path files (refactor targets)
- Discovery: `src/pages/Menu*`, `src/components/menu/*`, home (`V2Home`)
- Product details: `src/pages/Dish.tsx`, `src/components/dish/*`
- Cart: `src/pages/Cart.tsx`, `src/components/cart/*`, `src/lib/cartContext.tsx`
- Checkout: `src/pages/Checkout.tsx`, `src/components/checkout/*`
- Shell: `src/components/layout/*`

## Step 2 — "Premium iOS-Grade" design system — COMPLETE
- `src/index.css` tokens: elevation shadow scale (`--shadow-raised/overlay/sheet`, soft & layered), `--radius-sheet: 24px`, `--ease-spring` (iOS sheet curve), fixed `--font-serif` (Instrument Serif was referenced but never defined) and variable-font family names.
- Defined the previously-dead `hover-elevate` / `active-elevate-2` overlay utilities + new `press-spring` scale-down press state (reduced-motion safe).
- `Button`/`Input`: 44px minimum tap targets on touch (`pointer-coarse:`), compact density preserved on desktop pointers; radius tokens applied.
- `Drawer` (vaul) + bottom `Sheet`: 24px top radius, grab handle, safe-area bottom padding — the shared bottom-sheet primitive for Step 3.
- `text-wrap: balance` on headings; glass header/bottom-nav already present and kept.
- Fix: dev API base now same-origin `/api` through the workspace proxy (was hardcoded Cloud Run URL → CORS failures in preview).

## Step 3 — CUJ / Money-path CRO — ✅ COMPLETE
Audit result: most CRO items already existed in the live `tanmatra-v2/` routes; Step 3 was a
gap-fill, not a rebuild. (Note: live routes are `src/tanmatra-v2/*`, not `src/pages/*` or `stitch/*`.)

1. **Discovery (`Menu.tsx`)** — pre-existing: swipeable category pills, skeleton loaders with CLS
   reservation, one-tap Quick Add with state lifecycle, social-proof line. *Deliberately skipped:*
   bestseller tags / star ratings — app honesty rule forbids fabricated ratings; reviews are
   server-verified only.
2. **Product details (`Dish.tsx`)** — pre-existing: edge-to-edge hero, sticky Add-to-Cart bar,
   nutrition accordion. **Added:** trust-signal row near CTA (Fresh in 25–40 min · FSSAI-licensed
   kitchen · RD-designed — all claims real, licence matches footer); customization sheet aligned to
   design tokens (`--radius-sheet` 24px top corners + grab handle). Same alignment applied to the
   Menu quick-customize sheet (+ safe-area bottom padding).
3. **Cart & Checkout** — pre-existing and verified: slide-out cart drawer (no route change) with
   free-delivery progress bar incl. projected "ghost item" fill, express UPI + full-width checkout
   CTA with loading state, 3-step stepper (Review/Delivery/Payment), digit-only auto-restricted
   phone/OTP/pincode inputs with live pincode serviceability feedback, double-tap re-entry guard on
   payment.
4. **Verified:** typecheck clean; Playwright e2e (mobile 402×874) passed the full money path —
   menu → quick-add → drawer → free-delivery unlock at ₹500 → checkout stepper → PDP trust strip →
   sticky-bar add. Known benign console noise: `#__tanmatra-loader` hydration warning (Step 4 item),
   `VITE_GOOGLE_MAPS_API_KEY` unset in dev, stray 401s from optional authed endpoints when logged out.

## Step 4 — Final polish — ✅ COMPLETE
- **Optimistic add-to-cart** — pre-existing (instant local cart updates + AddToCartButton
  idle→loading→success lifecycle); verified in Step 3 e2e, no changes needed.
- **Empty-cart state** — cart drawer empty state now guides instead of dead-ending: "Start with
  these" starter picks (3 real RD-verified dishes from the catalog — no fabricated "bestseller"
  claims) with thumbnails, prices, one-tap Add (tracked as `empty_cart_starter_add`), plus a
  "Browse full menu" secondary action.
- **Inline validation** — guest checkout OTP: failed/short codes now show an inline error line
  (`role="alert"`, `aria-invalid`, red border) with a reduced-motion-safe shake animation
  (`.animate-shake` in index.css) instead of toasts; phone input shows a green success check +
  border at 10 digits. Address pincode already had live inline serviceability feedback.
- **Loader flicker / hydration fix** — removed the premature `__clearTanmatraLoader()` call from
  `entry.client.tsx` (it mutated the splash's class before hydration committed, causing the
  hydration-mismatch warning on every page load). Root's post-mount `useEffect` clears the splash;
  the inline script's 15s auto-dismiss remains as fallback. e2e confirmed: loader removed from DOM
  after hydration, no mismatch warning in console.
- **Verified:** typecheck clean; Playwright e2e (fresh context, mobile 402×874) passed: no
  hydration warning, splash cleared, empty-drawer starter picks render and add to cart correctly.

## Constraints
- UI-layer refactor only — backend, API contracts, and database logic remain untouched.
