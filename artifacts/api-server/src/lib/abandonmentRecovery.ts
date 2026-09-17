/**
 * Abandonment recovery (T9, CRO handoff 2026-09-17). Two sweeps, one timer.
 *
 * 1. PAYMENT RECOVERY — an order that reached the Razorpay sheet and did not
 *    pay (the sheet was dismissed: status still `placed` with a
 *    razorpayOrderId; or the attempt failed: status `failed` via the
 *    payment.failed webhook) gets ONE WhatsApp message with a UPI payment
 *    link for the server-stored amount, within ~15 minutes of the
 *    abandonment. The link's reference_id is the order, so the webhook's
 *    payment-link capture branch promotes exactly that order — and it now
 *    accepts a `failed` order for this path (routes/payments.ts).
 *
 * 2. CART NUDGE — a KNOWN customer (signed in, WhatsApp utility consent on
 *    file) who added to cart 60–90 minutes ago and has placed no order since
 *    gets one message pointing back at checkout.
 *
 * Both are opt-in by the customer's own signals: the payment link goes to
 * the phone the customer typed on THIS order (fulfilment contact — the DPDP
 * consent POST /orders required), and for a signed-in customer additionally
 * only when `whatsappUtilityConsentAt` is set; the nudge is signed-in +
 * consent only. Quiet hours (21:30–08:00 IST) are honoured by
 * sendWhatsappMessage itself. Each message is deduped once per order (link)
 * or once per customer per day (nudge) through message_dispatches, so a
 * sweep that runs every 5 minutes can never double-send.
 *
 * Excluded on purpose: orders carrying a corporate subsidy (the failed
 * webhook already released the company's share, so a late capture would
 * bill the customer the net amount with no company row to commit — that is
 * ops' call, not a bot's), aggregator orders, and anything older than the
 * window — a customer who walked away an hour ago is not "recovering".
 */
import { and, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import {
  db,
  companySubsidyChargesTable,
  funnelEventsTable,
  messageDispatchesTable,
  ordersTable,
  usersTable,
} from "@workspace/db";
import { logger } from "./logger";
import { normalisePhone, sendWhatsappMessage, type SendWhatsappMessageResult } from "./whatsapp";
import { createUpiPaymentLink, type PaymentLink } from "./paymentLinks";
import { resolvePayableAmountPaise } from "./paymentIntegrity";

/** Abandonment is only certain after this long: a UPI collect can sit in the
 *  customer's bank app for a couple of minutes before the sheet resolves. */
export const PAYMENT_MIN_AGE_MS = 5 * 60 * 1000;
/** Past this the link is no longer "within 15 minutes" of anything. */
export const PAYMENT_MAX_AGE_MS = 60 * 60 * 1000;
/** Seconds the recovery link stays payable. */
export const PAYMENT_LINK_TTL_SEC = 24 * 60 * 60;
export const NUDGE_MIN_AGE_MS = 60 * 60 * 1000;
export const NUDGE_MAX_AGE_MS = 90 * 60 * 1000;

export const RECOVERY_TEMPLATE = "payment_recovery";
export const NUDGE_TEMPLATE = "cart_nudge";

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const INTERVAL_MS = Number(process.env["ABANDONMENT_RECOVERY_INTERVAL_MS"] ?? DEFAULT_INTERVAL_MS);
const STOREFRONT_ORIGIN = process.env["STOREFRONT_ORIGIN"] ?? "https://tanmatra.food";

export interface RecoveryDeps {
  now?: () => Date;
  sendMessage?: (
    e164: ReturnType<typeof normalisePhone> & object,
    body: string,
    dedupe: { userId: string; templateId: string; serviceDate: string },
  ) => Promise<SendWhatsappMessageResult>;
  createLink?: (req: {
    externalOrderId: string;
    amountPaise: number;
    phone: string;
    expireInSec: number;
  }) => Promise<PaymentLink>;
  storefrontOrigin?: string;
}

export interface RecoverySweepResult {
  candidates: number;
  sent: number[];
  skipped: number;
  errors: number;
}

function serviceDateOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function formatRupees(paise: number): string {
  const rupees = Math.floor(paise / 100);
  const rem = paise % 100;
  return rem === 0 ? `₹${rupees.toLocaleString("en-IN")}` : `₹${rupees.toLocaleString("en-IN")}.${String(rem).padStart(2, "0")}`;
}

export function paymentRecoveryBody(amountPaise: number, url: string): string {
  return `Your Tanmatra order is waiting — pay ${formatRupees(amountPaise)} in one tap: ${url}\nCancel any time before dispatch for a full refund.`;
}

export function cartNudgeBody(checkoutUrl: string): string {
  return `Your Tanmatra cart is still here. Finish in one tap: ${checkoutUrl}`;
}

/** Sweep 1: unpaid sheet attempts → one UPI payment link each. */
export async function runPaymentRecoverySweep(deps: RecoveryDeps = {}): Promise<RecoverySweepResult> {
  const now = deps.now?.() ?? new Date();
  const sendMessage = deps.sendMessage ?? ((n, body, dedupe) => sendWhatsappMessage(n, body, { dedupe }));
  const createLink = deps.createLink ?? ((r) => createUpiPaymentLink(r));
  const oldest = new Date(now.getTime() - PAYMENT_MAX_AGE_MS);
  const newest = new Date(now.getTime() - PAYMENT_MIN_AGE_MS);

  const rows = await db
    .select({
      id: ordersTable.id,
      externalOrderId: ordersTable.externalOrderId,
      status: ordersTable.status,
      phone: ordersTable.phone,
      userId: ordersTable.userId,
      chargePaise: ordersTable.chargePaise,
      totalPaise: ordersTable.totalPaise,
      userPhone: usersTable.phoneE164,
      whatsappConsentAt: usersTable.whatsappUtilityConsentAt,
    })
    .from(ordersTable)
    .leftJoin(usersTable, eq(ordersTable.userId, usersTable.id))
    .where(
      and(
        eq(ordersTable.orderKind, "meal"),
        eq(ordersTable.orderChannel, "own_app"),
        inArray(ordersTable.status, ["placed", "failed"]),
        isNotNull(ordersTable.razorpayOrderId),
        gte(ordersTable.createdAt, oldest),
        lte(ordersTable.createdAt, newest),
        sql`not exists (select 1 from ${companySubsidyChargesTable} where ${companySubsidyChargesTable.orderId} = ${ordersTable.id})`,
      ),
    )
    .limit(200);

  const sent: number[] = [];
  let skipped = 0;
  let errors = 0;
  for (const row of rows) {
    const rawPhone = row.phone || row.userPhone;
    if (!rawPhone || !row.externalOrderId) { skipped++; continue; }
    if (row.userId && !row.whatsappConsentAt) { skipped++; continue; }
    const amount = resolvePayableAmountPaise(row);
    if (amount == null) { skipped++; continue; }
    const digits = rawPhone.replace(/[^0-9]/g, "");
    const number = normalisePhone(digits.length > 10 ? `+${digits.slice(0, digits.length - 10)}` : "+91", digits.slice(-10));
    if (!number) { skipped++; continue; }
    try {
      // Dedupe FIRST (the sender inserts the dispatch row before sending):
      // a link is created only for an order that has never had one, so a
      // sweep retry never mints a second live link for the same order.
      const dedupe = { userId: row.userId ?? `order:${row.id}`, templateId: RECOVERY_TEMPLATE, serviceDate: serviceDateOf(now) };
      const probe = await db
        .select({ id: messageDispatchesTable.id })
        .from(messageDispatchesTable)
        .where(eq(messageDispatchesTable.dedupeKey, `${dedupe.userId}:${dedupe.templateId}:${dedupe.serviceDate}`))
        .limit(1);
      if (probe[0]) { skipped++; continue; }
      const link = await createLink({ externalOrderId: row.externalOrderId, amountPaise: amount, phone: number.e164, expireInSec: PAYMENT_LINK_TTL_SEC });
      const res = await sendMessage(number, paymentRecoveryBody(amount, link.shortUrl), dedupe);
      if (res.ok && !res.discarded) sent.push(row.id);
      else skipped++;
    } catch (err) {
      errors++;
      logger.error({ err, orderId: row.id }, "abandonment recovery: payment link failed");
    }
  }
  logger.info({ candidates: rows.length, sent: sent.length, skipped, errors }, "abandonment recovery: payment sweep complete");
  return { candidates: rows.length, sent, skipped, errors };
}

/** Sweep 2: known customers with a 60–90-minute-old add_to_cart and no order since. */
export async function runCartNudgeSweep(deps: RecoveryDeps = {}): Promise<RecoverySweepResult> {
  const now = deps.now?.() ?? new Date();
  const sendMessage = deps.sendMessage ?? ((n, body, dedupe) => sendWhatsappMessage(n, body, { dedupe }));
  const origin = deps.storefrontOrigin ?? STOREFRONT_ORIGIN;
  const oldest = new Date(now.getTime() - NUDGE_MAX_AGE_MS);
  const newest = new Date(now.getTime() - NUDGE_MIN_AGE_MS);

  const rows = await db
    .selectDistinct({
      userId: funnelEventsTable.userId,
      phone: usersTable.phoneE164,
      consentAt: usersTable.whatsappUtilityConsentAt,
    })
    .from(funnelEventsTable)
    .innerJoin(usersTable, eq(usersTable.id, funnelEventsTable.userId))
    .where(
      and(
        eq(funnelEventsTable.name, "add_to_cart"),
        isNotNull(funnelEventsTable.userId),
        gte(funnelEventsTable.createdAt, oldest),
        lte(funnelEventsTable.createdAt, newest),
        isNotNull(usersTable.phoneE164),
        isNotNull(usersTable.whatsappUtilityConsentAt),
        sql`not exists (select 1 from ${ordersTable} where ${ordersTable.userId} = ${funnelEventsTable.userId} and ${ordersTable.createdAt} >= ${funnelEventsTable.createdAt})`,
      ),
    )
    .limit(200);

  const sent: number[] = [];
  let skipped = 0;
  let errors = 0;
  const checkoutUrl = `${origin}/checkout?mode=alacarte`;
  for (const row of rows) {
    if (!row.userId || !row.phone) { skipped++; continue; }
    const digits = row.phone.replace(/[^0-9]/g, "");
    const number = normalisePhone(digits.length > 10 ? `+${digits.slice(0, digits.length - 10)}` : "+91", digits.slice(-10));
    if (!number) { skipped++; continue; }
    try {
      const res = await sendMessage(number, cartNudgeBody(checkoutUrl), { userId: row.userId, templateId: NUDGE_TEMPLATE, serviceDate: serviceDateOf(now) });
      if (res.ok && !res.discarded) sent.push(sent.length + 1);
      else skipped++;
    } catch (err) {
      errors++;
      logger.error({ err, userId: row.userId }, "abandonment recovery: cart nudge failed");
    }
  }
  logger.info({ candidates: rows.length, sent: sent.length, skipped, errors }, "abandonment recovery: cart nudge sweep complete");
  return { candidates: rows.length, sent, skipped, errors };
}

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await runPaymentRecoverySweep();
    await runCartNudgeSweep();
  } catch (err) {
    logger.error({ err }, "abandonment recovery tick failed");
  } finally {
    running = false;
  }
}

/** ABANDONMENT_RECOVERY_DISABLED=1 is the individual kill switch; the blanket
 *  DISABLE_SCHEDULERS gate in index.ts still applies. */
export function startAbandonmentRecoveryScheduler(): void {
  if (timer) return;
  if (process.env["ABANDONMENT_RECOVERY_DISABLED"] === "1") {
    logger.info("abandonment recovery scheduler disabled by env");
    return;
  }
  const initial = setTimeout(() => void tick(), 90_000);
  if (typeof initial.unref === "function") initial.unref();
  timer = setInterval(() => void tick(), INTERVAL_MS);
  if (typeof timer.unref === "function") timer.unref();
  logger.info({ intervalMs: INTERVAL_MS }, "abandonment recovery scheduler started");
}

export function stopAbandonmentRecoveryScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
