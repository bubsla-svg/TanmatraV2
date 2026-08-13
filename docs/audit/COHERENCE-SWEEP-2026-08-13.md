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
