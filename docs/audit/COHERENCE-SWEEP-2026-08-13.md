# Coherence Sweep — 2026-08-13

**Method:** automated six-lens sweep of every sitemap route plus key flows, 390px
viewport, production build (`main` @ `186f701`), sandbox environment (no API on
`:4000`). Companion to `docs/NATIVE-FEEL-STOREFRONT-PLAN.md` Tier N5, which holds
the hand-audited commerce-flow findings this sweep extends to the long tail.

## The lenses

The absurdity catalogued in Tier N5 is not one defect — it decomposes into six
formally named species, each with a detection strategy:

| Lens | Named after | Automated? |
|---|---|---|
| Drip pricing | FTC-catalogued dark pattern | No — needs cart state; covered manually (N5.2) |
| Leaky abstraction | Spolsky | Yes — text scan: leading `_`, `1 <noun>s`, `(s)`, `undefined`/`NaN`/`[object`, `{{templates}}` |
| Garden-path copy | psycholinguistics | Partially — ALL-CAPS runs ≥4 words collected for human review |
| Occlusion | HCI | Yes — at scroll end, sample points inside bottom-anchored fixed/sticky chrome; report text stacked beneath |
| Affordance failure | Norman | Partially — content areas with zero internal links (navigational dead ends) |
| Ransom-note effect | desktop-publishing | Partially — en/em dash cohabitation, `~3g` vs `~3 g` unit-spacing cohabitation per page |

## Coverage — stated exactly

70 targets enumerated; **38 fully swept**. The sweep died at `/plan/steady`:
`ƒ`-rendered plan pages block on the API with **no fallback** and hung ~20s
each against the dead sandbox API until the run's time budget was consumed —
so every target after that point (including `/dish/*`, `/checkout`, `/account`,
`/login`) is **unswept here, not clean**. Those flows are precisely the ones
already hand-audited in Tier N5. The hang itself is finding N6.4 below.

## Findings

### N6.1 — Occlusion on `/legal` (new instance of the N5.1 class)

At scroll end, "Refund & Cancellation Policy — How cancellations, skips, and
refunds work" sits stacked beneath bottom-anchored chrome. Nobody eyeballed
`/legal`; the detector caught it anyway — which is the point. **Implication for
the N5.1 fix: scroll-end clearance is not a checkout one-off; it needs a shared
pattern (a bottom-bar primitive that reserves its own clearance) plus the
assertion in §"Gates" below.**

### N6.2 — Fifteen navigational dead ends

Routes whose content area renders **zero internal links**: `/marketplace`,
`/trial`, `/premium`, `/corporate-wellness`, `/recipes`, `/rd`,
`/partners/gyms`, `/challenges`, `/team`, `/custom-build`,
`/account/favorites`, `/meal-deals`, `/challenges/tracker`, `/qa`,
`/plan/desk_fuel`.

Detector caveat, stated honestly: it counts `<a href="/...">` only — pages
driven by `<button>` CTAs (auth islands, add-to-cart, funnel steps) score zero
while still offering actions. So split the list:

- **Funnel pages** (`/trial`, `/custom-build`, `/plan/desk_fuel`,
  `/account/favorites`) — button-driven; zero links is arguably by design,
  though a single "browse the menu instead" escape hatch would cost nothing.
- **Content pages** (`/team`, `/rd`, `/recipes`, `/qa`, `/challenges`,
  `/marketplace`, `/meal-deals`, `/premium`, `/corporate-wellness`,
  `/partners/gyms`) — a customer reads to the end and the page simply stops.
  These are true cul-de-sacs: no related content, no onward journey, global
  chrome as the only exit. IA fix per page: one contextual onward block
  (related dishes / the relevant plan / the next step), not a generic footer.

### N6.3 — Ransom-note dash cohabitation on 4 routes

`/`, `/metabolic`, `/corporate-wellness`, `/legal/refunds` each mix en- and
em-dashes in body copy. Extends N5.7's "one number formatter" to a one-line
copy rule: pick a dash convention (repo prose overwhelmingly uses em) and
sweep. Unit-spacing mix (`~3g` vs `~3 g`) appeared on **zero** swept routes —
that inconsistency is confined to the drawer/PDP pair already filed as N5.7.

### N6.4 — `/plan/[planId]` has no API-down story

`/menu` degrades gracefully (`FallbackMenuBanner`, fallback catalog). Plan
pages hang the request when the API is unreachable — in production that means
a slow-failing, blank-ish page during any API incident on the highest-intent
surface. Bring plan pages under the same fallback discipline as the menu, or
at minimum a fast, honest error state.

### N6.5 — The clean bills (redemption, measured)

- **Zero horizontal overflow** on all 38 swept routes — re-confirms N5-D5
  (the owner-device left-clip does not exist in this build) at breadth.
- **Zero leaky-abstraction hits** — no `_leaks`, no `1 meals`, no `(s)`, no
  `undefined`/`NaN` anywhere in swept text. The competitor-app failure class
  is absent from this storefront.
- **37/38 routes occlusion-free** at scroll end.
- ALL-CAPS inventory came back as the house kicker style (section labels),
  not garden-path constructions. (Known limitation: the regex misses runs
  broken by `&`, which is exactly how the one known garden-path title —
  N5-D4's disclaimer — escapes it. Filed manually; detector noted.)

**Verdict: the absurdity is concentrated, not endemic.** Four of six lenses
come back clean across the long tail; the density of defects sits in the
hand-audited commerce flow (drawer → PDP → cart → checkout) plus the IA
dead-end pattern. Redemption is therefore a short campaign, not a rewrite.

## Gates — how this stays fixed

This repo's tradition is that a defect class, once named, becomes a gate
(seven lint gates already exist). The lenses that automated cleanly should
graduate from this one-off sweep into permanent checks when the N5 fixes land:

1. **Occlusion assertion** (with the N5.1/N6.1 fix): e2e spec walking key
   routes, failing if text stacks beneath bottom-anchored chrome at scroll
   end. The detector from this sweep is the implementation.
2. **X-overflow assertion**: same walk, `scrollWidth === clientWidth` per
   route — pins N5-D5's class shut permanently.
3. **Text-lint** for the leaky-abstraction patterns over rendered routes —
   keeps the competitor's failure class permanently impossible here.

Run artefacts: sweep JSON in the session scratchpad; harness reproducible
from this document's lens table (single Playwright spec, ~120 lines).

---

## Addendum — corrections from rigorous re-verification (2026-08-13, same day)

Before acting on N6.1, both it and its sibling N5.1 (checkout, in the native-feel
plan) were re-tested with a real cart/form state and pixel-precise measurement,
per the standing practice of verifying a screenshot-sourced or sweep-sourced
finding against the tree before shipping a fix for it. **Both retract.** This
section documents why, because the *mechanism* of the false positive is more
valuable than either individual finding — it says something about this sweep's
detector, not just about these two pages.

### N6.1 retracted — the detector under-scrolled

`window.scrollTo(0, document.body.scrollHeight)`, called once, right after
navigation, can read `scrollHeight` **before late layout settles** (a font
swap, a hydrating client island growing the page) and land short of the
page's true bottom. On `/legal` this was exactly the failure: the original
sweep's single-shot scroll left `scrollY` short of `maxScrollY`. Re-run with
a scroll-*settle* loop (repeat `scrollTo` until `scrollHeight` stops
changing across two reads) and a corrected element selector (a `TreeWalker`
over text nodes — the original `el.children.length < 3` filter incorrectly
matched `<html>` itself, which has exactly two children), the true state at
`scrollY === maxScrollY` is:

- The "Refund & Cancellation Policy" heading sits at `top: -55, bottom: -31`
  — **entirely above the viewport**, scrolled past, not stacked under
  anything.
- The only bottom-anchored bar candidate (`MobileBottomNav`) reports
  `top: 812, translateHidden: true` at that scroll position — it has
  auto-hidden itself (the documented scroll-down hide behavior,
  `nav-contract.spec.ts`'s own contract), so it cannot be occluding text it
  isn't rendering into view.

No fix needed on `/legal`. The finding was the sweep's own scroll timing,
not the page.

### N5.1 retracted — same root cause, second surface

The native-feel plan's checkout finding was re-tested with a seeded cart,
the form filled exactly as the owner's screenshot showed (phone, address,
city, PIN — consent deliberately left unchecked), and a corrected
scroll-settle loop. Result: **positive clearance** — the consent checkbox
clears the fixed pay bar by 60px, the fine print by 13px, measured before
scroll even reached true maximum (so the true-max figures are larger
still). `AlacarteDetails.tsx`'s `pb-44` (176px) does exceed the bar's real
rendered height (103px) with room to spare, as designed. See
`docs/NATIVE-FEEL-STOREFRONT-PLAN.md` §2/§6 for the corresponding
retraction in that document — the engineering conclusion drawn from this
(a self-measuring clearance primitive is still worth building as
*hardening* against real fragility — long `blockedReason` text, large
accessibility font sizes — independent of today's reproduction, precisely
because a hand-guessed constant's correctness is coincidental, not
guaranteed) lives there, not here.

### N6.4 — mechanism confirmed, attribution corrected

The hang itself is real and was root-caused precisely, via a full network
trace: `api.fontshare.com` is unreachable in this sandbox and takes
**~12.8 seconds** to fail (`net::ERR_CONNECTION_RESET`), not the near-instant
refusal a dead local port gives. Since that stylesheet `@import` sits on
line 1 of `app/globals.css` — loaded on **every** route, not just plan
pages — it is what blocks the `load` event everywhere, including on routes
that degrade gracefully in every other respect (`/menu` included). The
original attribution ("`/plan/[planId]` has no API-down fallback") was
wrong: no plan-specific code path was ever implicated by the trace. This
is not a new defect — it is hard, specific, load-bearing evidence for
**N1.3** (already filed in the native-feel plan: self-host Satoshi instead
of the render-blocking Fontshare `@import`), upgraded from "font pop-in on
a cold connection" to "empirically measured 12.8-second render-blocking
hang when the font CDN is unreachable or slow" — exactly the degraded
real-device condition N1.3 already worried about, just worse than
originally scoped. N6.4 is retired as a standalone item; its evidence
moves to N1.3.

### What this changes about the gate proposals

Gate #1 (the occlusion assertion) is **not safe to add as originally
specified** — it would encode the same single-shot-scroll bug that produced
this false positive and could block legitimate merges. If/when it's built,
it must use the settle-loop, not a one-shot `scrollTo`. Gates #2 and #3 are
unaffected — neither depends on scroll timing.

### The honest summary

Two lenses out of six produced a false positive from a shared, now-understood
detector bug; one lens (occlusion) needs a methodology fix before it's
trustworthy enough to gate on. The other four lenses' clean bills (§N6.5)
are unaffected — they don't depend on scroll state at all. Net effect on
the sweep's verdict: the redemption story gets *stronger*, not weaker —
fewer real defects than originally reported, and the one still-standing
finding (N6.4's evidence) was already tracked under N1.3 before this sweep
ran.
