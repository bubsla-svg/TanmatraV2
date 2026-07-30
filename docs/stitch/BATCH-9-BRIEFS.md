# Batch 9 Route Briefs — Secondary Marketing & Standing Pages (G6)

> Reads `docs/stitch/BATCH-9-GROUNDING.md` first — every contract, defect fix,
> and inherited-vocabulary note below assumes that document. 11 routes, 7
> briefs (Decision 3 in `BATCH-4-5-SCOPE.md`: the four prose/marketing-story
> routes share one template brief, not four).

## Shared preamble — this batch inherits, it doesn't invent

Batches 1–3 built the landing kit (hero, `BenefitGrid`, `PlanCard`, chip
filters). Batch 4 built the dark-scope/glass-footer/money-CTA-discipline
vocabulary for anything money-adjacent. Batch 5 built the account-hub
status-badge/action-row shape. Batch 7 built the RD-directory card and
extended `ProtocolView`. Batch 8 built the image-led editorial card and the
long-form article shell (`LegalArticle`). **Every brief below names which of
those it inherits before describing anything new** — this batch's genuine
new territory is small: a marketplace product-card face, a document
masthead+TOC, and an accordion body variant.

```
"Brand_Vibe": "Premium Clinical Metabolic OS. Clean, appetizing, and empathetic. Not a
clinical textbook. Focus on food imagery and restrain from large text blocks",
"Design_System": {
  "Radii": "rounded-2xl cards, rounded-full pills/buttons/chips",
  "Color": "Token-only. bg-surface / bg-surface-raised / text-ink(-muted/-faint) /
    border-line / bg-gold (ALWAYS paired with text-[var(--gold-ink)], never white) /
    text-gold-text (decorative-only) / bg-sage-soft+text-sage-text (positive/complete
    signal ONLY — active membership, redeemed voucher, verified eligibility — never a
    caution, never decoration) / text-[var(--danger)] (errors, out-of-stock, destructive)",
  "Money": "tabular-nums on every numeral. formatPaise is the only source of a rupee
    figure — never a hand-typed price."
}
```

**Money-adjacent screens (`premium`, `vouchers`, `subscription/bridge`)
inherit Batch 4's binding rule verbatim**: exactly ONE button per screen may
carry an amount, and only at the actual commitment moment; every other
button is a plain verb. Dark `data-stitch="dark"` scope + glass sticky footer
where there's a single terminal conversion action and real scrollable
content above it.

**Auth gate**: `marketplace/[slug]`'s buy flow, `premium`, `vouchers`, and
`subscription/bridge` are all session-gated at the point of action — a
signed-out visitor gets a one-line prompt + inline `PhoneAuth`, never a
redirect. `marketplace`, `marketplace/[slug]` browsing, `wellness`,
`performance`, `legal`, `legal/[slug]`, `faq`, and `about` are fully public.

---

## Brief 53 · `/marketplace` — the directory

**Route**: `app/marketplace/page.tsx` → `MarketplaceGrid.tsx` (client island).

**Inherits**: the category-chip-filter row idiom (Batch 3/8 pill pattern);
structurally closer to Batch 8's `RecipeCard` (image-top, content below,
stats under a hairline divider) than Batch 1's `DishCard` — simpler than
either, no rating/fit/byline signal to preserve.

**Data_Props_Required**: six category chips (`all/oils/sauces/supplements/
snacks/pantry`) drive a live-fetched grid of `MarketplaceItem`s — real
`name`/`description`/`pricePaise`/`weightLabel`/`image`/`badges`/
`rdVerified`/`stockQty`. Three real states: loading ("Loading pantry…"),
error ("Couldn't load the pantry."), empty ("No items on this shelf yet.")
— all honest text, no skeleton fabrication. Each card: image (with an
absolute `bg-sage` "RD-verified" badge only when `rdVerified` is true — real
per-item signal, not decoration) → name → 2-line-clamped description →
tabular price (+ weight, when present) → a "Quick Add" footer button.

**New territory**: the product-card face itself — image-led, no rating
stars, no byline. Give it real personality (texture/ingredient photography
framing) without inventing fields the data doesn't have.

**Must not do**: invent a 5th filter chip, a rating/review affordance, or a
"trending" section — none of that data exists on this route.

---

## Brief 54 · `/marketplace/[slug]` — the item PDP

**Route**: `app/marketplace/[slug]/page.tsx` → `MarketplaceItemView.tsx`.

**Inherits**: structurally mirrors the dish PDP's rhythm (hero image →
title/price header → quantity stepper → description → options → CTA
cluster) — same shape as brief 03's `/dish/[slug]`, with commerce-specific
sections (badges, delivery-mode toggle, `BundlePicker`, stock, return
footnote) standing in for the clinical sections. Real Razorpay money path.

**Data_Props_Required**: real `item` fields, a real `qty` stepper clamped to
`[1, min(20, stockQty)]`, a real delivery-mode toggle ("Ship separately" /
"Add to a recent order" → `BundlePicker`), a real `needsAuth` gate (401 →
inline `PhoneAuth`, resumes the purchase on verify), a real `placed`
confirmation state, a real `missing` (404) state, and — **this batch's fix**
— a real out-of-stock state: when `stockQty === 0`, both action buttons are
replaced by an honest "Currently out of stock" block, and the stock count
renders in `--danger`, not neutral ink. Preserve that branch exactly; don't
let the design pass reintroduce an always-active buy button.

**Must not do**: show a fake "X people bought this" or invented review
count — no such data exists on `MarketplaceItem`.

---

## Brief 55 · `/wellness` + `/performance` — the shared protocol shell

**Routes**: `app/wellness/page.tsx`, `app/performance/page.tsx` → both render
`components/protocol/ProtocolView.tsx` with `which="wellness"` /
`which="performance"` — **the same component, same visual shell, different
content config**. One design covers both routes structurally; the only
difference is the copy `PROTOCOL_CONFIG` feeds it.

**Inherits — almost everything**: the landing-kit hero (Batch 3), the exact
`BenefitGrid` component (Batch 3), `PlanCard` (shared by `/metabolic`,
`/care`, `/protocol` per its own doc comment), `RdCard` (Batch 7) reused
verbatim. This is a restyle pass over an already-coherent shell, not new
design.

**Genuinely new territory**: `ProtocolDishRail`'s protocol-specific badge
face (`protein g` / `fiber g` / `GI band` per protocol) — the one piece with
no existing card vocabulary to lean on.

**Hard constraint — `/clinical` shares this exact component and is NOT in
this batch's scope.** `ProtocolView.tsx` also serves `/clinical` (Batch 7
already touched it for that route; verified `/performance` unaffected at the
time). Any restyle here must be additive to what Batch 7 shipped for
`/clinical`, not a regression — in particular, the `{cfg.clinical && (...)}`
gated sage-tinted safety-disclaimer box must render unchanged when a future
`/clinical` pass revisits it. When wiring, diff against `/clinical`'s
rendered output before and after, not just `/wellness` and `/performance`.

**Data_Props_Required**: real `Promise.all([fetchMenu(), getRds()])` dish
rail + RD roster, both with honest empty states (no fabricated fallback
content), real spine-quoted `PlanCard` pricing (no network call, no
fabrication).

---

## Brief 56 · `/premium`

**Route**: `app/premium/page.tsx` (static shell) → `PremiumMembership.tsx`
(client island, real money path).

**Inherits from account-hub, not landing-kit** — this is a money/account
surface, not a lander. `components/account/SubscriptionCard.tsx` (Batch 5)
is the direct precedent: status-badge (`bg-sage-soft text-sage-text` for
"Active membership") + a bottom action row of plain text-link buttons for
state transitions (cancel/resume). `PremiumMembership` currently
reimplements that shape independently — the brief should point the design at
`SubscriptionCard`'s actual markup, not invent a new status-card language.

**Data_Props_Required**: real `me.pricePaise` (tabular, `formatPaise`), a
real `active` vs. not-yet-joined branch, real `rdConsultsUsedThisPeriod` /
`rdConsultsPerPeriod` tabular counter, a real 401 gate (**this batch's fix**:
now correctly wired on the *initial* load too, not just the mutating
actions) → inline `PhoneAuth`. Exactly one button carries an amount (`Join
Tanmatra Premium` is deliberately amount-free per the existing money-CTA
discipline — preserve that, don't add a price to it).

**The static `BENEFITS` shell** currently hand-duplicates `BenefitGrid`-style
card markup instead of importing the real `BenefitGrid` component (Batch 3)
— worth consolidating onto the real component during wiring if it's a clean
swap; otherwise style it to match `BenefitGrid`'s visual output without the
import. **This batch's fix removed a stale "worth ₹1,499" price claim** from
the RD-consult benefit row — the design must not reintroduce a specific
rupee figure there; describe the benefit without pricing it.

---

## Brief 57 · `/vouchers`

**Route**: `app/vouchers/page.tsx` (static shell) → `VoucherRedeem.tsx`.

**Inherits**: money-adjacent vocabulary (Batch 4) — dark scope + glass
sticky footer for the redeem action is a reasonable fit here (a single
terminal "Redeem" commitment moment over real scrollable content: wallet
balance + a real list of past vouchers). Already independently correct on
tabular numerals, gold-ink pairing, and island auth — restyle only.

**Data_Props_Required**: real parallel-fetched wallet balance
(`getWalletBalancePaise`) and voucher history (`getMyVouchers` →
`{purchased, redeemed}`), a real redeem form with typed error branches (401
→ inline `PhoneAuth`, 404 → "we couldn't find that code," 409 → "already
redeemed," other → generic retry), and a real success message built from the
server-returned `creditedPaise` — never a hardcoded figure. The Redeem
button is the one amount-bearing commitment moment on this screen; it stays
plain-verb ("Redeem"/"Redeeming…") per the money-CTA rule, which this route
already gets right.

---

## Brief 58 · `/subscription/bridge`

**Route**: `app/subscription/bridge/page.tsx` (static shell) →
`BridgeView.tsx`.

**This batch's fix is the data contract — the design must render all of it,
not just the happy path.** `BridgeView` no longer unconditionally claims a
credit; it now genuinely fetches `trialRecap()` and has five real states:
loading, `needs-auth` (401 → inline `PhoneAuth`), `not-found` (404), the
credit **verified and available** case (`ready`, the original two-card
layout: "Trial Complete" summary + "What unlocks" checklist + the single
gold CTA), and — the two states most likely to get skipped by a design pass
that only looks at a happy-path screenshot — an honest "we couldn't find
that trial" state and an honest "this credit isn't available anymore"
state (already converted/ended). **A Stitch generation only mocks one
screen; brief this explicitly so the wiring pass knows the other four states
exist and must not regress to a blank/default look.**

**Inherits**: Batch 4's dark-scope/glass-footer/money-CTA vocabulary is the
best fit here — this is exactly the "single terminal conversion action"
shape brief 23 (`/trial`) describes. The credit figure is
`formatPaise(TRIAL_CREDITBACK_PAISE)` — spine-sourced, tabular — never a
hand-typed rupee string. The `Ref: #{subscriptionId}` reference number is
tabular.

**Must not do**: re-add a rupee amount that isn't `TRIAL_CREDITBACK_PAISE`
formatted through `formatPaise`; re-introduce `text-white` on the CTA (the
one thing this batch's defect pass specifically fixed here); design a
countdown/hold-expiration timer or a deep-linked plan CTA — both are real
gaps but net-new functionality, explicitly deferred (see grounding doc).

---

## Brief 59 · `/legal`, `/legal/[slug]`, `/faq`, `/about` — the prose & marketing-story template

**Routes**: `app/legal/page.tsx` (index), `app/legal/[slug]/page.tsx` →
`LegalArticle.tsx`, `app/faq/page.tsx` → `FaqAccordion.tsx`,
`app/about/page.tsx` (fully bespoke).

One brief, three visual registers, per the grounding doc's finding that the
"one shared template" premise is true for two of the four and only partly
true for a third:

### 59a · Document register — `/legal`, `/legal/[slug]` (primary reference)

`LegalArticle.tsx` is the real prior art: back-link → title → "Last
updated" byline → dek → a `sections[]` loop (`h2` + optional body paragraphs
+ optional bullets) inside `max-w-3xl`. It also already gold-highlights any
literal `[ … ]` placeholder span (`withPlaceholders()`) — **preserve this
exactly**, it's how `content/legal/company.ts`'s still-unfilled fields
(grievance officer name, CIN, etc.) surface themselves honestly today; don't
let a redesign hide or silently fill them.

**New in this brief**: a **table-of-contents slot**, gated on length —
worth it for `terms` (20 sections) and `privacy` (16); skip it for
`refunds`/`shipping`/`disclaimer` (8–9) and `grievance` (6). `/legal` (the
index) doesn't currently import `LegalArticle` at all — it hand-copies the
masthead idiom; wiring should extract a shared masthead component both
`/legal` and `LegalArticle` use, fixing the drift rather than deepening it.

### 59b · Accordion register — `/faq`

`FaqAccordion.tsx` is a real `"use client"` widget: single-open-at-a-time
state, `aria-expanded` buttons, an animated chevron. **Do not flatten this
into the document register's `sections[]` shape** — the interaction model is
real and load-bearing. Same masthead idiom as 59a (currently hand-copied a
third time with drift: `max-w-2xl` instead of `3xl`, an extra eyebrow line)
— unify the width to `3xl` to match the other two document routes rather
than leaving FAQ narrower for no reason. `/faq` is also the only one of the
four emitting `FAQPage` JSON-LD — preserve that unconditionally.

**Known content issue, not a design decision**: `content/faq.ts`'s answer #9
contradicts the real refund policy (see grounding doc). The design brief
should render whatever copy is live at wiring time — reconciling the two is
an owner content decision, not something the design pass should paper over
by rewriting policy language.

### 59c · Marketing-story register — `/about` (the light exception)

`/about` shares essentially nothing structurally with 59a/59b: no
back-link/byline, no `sections[]` data source, a full step up in heading
scale (`text-4xl` vs. `text-2xl` elsewhere), and card-grid sections (hero →
mission → 3-step "How It Works" → ISO-22000 trust badge → 3-card "Our
Dietitian Experts" → closing CTA) rather than paragraphs. **Let it opt into
the shared type-scale and token palette only — don't force it into the
masthead-plus-`sections[]` shell.** Its own hero/section-grid composition is
correct as a structure; restyle within that structure using this batch's
`Design_System` spec (rounded-2xl cards, token colors, tabular where
numerals appear — the "1/2/3" step badges are the one place gold-fill +
gold-ink already appears correctly here, keep that pairing).

**This batch's fix**: each "Meet the team →" card now links to
`/rd/${d.slug}` (a real profile) instead of the generic `/rd` index, and the
link text names the specific dietitian. Preserve the per-card `href` and
label — a design pass that turns these back into a single "Meet the team"
button loses the fix.

---

## Generation log

All nine generated against project `9085082841997152511` ("Tanmatra
Storefront — Clinical Metabolic OS"), `GEMINI_3_1_PRO`, `MOBILE`, one at a
time via the same direct-MCP-over-HTTP curl technique Batches 3–8's
resolution sections document.

| Brief | Screen id | Title | Size | Banked at |
|---|---|---|---|---|
| 53 | `6fb6f0cb87c5483fb778a8f31b174d6d` | Pantry & Marketplace | 780×4126 | `route-53-marketplace/` (+3 hero-imagery) |
| 54 | `e87b6af3ac3b456d9f94de0b8ac5a176` | Artisan Olive Oil - Product Detail | 780×4506 | `route-54-marketplace-item/` |
| 55 | `8ab3637bac6149ba92aa1d1cff734a0b` | Performance Nutrition Protocol Landing | 780×7150 | `route-55-protocol/` |
| 56 | `565fcadb6fac4220b6970d25d48e5c9a` | Membership & Premium Status | 780×4362 | `route-56-premium/` |
| 57 | `70d8f3bbccbf4801a6037c5a93224460` | Redeem Voucher & Wallet Balance | 780×1768 | `route-57-vouchers/` |
| 58 | `d013db1af5e948d3805c9ac4f4931212` | Subscription Conversion Bridge | 780×2854 | `route-58-subscription-bridge/` |
| 59 | `9cbd6bc154124d9c825199c5022e5890` | Terms of Service Document | 780×4776 | `route-59-legal/` |
| 60 | `ac859a2636394d3fb0659329265cf323` | Frequently Asked Questions | 780×3270 | `route-60-faq/` |
| 61 | `beb6a44448594c0aaefe1e33bee2f6f9` | About Tanmatra - Brand Story | 780×7526 | `route-61-about/` |

Brief 59 asked for the `/legal` index and `/legal/[slug]` document "as one
deliverable" — Stitch banked a single screen (the document/`/legal/[slug]`
variant, matching `LegalArticle.tsx`'s real component). There is no separate
banked mock of the `/legal` index; wiring it means extrapolating the same
masthead/card idiom the document screen establishes, consistent with the
brief's own framing of `/legal` as "close to trivial" (33 lines).

**One hallucination**, invented global site chrome: Brief 56 (`/premium`)
generated a full sticky top app-bar (`<!-- Top Navigation (Shell structure
implied) -->`, a back-arrow button, a centered "Membership" title, a spacer)
**and** a fixed bottom mobile-nav bar (`<!-- Bottom Navigation -->`, four
fabricated links: Home/Metabolic/Premium/Profile) plus its mobile spacer div.
Exclude both entirely — the real page starts at the membership price card
inside `<main>`, and the real app's own `Header`/`BottomNav` render
elsewhere in the layout.

**Zero white-on-gold contrast violations** — checked every file for literal
`text-white` (only `route-58-subscription-bridge` contains it, exclusively
on `bg-dark-card` dark-surface text, never on the gold CTA) and cross-
checked every gold-filled button's actual applied classes against that
file's own color config: all nine resolve to a dark-ink pairing
(`on-background`/`on-primary-container`/`ink-on-gold`/`on-primary-fixed`,
values `#1a1c1e`/`#554300`/`#111318`/`#241a00`) on the gold fill
(`#d4af37`/`bg-clinical-gold`/`bg-brand-gold`). The cleanest token-compliance
result of any batch so far — no regression of the fix this batch made to
`BridgeView.tsx:48`.

No other file in this batch has any hallucinated chrome. `route-59`'s
`<nav>` is the real table-of-contents (anchor links `#section-01` etc.),
`route-53`'s `<nav>` is the real category-filter chip row, and the remaining
`<header>` tags are ordinary page-content masthead sectioning, consistent
with the precedent Batches 5 and 8 established for legitimate per-section
`<header>` usage.
