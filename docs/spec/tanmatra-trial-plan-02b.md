# 3-Day Taste Test — Amendment 02b

**Date:** 2026-07-21 · **Layers onto:** Amendment 02 §2/§5/§7, 02a menus, Agent Brief §3 · **Decision: add it.** Rationale and mechanics below; every number is decided, not suggested.

> Transcribed into the repo from the Google Doc source (`19_8HJR-RFYyWrMBsUREJGUoW56-xlx6Wctvd-ydfVAU`) on 2026-07-22.

## 1. Why it exists

The commitment ladder has a hole: single dish (₹199–269) → *nothing* → weekly (₹1,199) → monthly (₹4,378). Food is an experience good — taste, portion, and delivery reliability cannot be evaluated from a PDP — and the Zomato-habituated user needs a structured, low-risk excuse to try direct. The trial is that excuse. The design constraint: it must be a **conversion instrument, not a discount**, or it re-trains the 39–83% discount reflex the whole strategy exists to escape.

## 2. The offer

**3-Day Taste Test — ₹399 for three weekday lunches, credited back in full if you start any plan within 7 days of the trial ending.**

- Effective ₹133/meal against a ₹597 plan-value / ~₹700 retail basket. The anchor line: **"Three lunches for the price of one delivery-app order."**
- The creditback is what makes it honest rather than cheap: the deep effective discount only fully materializes for people who become subscribers — where LTV pays for it. It is stated upfront in one sentence with zero hidden conditions (§2.6): *"₹399 now. Credited in full when you start any plan within 7 days."*

**The elegant proof the math is sound:** trial ₹399 + weekly-with-credit ₹800 = **₹1,199 — exactly the weekly price.** A trialist who converts to weekly spends identically to someone who skipped the trial. Cannibalization cost on weekly conversions is structurally zero; the trial is a free option embedded inside the weekly price. Monthly conversion: ₹4,378 − ₹399 = ₹3,979 first month (a 9% first-month effect — cheaper than any coupon Zomato has ever extracted).

**Worst case bounded:** a non-converting trialist costs ₹198 of absorbed value (₹597 − ₹399). At a 35% conversion rate, blended CAC ≈ ₹129 per acquired subscriber. Aggregators charge multiples of that per order, forever.

## 3. Mechanics

**Contents.** Three consecutive weekday lunches, curated "greatest hits" trio per track — no swaps, no customization. Veg: BBQ Paneer Fiesta Bowl → Paneer Tikka Burrito Wrap → Alfredo Veg. Non-veg: BBQ Grilled Chicken Bowl → Chipotle Chicken Wrap → Alfredo Chicken. Egg track via the imported 3-Egg SKU once RD-signed. Customization is deliberately a *plan* feature — one more reason to convert.

**Eligibility & abuse.** One per phone number, ever — enforced server-side on the OTP identity; address-fingerprint as soft secondary flag. New customers only (no prior paid plan). The ₹399 upfront payment is itself the primary abuse filter: hoppers don't pay.

**Flow.** PIN serviceability gate first (§2.1) → track pick → any-weekday start, next-day earliest → UPI-first, meal card accepted (the trial doubles as the meal-card rail's proving ground) → confirmation states exactly what happens: three deliveries, then it ends.

**It does not auto-convert.** No silent rollover, no mandate captured at trial. The trial ends; continuing is an explicit one-tap act with credit auto-applied. This is a deliberate heterodoxy against growth-hacking convention, and it is the brand: in a market where every subscription is a trap, "it just ends" is a differentiator, a refund-drama eliminator, and §2.6 made mechanical. We accept losing lazy conversions to gain the trust that direct commerce runs on.

**Conversion window.** Credit valid 7 days post-trial. Nudges capped at two digital touches: Day-3 evening WhatsApp ("Start Desk Fuel — your ₹399 is applied → first month ₹3,979", one tap) and a Day-6 reminder. Plus one physical insert card in the Day-2 box — kitchen-side, nearly free, and the highest-trust surface we own.

**Recovery.** Failed or unacceptable delivery: that meal's share (₹133) refunded or a day extended, customer's choice, money status stated first (§13).

**Exclusions.** GLP-1 Companion has no trial (clinical positioning, RD-gated; its entry mechanic is the intro month). Teams gets a sales-led 10-seat, 1-week pilot instead — separate motion, not this SKU.

## 4. Funnel placement (anti-cannibalization rules)

Trial appears as the **secondary** action on plan cards and the plan-builder entry ("Try 3 days first — ₹399"); it is the default re-engagement framing for plan-review abandoners on their next visit. It **never** appears: in an active plan checkout (no downselling a converting user), to current or past subscribers, or as a homepage primary CTA (§2.3 — the hero sells the plan, not the hedge).

## 5. Metrics & guardrails

Leading: menu→trial-start rate (new J1 variant in the benchmark framework) · trial completion ≥90% (delivery ops proof) · **trial→paid conversion ≥35% by day 10, stretch 45%**. Guardrails: direct weekly/monthly starts must not drop >10% post-launch (cannibalization watch — the weekly math predicts ~0, verify it) · trial cohort margin floor: absorbed value ≤ ₹198/non-converter by construction · one-per-phone enforcement verified by attempted-repeat rejections in logs.

## 6. Build placement

**Rebuild Phase 2 only — never the old build.** A trial's entire purpose is a first impression; serving it through a frontend whose multi-step flows fail 100% of the time would spend real demand on the exact experience we're replacing. The trial launches wrapped in the rebuilt money path, chips, photography, and copy system that make three lunches convert into a plan.
