/**
 * Report every voucher that is spendable without a payment behind it.
 *
 * WHY THIS EXISTS
 * ---------------
 * Before #392, `POST /vouchers` accepted a client-supplied `amountPaise`
 * between Rs 100 and Rs 50,000, inserted the row with status "active", and made
 * no Razorpay call at all. `POST /vouchers/redeem` then turned that row into
 * real wallet credit. Any authenticated user could mint up to Rs 50,000 of
 * spendable money per request.
 *
 * #392 closed the door: a voucher is now born "pending_payment", only the
 * signature-verified capture in POST /vouchers/verify may write "active", and
 * redeem fails closed on anything else.
 *
 * IT DID NOT CLOSE THE ROWS THAT WERE ALREADY THROUGH IT. `redeem` gates on
 * `status = 'active'`, not on whether a payment exists — by design, because a
 * legitimately-paid voucher is exactly an active row. So any voucher minted
 * during the vulnerable window is still active, still redeemable, and
 * indistinguishable to redeem from a paid one. This script is what tells them
 * apart, and it is the only reason the fix is not the whole job.
 *
 * Run with:
 *   pnpm --filter @workspace/scripts run audit-vouchers
 *
 * Read-only. One SELECT, writes nothing — see the note on remediation below.
 *
 * THE SIGNATURE
 * -------------
 * A funded voucher carries `razorpay_order_id` (bound before checkout opens)
 * and, once verified, `razorpay_payment_id`. A free-minted one has neither and
 * never can: the columns were added by migration 0014, in the same change that
 * introduced the payment requirement, so a row predating it cannot have them.
 *
 *   status='active' AND razorpay_payment_id IS NULL   → never paid for
 *
 * `razorpay_order_id IS NULL` is reported separately as the stronger signal
 * (no gateway order was ever opened). A row with an order id but no payment id
 * is a different animal — checkout was opened and abandoned — which under the
 * current code would be left at pending_payment, so an ACTIVE one is a
 * pre-fix row too.
 *
 * REDEEMED ROWS MATTER MORE THAN ACTIVE ONES
 * ------------------------------------------
 * An unpaid voucher still sitting at "active" is money at risk. One that has
 * been redeemed is money already gone: redeem writes a credit_ledger row, and
 * that credit is spendable at checkout or may already have been spent. Those
 * are listed with their redeemer and the ledger delta so the loss is countable
 * rather than estimated.
 *
 * WHY THIS DOES NOT CANCEL ANYTHING
 * ---------------------------------
 * The tempting one-liner is `update vouchers set status='cancelled' where
 * status='active' and razorpay_payment_id is null`. Do not run it blind. Two
 * populations are caught by that predicate and only one of them is fraud:
 *
 *   - vouchers minted through the hole, and
 *   - vouchers issued deliberately by the business with no gateway payment:
 *     goodwill compensation. logisticsEngine writes exactly these
 *     (`purchasedByUserId: null`, message "Compensation for delay on Order
 *     #N"), and cancelling one takes back an apology already made to a customer
 *     who was already let down once.
 *
 * The report separates them on `purchased_by_user_id IS NULL` + the message
 * prefix, but the separation is a heuristic, not a proof, so the decision stays
 * with a human.
 */
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

type VoucherRow = {
  id: number;
  code: string;
  amount_paise: number;
  status: string;
  purchased_by_user_id: string | null;
  redeemed_by_user_id: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  message: string | null;
  created_at: Date | null;
  redeemed_at: Date | null;
  credited_paise: number | null;
};

const rupees = (paise: number): string =>
  `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

function ageInDays(d: Date | null, now: number): string {
  if (!d) return "?";
  return `${Math.floor((now - new Date(d).getTime()) / 86_400_000)}d`;
}

/** Goodwill vouchers are issued by the business, not bought — see header. */
function looksLikeGoodwill(r: VoucherRow): boolean {
  return (
    r.purchased_by_user_id === null &&
    (r.message ?? "").startsWith("Compensation for delay on Order #")
  );
}

async function main() {
  // Left join onto the ledger so a redeemed voucher reports the credit it
  // actually created, rather than the amount it claimed to be worth. Those can
  // differ, and the ledger is the one that spends.
  const result = await db.execute<VoucherRow>(sql`
    select v.id,
           v.code,
           v.amount_paise,
           v.status,
           v.purchased_by_user_id,
           v.redeemed_by_user_id,
           v.razorpay_order_id,
           v.razorpay_payment_id,
           v.message,
           v.created_at,
           v.redeemed_at,
           cl.delta_paise as credited_paise
      from vouchers v
      left join credit_ledger cl
        on cl.ref_type = 'voucher'
       and cl.ref_id   = v.id::text
     where v.status in ('active', 'redeemed')
       and v.razorpay_payment_id is null
     order by v.status desc, v.amount_paise desc, v.id
  `);

  const rows = (result.rows ?? result) as unknown as VoucherRow[];
  const now = Date.now();

  if (rows.length === 0) {
    console.log("No unpaid spendable vouchers. Every active or redeemed voucher");
    console.log("carries a razorpay_payment_id, so every one of them was paid for.");
    return;
  }

  const goodwill = rows.filter(looksLikeGoodwill);
  const suspect = rows.filter((r) => !looksLikeGoodwill(r));
  const redeemed = suspect.filter((r) => r.status === "redeemed");
  const active = suspect.filter((r) => r.status === "active");

  const sum = (rs: VoucherRow[], pick: (r: VoucherRow) => number) =>
    rs.reduce((t, r) => t + pick(r), 0);

  const print = (label: string, rs: VoucherRow[]) => {
    if (rs.length === 0) return;
    console.log(`\n${label} — ${rs.length} row(s)\n`);
    console.log(
      "  id      code            amount      age    gateway order    redeemed by",
    );
    console.log("  " + "─".repeat(78));
    for (const r of rs) {
      console.log(
        `  ${String(r.id).padEnd(7)} ${(r.code ?? "").padEnd(15)}` +
          ` ${rupees(r.amount_paise).padStart(11)}` +
          ` ${ageInDays(r.created_at, now).padStart(6)}` +
          `  ${(r.razorpay_order_id ?? "— none —").padEnd(16)}` +
          ` ${r.redeemed_by_user_id ?? ""}`,
      );
    }
  };

  console.log("UNPAID SPENDABLE VOUCHERS");
  console.log("Signature: status in (active, redeemed) AND razorpay_payment_id IS NULL\n");

  print("ALREADY REDEEMED — money is out the door", redeemed);
  print("STILL ACTIVE — money at risk, redeemable right now", active);
  print("LIKELY GOODWILL — issued by the business, NOT a hole (review, do not bulk-cancel)", goodwill);

  const creditedOut = sum(redeemed, (r) => r.credited_paise ?? r.amount_paise);
  const atRisk = sum(active, (r) => r.amount_paise);

  console.log("\n" + "─".repeat(80));
  console.log(`  Redeemed without payment : ${rupees(creditedOut).padStart(14)}  (already credited)`);
  console.log(`  Active without payment   : ${rupees(atRisk).padStart(14)}  (redeemable now)`);
  console.log(`  Goodwill (excluded)      : ${rupees(sum(goodwill, (r) => r.amount_paise)).padStart(14)}`);
  console.log("─".repeat(80));

  console.log("\nNEXT STEPS");
  console.log("  1. Anything under ALREADY REDEEMED is a credit_ledger entry that exists.");
  console.log("     Reversing it is a business decision, not a data fix — the customer may");
  console.log("     have spent it. Count it before you decide.");
  console.log("  2. Anything under STILL ACTIVE can be stopped by moving it to 'cancelled',");
  console.log("     which redeem already fails closed on. Do it per-row after checking each");
  console.log("     against the goodwill heuristic below, not with one blanket UPDATE.");
  console.log("  3. LIKELY GOODWILL rows are legitimate unpaid vouchers. The heuristic is");
  console.log("     purchased_by_user_id IS NULL plus the compensation message prefix, which");
  console.log("     is a guess and not a proof. Confirm before touching any of them.");

  // Non-zero so a cron or CI invocation surfaces rather than scrolling past.
  process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("audit-vouchers failed:", err);
    process.exitCode = 2;
  })
  .finally(() => {
    void db.$client?.end?.();
  });
