/**
 * DEFECT-CHANGE-PLAN-PRICING-001 — find subscriptions billing a price the plan
 * catalog does not justify.
 *
 *   pnpm --filter @workspace/scripts run audit-subscription-pricing
 *
 * WHY THIS EXISTS. `POST /subscriptions` prices from the plan catalog;
 * `POST /subscriptions/:id/change-plan` still reprices with
 * `computeDeliveryPricePaise`, the retired per-meal helper. A change-plan on a
 * plan-v2 subscription therefore overwrites `price_per_delivery_paise` with a
 * legacy figure several times the catalog price, and the autopay mandate then
 * charges that. This tells you whether that has actually happened to anyone, or
 * whether the defect is still latent.
 *
 * READ-ONLY. It writes nothing. Remediation is deliberately a separate decision:
 * the right correction for an overcharged row depends on whether the customer
 * was already billed, which this cannot know.
 *
 * WHAT IT CAN AND CANNOT PROVE
 *
 * The diet `track` is NOT persisted on the subscription, and it changes the
 * catalog price (veg / egg / nonveg are priced separately). So the audit cannot
 * derive THE expected price for a row — it derives the SET of prices that would
 * be legitimate for that plan and cadence across every track, plus any
 * plan-review add-on the row carries, and flags a row only when its price
 * matches none of them. That direction is deliberate: it under-reports rather
 * than crying wolf, so anything it flags is worth a human look.
 *
 * Rows are classified, not merely counted:
 *
 *   LEGACY_FORMULA  the price equals computeDeliveryPricePaise(cadence, meals)
 *                   exactly. That is the change-plan defect's fingerprint —
 *                   near-certain evidence, not a guess.
 *   UNEXPLAINED     the price matches no catalog track and no legacy formula.
 *                   Could be a manual edit, an older pricing model, or
 *                   something else. Needs eyes.
 *   OK              the price matches a catalog track (± plan-review add-ons).
 */

import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  subscriptionsTable,
  subscriptionAddonsTable,
} from "@workspace/db";
import {
  ADD_ONS,
  PLAN_CATALOG,
  computeDeliveryPricePaise,
  computePlanQuote,
  type PlanId,
} from "@workspace/subscription-rules";

const PLAN_V2_NOTE_PREFIX = "plan_v2:";
const TRACKS = ["veg", "egg", "nonveg"] as const;

/** Same extraction the route uses — `plan_v2:<id>` or `plan_v2:<id> — <rest>`. */
function planIdFromNotes(notes: string | null): PlanId | null {
  if (!notes) return null;
  const idx = notes.indexOf(PLAN_V2_NOTE_PREFIX);
  if (idx === -1) return null;
  const token = notes.slice(idx + PLAN_V2_NOTE_PREFIX.length).split(/[\s—]/)[0]?.trim();
  return token && token in PLAN_CATALOG ? (token as PlanId) : null;
}

type Verdict = "OK" | "LEGACY_FORMULA" | "UNEXPLAINED";

interface Row {
  id: number;
  userId: string;
  planId: PlanId;
  cadence: string;
  mealsPerDelivery: number;
  pricePaise: number;
  expected: number[];
  legacyPaise: number;
  verdict: Verdict;
  status: string;
}

async function main(): Promise<void> {
  const subs = await db
    .select({
      id: subscriptionsTable.id,
      userId: subscriptionsTable.userId,
      cadence: subscriptionsTable.cadence,
      mealsPerDelivery: subscriptionsTable.mealsPerDelivery,
      pricePaise: subscriptionsTable.pricePerDeliveryPaise,
      notes: subscriptionsTable.notes,
      status: subscriptionsTable.status,
    })
    .from(subscriptionsTable);

  const planV2 = subs
    .map((s) => ({ ...s, planId: planIdFromNotes(s.notes) }))
    .filter((s): s is typeof s & { planId: PlanId } => s.planId !== null);

  // Plan-review add-ons (rd_bump) are folded into pricePerDeliveryPaise at
  // create, so a row carrying one legitimately prices above the bare plan.
  const addOnBySub = new Map<number, number>();
  if (planV2.length > 0) {
    const rows = await db
      .select({
        subscriptionId: subscriptionAddonsTable.subscriptionId,
        addonId: subscriptionAddonsTable.addonId,
        pricePaise: subscriptionAddonsTable.pricePaise,
      })
      .from(subscriptionAddonsTable)
      .where(
        and(
          inArray(subscriptionAddonsTable.subscriptionId, planV2.map((s) => s.id)),
          eq(subscriptionAddonsTable.active, true),
        ),
      );
    for (const r of rows) {
      if (ADD_ONS[r.addonId as keyof typeof ADD_ONS]?.attachPoint !== "plan_review") continue;
      addOnBySub.set(r.subscriptionId, (addOnBySub.get(r.subscriptionId) ?? 0) + r.pricePaise);
    }
  }

  const findings: Row[] = [];
  for (const s of planV2) {
    const planReviewAddOns = addOnBySub.get(s.id) ?? 0;
    const expected = TRACKS.map((track) => {
      try {
        return computePlanQuote(s.planId, track, s.cadence as never).cycleTotalPaise + planReviewAddOns;
      } catch {
        return Number.NaN;
      }
    }).filter((n) => Number.isFinite(n));

    let legacyPaise = Number.NaN;
    try {
      legacyPaise = computeDeliveryPricePaise(s.cadence as never, s.mealsPerDelivery);
    } catch {
      /* cadence the legacy helper never knew — leave NaN */
    }

    const verdict: Verdict = expected.includes(s.pricePaise)
      ? "OK"
      : s.pricePaise === legacyPaise
        ? "LEGACY_FORMULA"
        : "UNEXPLAINED";

    if (verdict !== "OK") {
      findings.push({
        id: s.id,
        userId: s.userId,
        planId: s.planId,
        cadence: s.cadence,
        mealsPerDelivery: s.mealsPerDelivery,
        pricePaise: s.pricePaise,
        expected,
        legacyPaise,
        verdict,
        status: s.status,
      });
    }
  }

  const rupees = (p: number) => `₹${(p / 100).toLocaleString("en-IN")}`;

  console.log("DEFECT-CHANGE-PLAN-PRICING-001 — subscription pricing audit");
  console.log("=".repeat(70));
  console.log(`subscriptions scanned:        ${subs.length}`);
  console.log(`carrying a plan_v2 tag:       ${planV2.length}`);
  console.log(`priced as the catalog allows: ${planV2.length - findings.length}`);
  console.log(`FLAGGED:                      ${findings.length}`);

  const legacy = findings.filter((f) => f.verdict === "LEGACY_FORMULA");
  const unexplained = findings.filter((f) => f.verdict === "UNEXPLAINED");
  console.log(`  · LEGACY_FORMULA (change-plan fingerprint): ${legacy.length}`);
  console.log(`  · UNEXPLAINED:                              ${unexplained.length}`);

  if (findings.length > 0) {
    console.log("");
    for (const f of findings) {
      const over = f.expected.length > 0 ? f.pricePaise - Math.max(...f.expected) : 0;
      console.log(
        `[${f.verdict}] sub #${f.id} (${f.status}) user=${f.userId} plan=${f.planId}/${f.cadence} meals=${f.mealsPerDelivery}`,
      );
      console.log(
        `    billing ${rupees(f.pricePaise)}  ·  catalog allows ${f.expected.map(rupees).join(" / ") || "(none)"}` +
          (over > 0 ? `  ·  OVER by ${rupees(over)}` : ""),
      );
    }
    console.log("");
    console.log(
      legacy.length > 0
        ? "ACTION: LEGACY_FORMULA rows were repriced by change-plan and are billing the retired\n" +
            "        per-meal figure. Check whether their mandates have already charged before\n" +
            "        deciding between correction and refund."
        : "ACTION: no change-plan fingerprints. Review UNEXPLAINED rows individually.",
    );
  } else {
    console.log("");
    console.log("No mispriced plan-v2 subscriptions found — the defect is latent here.");
  }

  process.exit(0);
}

await main();
