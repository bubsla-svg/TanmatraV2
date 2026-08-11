# Route and layout reconciliation

61 routes built (60 pages + 1 API route handler) across three App Router route
groups, verified against `pnpm --filter @workspace/storefront run build` (exit 0,
all 61 emitted). Layout ownership is structural (Next.js route groups), not a CSS
convention — verified by reading each group's `layout.tsx`.

## Layout ownership (confirmed against source, not assumed from the approved list)

| Layout | Route group | Chrome | Routes owned |
|---|---|---|---|
| `GlobalLayout` | `app/(global)/` | `Header`, `MobileBottomNav`, `Footer`, `MiniCartBar` | 39 |
| `FocusLayout` | `app/(focus)/` | **None** — "No global chrome, structurally: no Header, no MobileBottomNav, no Footer, no MiniCartBar. Each flow owns its full canvas and bottom edge." (verbatim source comment, `app/(focus)/layout.tsx`) | 12 |
| `B2BLayout` | `app/(b2b)/` | (not read in this pass — no defect surfaced against it) | 9 |
| *(root, no group)* | `app/` | — | 1 (`/api/build-info`, a route handler) |

The approved-list route/layout assignments in the sweep spec match the live tree
for every route checked in this pass (`/menu`, `/checkout`, `/trial`,
`/plan/[planId]`, `/custom-build`, `/corporate`, `/partners/gyms`, `/account`,
`/meal-planner`, `/vouchers`, `/premium`, `/clinical`, `/rd`, `/coach`, `/qa`,
`/auth→/login`, `/quiz→/quick-setup`, `/menu/[productSlug]`, `/order/confirmed/[orderId]`,
`/corporate/invite/[token]`) — no layout-ownership conflict found.

## Canonical-route rulings — verified, not assumed

| Ruling | Status |
|---|---|
| `/quick-setup` canonical, `/quiz` redirects | **Not independently re-verified this pass** — `/quiz` is not among the 61 built routes at all (no `app/**/quiz/page.tsx`); if a redirect exists it is middleware-level, outside this sweep's route inventory. Flagged NOT VERIFIED. |
| `/login` canonical, `/auth` redirects | Same as above — `/auth` is not a built route. NOT VERIFIED at the route-file level. |
| `/menu/[productSlug]` canonical, `/dish/[slug]` redirects | **Contradicted by source.** `/dish/[slug]/page.tsx` (FocusLayout) is a full, independent PDP implementation — `data-screen-id="5.5"`, its own hero/macro/accordion/buy-ledger markup — not a `redirect()` call. `/menu` itself (GlobalLayout) has no `[productSlug]` catch-all directory; menu items are presumably linked to `/dish/[slug]` directly. **This ruling does not match the live route tree**: there is no `/menu/[productSlug]` route to be canonical, and `/dish/[slug]` is the actual, only, non-redirecting PDP. Recorded as a ROUTE_RULING conflict — see `defects.md` DEF-RECON-ROUTE-RULING-001. |
| `/corporate` canonical, `/corporate-wellness` redirects | **Reversed from what's live — worse than a simple mismatch.** `/corporate/page.tsx` (20 lines, B2BLayout) is a **placeholder** (`PlaceholderPage`, "Clean slate placeholder pending implementation" — verbatim). `/corporate-wellness/page.tsx` (138 lines, B2BLayout) is the **substantive, real implementation** — neither calls `redirect()`. So the ruling declares the placeholder canonical and the real page an alias-to-redirect: exactly the case §25 warns against ("do not install redirects blindly if the approved destination is still a placeholder — migrate substantive content first, then enable the redirect"). `lib/nav.ts`'s `COMPANY_LINKS` sends users to `/corporate` (the placeholder) as "Corporate"; its Community group separately links `/corporate-wellness` (real) as "RD-designed team lunches for offices" right next to `/corporate` again as "Team lunches for your office" — so production navigation currently routes some clicks straight into a dead end. See `defects.md` DEF-RECON-ROUTE-RULING-001 (CRITICAL). |
| Mobile tabs: Home, Menu, Care, Account | **Not verified this pass** — `MobileBottomNav.tsx` was not read in full; flagged NOT VERIFIED, not assumed PASS. |

## Placeholder routes shipping in production (mechanical sweep, not sampling)

Every active route file was grepped for the literal `PlaceholderPage`/"Clean slate
placeholder" signature used consistently across this codebase's scaffolding (one
false-positive excluded: `/metabolic/page.tsx` only *mentions* this string in a doc
comment recounting its own fix history — verified by reading the match in context,
not just counting it). **5 routes are genuine, live, unimplemented placeholders**,
each returning HTTP 200 with only a title and "pending implementation" caption:

| Route | Layout | Reachable from live nav? |
|---|---|---|
| `/corporate` | B2BLayout | **Yes** — `lib/nav.ts` `COMPANY_LINKS` (see ruling conflict above) |
| `/corporate/[slug]` | B2BLayout | Only via a corporate invite/slug link, not general nav |
| `/team` | GlobalLayout | **Yes** — `lib/nav.ts` Community group ("Our team — Chefs & dietitians") |
| `/group/[code]` | FocusLayout | Only via a shared group-order link (not general nav) — see `service-authority-map.md` |
| `/office-lunch/[id]` | FocusLayout | Only via a generated office-lunch link, not general nav |

`/team/[slug]` (an individual profile page, 141 lines) exists **only in
quarantine** — the active `/team` index has no dynamic counterpart to link to even
if it were implemented. See `defects.md` DEF-RECON-PLACEHOLDERS-001.

**Per §25's operating rule** ("do not install redirects blindly if the approved
destination is still a placeholder — migrate substantive content first"): both
contradicted rulings above point at pairs where **both** sides are substantive,
live, non-placeholder pages, so the standing risk is reversed from the rule's usual
case — collapsing either pair to a redirect now would delete a fully-built page, not
skip a placeholder. This needs a product decision, not a mechanical fix.

## Dead internal links — computed, not sampled

Every `href` literal in the active (non-quarantine) storefront source was extracted
and checked against the 61 built page routes (dynamic segments matched
positionally). **9 distinct dead targets, all originating from `lib/nav.ts`** (the
single nav-config source `Footer.tsx`, `Header.tsx`, `AccountHub.tsx`, ⌘K, and
`MobileBottomNav.tsx` all read from):

| Target | Referenced from | Live route exists? |
|---|---|---|
| `/about` | `lib/nav.ts` (`COMPANY_LINKS`) | No |
| `/faq` | `lib/nav.ts`, `components/account/AccountHub.tsx` | No |
| `/legal/terms` | `lib/nav.ts`, `AccountHub.tsx` | No |
| `/legal/privacy` | `lib/nav.ts`, `AccountHub.tsx` | No |
| `/legal/refunds` | `lib/nav.ts` | No |
| `/legal/shipping` | `lib/nav.ts` | No |
| `/legal/disclaimer` | `lib/nav.ts` | No |
| `/legal/grievance` | `lib/nav.ts` | No |
| `/wellness` | `lib/nav.ts` (Track group) | No (see note below — `/account/wellness` is a *different*, live route) |

This means **every legal document and the About/FAQ company pages are dead links in
production** — reachable from the footer on every page of the site (`Footer.tsx`
renders all four `COLUMNS`, `Legal` among them, on desktop) and from
`AccountHub.tsx`. Content sources for the six legal docs already exist and are
unused (`lib/content/legal/{terms,privacy,refunds,shipping,disclaimer,grievance}.ts`
— confirmed present, confirmed zero route imports them). See `defects.md`
DEF-RECON-DEADLINKS-001 and `prebuilt-component-inventory.md` §C for the matching
quarantined route candidates.

47 other distinct internal link targets were checked and resolve to a live route —
not enumerated here as they are not defects.

## `/group/[code]` — placeholder in production

`app/(focus)/group/[code]/page.tsx` is, verbatim:

```
export default function PlaceholderPage() {
  return (... "Clean slate placeholder pending implementation." ...);
}
```

This is a **built route returning HTTP 200** with no functional content — exactly
the "route returning 200 is not evidence of completion" case the sweep spec warns
against. The full group-order lifecycle (`create`, `getGroup`, `addItem`,
`removeLine`, `closeGroup`) is implemented and tested on both the client
(`lib/groupOrdersApi.ts`) and server (`artifacts/api-server/src/routes/groupOrders.ts`,
5 endpoints) — only the join/host/cart/close/pay screen itself is missing. See
`service-authority-map.md` and `defects.md` DEF-RECON-GROUPORDER-001.

## Routes without `generateMetadata`/`metadata` export

`/` (home) and `/styleguide` build without a `metadata` export (Next.js falls back
to the root layout's default title). Not flagged as a defect — `/styleguide` is an
internal design-system reference page (Stitch 4.1/4.2), and `/` inherits the root
layout's metadata by design in many Next.js setups; recorded here only because §4's
normalized-manifest schema calls for the field to be checked, not assumed present.
