/**
 * Corporate meal subsidy — server-side authority over how much of an order the
 * employee's company pays.
 *
 * ## What was wrong
 *
 * The subsidy used to be a client-side subtraction plus a post-payment call to
 * `POST /me/company-subsidy/charge`. Three things followed from that:
 *
 *  1. The customer was charged GROSS. Checkout displayed `ledger.payable` (net
 *     of subsidy) and promised "you will be charged ₹X", but the gateway order
 *     was priced from `orders.charge_paise`, which never modelled the subsidy —
 *     so the card was debited the full amount while the screen said otherwise,
 *     AND the company was billed the subsidy on top. Total collected was
 *     gross + subsidy.
 *  2. The company charge was best-effort and fire-and-forget: a failed call
 *     lost the company's share silently behind a toast.
 *  3. `/charge` let a client name the amount to bill its own company, bounded
 *     only by the monthly budget and tied to no order at all.
 *
 * The tempting shortcut — let the gateway honour the client's smaller number
 * when the caller has budget left — is worse: it makes the client the source of
 * the billed amount, bounded only by the company's remaining budget. See the
 * corporate-member case in routes/payments.integrity.test.ts.
 *
 * ## How it works now
 *
 * The subsidy is part of the order's own price. `finalizeOrder` reserves it in
 * the SAME transaction that computes `charge_paise`, and writes charge_paise
 * already net. Every downstream consumer is then correct for free: the gateway
 * bills `charge_paise`, the webhook reconciles against `charge_paise`, and the
 * refund cap derives from `charge_paise` — so a refund can never return more
 * than the customer actually paid.
 *
 * The client sends no amount and performs no subsidy arithmetic. It sends at
 * most an INTENT (`applySubsidy`), because a member may want to save their
 * allowance for a bigger order. Intent is a client input; the amount never is.
 *
 * ## Reserve → commit, and why not just charge at pricing
 *
 * `company_budget_usage.spent_paise` is what `b2b/qbrDrafter.ts` reports to the
 * company as spend. If pricing wrote straight to it, every abandoned checkout
 * would inflate that number until someone noticed. So pricing only RESERVES;
 * the amount lands in spend when the payment is actually captured, and a
 * cancelled or unpaid order releases it.
 *
 * Reserving (rather than deferring the whole decision to capture) is what makes
 * the promise honest: the budget is committed the moment the customer is shown
 * a net price, so a second concurrent checkout cannot be promised the same
 * money and leave a captured payment with nothing behind it.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  companiesTable,
  companyBudgetUsageTable,
  companyMembersTable,
  companySubsidyChargesTable,
} from "@workspace/db";

/** The yyyy-mm budget period a moment falls in, in UTC. */
export function budgetPeriodMonth(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * The advisory-lock key guarding one employee's budget for one period.
 *
 * Every read-then-write of that budget must take it, or two concurrent
 * checkouts each read the same remaining balance and both reserve against it.
 * Shared with routes/corporate.ts so the two paths serialise against each
 * other rather than each against itself.
 */
export function subsidyLockKey(
  companyId: number,
  userId: string,
  period: string,
): string {
  return `subsidy:${companyId}:${userId}:${period}`;
}

/**
 * How much of `grossPaise` the company covers.
 *
 * Pure, so the clamping rules are testable without a database — they are the
 * part that decides real money:
 *   • never more than the employee has left this month (committed + reserved),
 *   • never more than the order is worth, so the card charge cannot go negative,
 *   • never negative, whatever nonsense the stored numbers hold.
 */
export function subsidyForOrderPaise(args: {
  monthlyBudgetPaise: number;
  /** Already landed in company_budget_usage for this employee/period. */
  committedPaise: number;
  /** Held by other orders that are priced but not yet captured. */
  reservedPaise: number;
  grossPaise: number;
  /** The member's intent. False means "don't spend my allowance on this one". */
  optIn: boolean;
}): number {
  if (!args.optIn) return 0;
  const budget = Math.max(0, Math.trunc(args.monthlyBudgetPaise));
  const used =
    Math.max(0, Math.trunc(args.committedPaise)) +
    Math.max(0, Math.trunc(args.reservedPaise));
  const remaining = Math.max(0, budget - used);
  const gross = Math.max(0, Math.trunc(args.grossPaise));
  return Math.min(remaining, gross);
}

export interface SubsidyReservation {
  companyId: number;
  paise: number;
  periodMonth: string;
}

/** Anything with drizzle's query surface — the real db or a transaction. */
type Queryer = Pick<typeof db, "select" | "insert" | "update" | "execute">;

/**
 * The caller's single active membership, or null.
 *
 * v1 is one company per user. `.limit(1)` with a deterministic order rather
 * than an arbitrary row, so a user who somehow has two active memberships gets
 * a stable answer instead of one that changes between the quote and the charge.
 */
async function activeMembership(tx: Queryer, userId: string) {
  const [row] = await tx
    .select({
      companyId: companiesTable.id,
      monthlyBudgetPaise: companiesTable.perEmployeeMonthlyBudgetPaise,
      overridePaise: companyMembersTable.perEmployeeBudgetPaiseOverride,
    })
    .from(companyMembersTable)
    .innerJoin(
      companiesTable,
      eq(companyMembersTable.companyId, companiesTable.id),
    )
    .where(
      and(
        eq(companyMembersTable.userId, userId),
        eq(companyMembersTable.status, "active"),
      ),
    )
    .orderBy(companiesTable.id)
    .limit(1);
  return row ?? null;
}

/** Committed spend + outstanding reservations for one employee/period. */
export async function budgetUsagePaise(
  tx: Queryer,
  companyId: number,
  userId: string,
  period: string,
): Promise<{ committedPaise: number; reservedPaise: number }> {
  const [usage] = await tx
    .select({ spentPaise: companyBudgetUsageTable.spentPaise })
    .from(companyBudgetUsageTable)
    .where(
      and(
        eq(companyBudgetUsageTable.companyId, companyId),
        eq(companyBudgetUsageTable.userId, userId),
        eq(companyBudgetUsageTable.periodMonth, period),
      ),
    );
  const [held] = await tx
    .select({
      paise: sql<number>`coalesce(sum(${companySubsidyChargesTable.paise}), 0)::int`,
    })
    .from(companySubsidyChargesTable)
    .where(
      and(
        eq(companySubsidyChargesTable.companyId, companyId),
        eq(companySubsidyChargesTable.userId, userId),
        eq(companySubsidyChargesTable.periodMonth, period),
        eq(companySubsidyChargesTable.status, "reserved"),
      ),
    );
  return {
    committedPaise: usage?.spentPaise ?? 0,
    reservedPaise: held?.paise ?? 0,
  };
}

/**
 * Reserve the company's share of one order. Call INSIDE the pricing
 * transaction, before charge_paise is persisted, and subtract the result.
 *
 * Returns null when there is nothing to reserve (no membership, opted out, no
 * budget left, or a zero-value order) — callers then bill the full amount.
 *
 * Takes the advisory lock, so it serialises against every other reservation and
 * against routes/corporate.ts. Note the lock is transaction-scoped: it is held
 * until the pricing transaction commits, which is exactly the window in which
 * charge_paise must stay consistent with what was reserved.
 */
export async function reserveSubsidyForOrder(
  tx: Queryer,
  args: {
    userId: string;
    /** orders.id — the serial, not the external order id. */
    serverOrderId: number;
    grossPaise: number;
    optIn: boolean;
    now?: Date;
  },
): Promise<SubsidyReservation | null> {
  if (!args.optIn || args.grossPaise <= 0) return null;
  const membership = await activeMembership(tx, args.userId);
  if (!membership) return null;

  const period = budgetPeriodMonth(args.now);
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${subsidyLockKey(membership.companyId, args.userId, period)}, 0))`,
  );

  const { committedPaise, reservedPaise } = await budgetUsagePaise(
    tx,
    membership.companyId,
    args.userId,
    period,
  );
  const paise = subsidyForOrderPaise({
    monthlyBudgetPaise:
      membership.overridePaise ?? membership.monthlyBudgetPaise,
    committedPaise,
    reservedPaise,
    grossPaise: args.grossPaise,
    optIn: true,
  });
  if (paise <= 0) return null;

  // onConflictDoNothing on the unique order_id: an idempotent finalize replay
  // must not stack a second reservation onto the same order.
  const inserted = await tx
    .insert(companySubsidyChargesTable)
    .values({
      companyId: membership.companyId,
      userId: args.userId,
      orderId: args.serverOrderId,
      periodMonth: period,
      paise,
      status: "reserved",
    })
    .onConflictDoNothing({ target: companySubsidyChargesTable.orderId })
    .returning({ paise: companySubsidyChargesTable.paise });

  if (inserted.length === 0) {
    // A reservation already exists for this order. Return ITS amount, not the
    // freshly computed one — charge_paise was derived from the original and the
    // two must not drift.
    const [existing] = await tx
      .select({
        paise: companySubsidyChargesTable.paise,
        periodMonth: companySubsidyChargesTable.periodMonth,
        companyId: companySubsidyChargesTable.companyId,
        status: companySubsidyChargesTable.status,
      })
      .from(companySubsidyChargesTable)
      .where(eq(companySubsidyChargesTable.orderId, args.serverOrderId));
    if (!existing || existing.status === "released") return null;
    return {
      companyId: existing.companyId,
      paise: existing.paise,
      periodMonth: existing.periodMonth,
    };
  }

  return { companyId: membership.companyId, paise, periodMonth: period };
}

/**
 * Move an order's reservation into the company's actual spend. Idempotent.
 *
 * Call once the payment for the order is captured — from BOTH the synchronous
 * verify and the webhook, since either may be the one that lands. The status
 * transition is the guard: the conditional update matches only a `reserved`
 * row, so the second caller updates zero rows and adds nothing to spend.
 */
export async function commitSubsidyForOrder(
  serverOrderId: number,
): Promise<{ committedPaise: number }> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(companySubsidyChargesTable)
      .where(eq(companySubsidyChargesTable.orderId, serverOrderId));
    if (!row || row.status !== "reserved") return { committedPaise: 0 };

    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${subsidyLockKey(row.companyId, row.userId, row.periodMonth)}, 0))`,
    );

    // Conditional on status: two concurrent commits, and only one wins.
    const claimed = await tx
      .update(companySubsidyChargesTable)
      .set({ status: "committed" })
      .where(
        and(
          eq(companySubsidyChargesTable.id, row.id),
          eq(companySubsidyChargesTable.status, "reserved"),
        ),
      )
      .returning({ id: companySubsidyChargesTable.id });
    if (claimed.length === 0) return { committedPaise: 0 };

    // Upsert the period counter. `spent_paise + excluded` rather than a
    // read-modify-write, so the increment is atomic in the database even though
    // the lock above already serialises us.
    await tx
      .insert(companyBudgetUsageTable)
      .values({
        companyId: row.companyId,
        userId: row.userId,
        periodMonth: row.periodMonth,
        spentPaise: row.paise,
      })
      .onConflictDoUpdate({
        target: [
          companyBudgetUsageTable.companyId,
          companyBudgetUsageTable.userId,
          companyBudgetUsageTable.periodMonth,
        ],
        set: {
          spentPaise: sql`${companyBudgetUsageTable.spentPaise} + ${row.paise}`,
        },
      });
    return { committedPaise: row.paise };
  });
}

/**
 * Give a reservation back. Idempotent, and deliberately narrow: only a
 * `reserved` row is released.
 *
 * A `committed` row is NOT touched — that money was really collected, and
 * unwinding it belongs to the refund path, which has its own authority and its
 * own audit trail. Silently decrementing spend here would let a cancel after
 * capture erase a real charge.
 */
export async function releaseSubsidyForOrder(
  serverOrderId: number,
  /**
   * Pass the caller's transaction when releasing as part of a larger unit of
   * work — cancelling an order, say. Defaulting to `db` would run the release
   * on a separate connection, so a rollback of the caller's transaction would
   * leave the budget released against an order that was never cancelled.
   */
  tx: Queryer = db,
): Promise<{ releasedPaise: number }> {
  const released = await tx
    .update(companySubsidyChargesTable)
    .set({ status: "released" })
    .where(
      and(
        eq(companySubsidyChargesTable.orderId, serverOrderId),
        eq(companySubsidyChargesTable.status, "reserved"),
      ),
    )
    .returning({ paise: companySubsidyChargesTable.paise });
  return { releasedPaise: released[0]?.paise ?? 0 };
}

/**
 * What a quote should show: the subsidy the caller would get on an order of
 * `grossPaise` right now, net of everything already committed or reserved.
 *
 * Read-only and unlocked — it is an estimate for the UI. The authoritative
 * number is the one reserveSubsidyForOrder() takes under the lock, which is why
 * the client must never bill from this.
 */
export async function quoteSubsidyPaise(
  userId: string,
  grossPaise: number,
  now = new Date(),
): Promise<{
  active: boolean;
  companyId: number | null;
  monthlyBudgetPaise: number;
  committedPaise: number;
  reservedPaise: number;
  remainingPaise: number;
  subsidyPaise: number;
}> {
  const membership = await activeMembership(db, userId);
  if (!membership) {
    return {
      active: false,
      companyId: null,
      monthlyBudgetPaise: 0,
      committedPaise: 0,
      reservedPaise: 0,
      remainingPaise: 0,
      subsidyPaise: 0,
    };
  }
  const period = budgetPeriodMonth(now);
  const { committedPaise, reservedPaise } = await budgetUsagePaise(
    db,
    membership.companyId,
    userId,
    period,
  );
  const monthlyBudgetPaise =
    membership.overridePaise ?? membership.monthlyBudgetPaise;
  const subsidyPaise = subsidyForOrderPaise({
    monthlyBudgetPaise,
    committedPaise,
    reservedPaise,
    grossPaise,
    optIn: true,
  });
  return {
    active: true,
    companyId: membership.companyId,
    monthlyBudgetPaise,
    committedPaise,
    reservedPaise,
    remainingPaise: Math.max(
      0,
      monthlyBudgetPaise - committedPaise - reservedPaise,
    ),
    subsidyPaise,
  };
}

/** The subsidy recorded against an order, for receipts and order detail. */
export async function subsidyForOrders(
  serverOrderIds: number[],
): Promise<Map<number, number>> {
  if (serverOrderIds.length === 0) return new Map();
  const rows = await db
    .select({
      orderId: companySubsidyChargesTable.orderId,
      paise: companySubsidyChargesTable.paise,
    })
    .from(companySubsidyChargesTable)
    .where(
      and(
        inArray(companySubsidyChargesTable.orderId, serverOrderIds),
        // A released reservation reduced nothing, so it is not part of any
        // receipt.
        inArray(companySubsidyChargesTable.status, ["reserved", "committed"]),
      ),
    );
  return new Map(rows.map((r) => [r.orderId, r.paise]));
}
