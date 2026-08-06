# Layout Contracts

> P0 §24 deliverable. Baseline SHA `3aea38dc` (`main`, 2026-08-06).
> Machine-readable companion: [`layout-assignments.json`](./layout-assignments.json).

**Contract status: FAIL.** This is the finding that determines the P0
verdict: *"Layout ownership remains imperative or ambiguous"* is an explicit
NO-GO trigger, and it is true on this SHA.

## 1. What P0 §9 asks for

A structural partition — `app/(global|focus|b2b)/` route groups — so that
which chrome a route gets is a property of *where its file lives*, not of a
runtime pathname check that can silently drift from the file tree.

## 2. What is actually shipped

**Zero route groups. One root layout** (`app/layout.tsx`, 292 lines). Shell
selection happens at render time, through three nested client components,
each independently checking `usePathname()`:

```tsx
<InternalSurfaceGate>
  <FocusChromeGate>
    <B2BChromeGate>
      <Header />
    </B2BChromeGate>
  </FocusChromeGate>
</InternalSurfaceGate>
...
<InternalSurfaceGate>
  <FocusChromeGate>
    <B2BChromeGate>
      <MiniCartBar />
      <Footer />
      <MobileBottomNav />
    </B2BChromeGate>
  </FocusChromeGate>
</InternalSurfaceGate>
```

Evaluation order is first-match-wins: **internal → focus → B2B → global
chrome**. Three matchers decide it:

| Gate | Matcher | Source of truth |
|---|---|---|
| `InternalSurfaceGate` | `isInternalSurface()` | `lib/internalSurfaces.ts` — boundary-aware (`path === route \|\| path.startsWith(route + "/")`) |
| `FocusChromeGate` | `isFocusRoute()` | `lib/focusRoutes.ts` — boundary-aware, unit-tested (`focusRoutes.test.ts`) |
| `B2BChromeGate` | `isB2BRoute()` | `components/B2BLayout.tsx` — **not** boundary-aware, **not** unit-tested |

A gate returning `null` un-renders everything nested inside it — this is
chrome *subtraction* from one shared tree, not chrome *selection* between
alternative trees. `FocusLayout.tsx`'s own header names why: its predecessor,
`ChromeGate`, silently decayed — `layout.tsx` imported it but stopped
rendering it, and its hardcoded route set no longer matched any real page.
Nothing asserted "this wrapper is actually in the tree." The same failure
mode is available to all three gates today; only `focusRoutes.test.ts` unit-
tests its matcher.

## 3. This is a second, unrelated mechanism from the dark-canvas script

`app/layout.tsx` also inlines two `beforeInteractive` scripts
(`STITCH_ROUTE_SCRIPT`, `FOCUS_ROUTE_SCRIPT`) that read `location.pathname`
directly and stamp `data-stitch="dark"` on `<html>` / `data-focus-route="true"`
on `<body>` before hydration, to avoid a flash of the wrong theme or padding.
**These scripts do not un-render anything.** They are a CSS-attribute
mechanism, independent of the three React gates above, serialising the same
`FOCUS_ROUTES`/`INTERNAL_ROUTES` arrays (so it can't drift from the gates) plus
its own `STITCH_EXACT_ROUTES`/`STITCH_PREFIX_ROUTES` list. Do not conflate the
two: a route can be `data-focus-route="true"` (padding override) while still
rendering full global chrome, if it's dark-canvas but not gate-matched — in
practice every stitch route in this tree also happens to be focus-matched, but
the two lists are not the same list and nothing enforces that they stay
aligned.

## 4. Totals (computed, not asserted)

| Shell | Routes | What renders |
|---|---:|---|
| `global` | 38 | Full Header + Footer + MobileBottomNav + MiniCartBar |
| `focus` | 10 | No chrome — dedicated conversion flow (`/checkout`, `/login`, `/trial`, `/custom-build`, `/quick-setup`, `/dish/*`, `/plan/*`, `/order/confirmed/*`, `/marketplace/*`, `/corporate/invite/*`) |
| `b2b-chrome-suppressed` | 10 | **No chrome, and nothing replaces it** |
| `internal` | 0 | (`/admin` matches, but `/admin` is not a storefront route — it lives in the legacy SPA) |

## 5. Defects

### 5.1 The "B2B shell" is not a shell — HIGH

`B2BChromeGate`'s own comment claims *"applies a B2B-specific theme/header
override... the B2B layout will render its own specialized chrome."* It does
not. It only subtracts the global chrome; nothing fills the gap. Checked by
grepping for header/nav usage inside every B2B page directory
(`app/corporate`, `app/group`, `app/office-lunch`, `app/rd-partners`,
`app/partners`): none render one. **A visitor on any of the 10 B2B-classified
routes has no on-page way to navigate anywhere else in the app.**

This is exactly the "was this ever actually wired?" failure `FocusLayout.tsx`
warns about in its own comment, on a sibling gate that shipped the same
sentence describing a shell that doesn't exist.

### 5.2 `isB2BRoute` has a boundary bug — MEDIUM

```ts
// components/B2BLayout.tsx
pathname.startsWith("/corporate")   // no + "/" check
```

`isFocusRoute` and `isInternalSurface` both guard with
`path === route || path.startsWith(route + "/")`. `isB2BRoute` does not, so
`/corporate-wellness` — a standalone marketing page, not a member of the
`/corporate` family — matches the prefix and loses its chrome. Confirmed by
running the actual string: `"/corporate-wellness".startsWith("/corporate")`
is `true`.

### 5.3 No route-group partition — the P0 §9 trigger itself

The mechanism above works today because three lists (`FOCUS_ROUTES`,
`INTERNAL_ROUTES`, the inline `isB2BRoute` matcher) are kept in sync with the
`app/` file tree by convention, not by structure. Adding a new B2B page
requires remembering to edit `B2BLayout.tsx`; nothing fails the build if a
developer forgets — the route simply renders with full global chrome and
nobody is warned. This is precisely the kind of drift that produced the
Phase 13 clean-slate regression documented in
[`PHASE-13-RETRACTION.md`](../stitch/PHASE-13-RETRACTION.md).

## 6. What holds

- The focus/internal matchers are boundary-safe, unit-tested
  (`focusRoutes.test.ts`, referenced by `internalSurfaces.ts`'s own logic),
  and consistently reused by both the CSS-attribute script and the React
  gates — one registry, not two.
- Chrome subtraction is applied once, at the root, rather than scattered
  per-page — a page component cannot forget to opt out of chrome the way a
  per-route `layout.tsx` convention would allow.
- Zero-flash is genuinely solved for the dark canvas and the focus padding
  override: SSR renders the correct `data-*` attribute before first paint,
  confirmed by the design rationale for choosing a `beforeInteractive` script
  over `headers()` (which would force the whole app out of static
  rendering — measured at 50 → 2 statically prerendered routes).
