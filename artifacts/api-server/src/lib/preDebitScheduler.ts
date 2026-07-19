import { and, eq, gte, lte } from "drizzle-orm";
import {
  db,
  subscriptionsTable,
  subscriptionMandatesTable,
  usersTable,
  preDebitNotificationsTable,
} from "@workspace/db";
import { logger } from "./logger";
import { sendMail } from "./mail";
import { normalisePhone, sendWhatsappMessage } from "./whatsapp";

// Timezone offset helper for IST (+5:30)
export function formatIstDate(date: Date): string {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(date.getTime() + istOffsetMs);
  const year = istTime.getUTCFullYear();
  const month = String(istTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(istTime.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function runPreDebitNotificationsSweep(opts?: {
  now?: Date;
}): Promise<{
  processed: number;
  sent: number;
  errors: number;
}> {
  const now = opts?.now ?? new Date();
  // Window width MUST match how often this sweep runs (see
  // startPreDebitScheduler below — hourly by default). A mandate's
  // nextChargeAt time-of-day is fixed (it only ever moves in whole-cadence-
  // day steps), so 24 consecutive, non-overlapping 1h-wide windows — one per
  // hourly tick — guarantee every mandate is caught by exactly one tick per
  // day, regardless of what time of day it's due. The previous version ran
  // once daily at a fixed hour with a 2h window, so only mandates whose
  // nextChargeAt time-of-day happened to fall in that one daily slice were
  // ever notified — everyone else's notice never fired and
  // /payments/charge-mandate then permanently 400s them (no "sent" notice
  // dispatched >=24h before the charge day). Widening this window without
  // also running more often (or narrowing it without running more often)
  // reopens that coverage gap.
  const startWindow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const endWindow = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  logger.info(
    { startWindow: startWindow.toISOString(), endWindow: endWindow.toISOString() },
    "pre-debit sweep: starting sweep"
  );

  const candidates = await db
    .select({
      subscription: subscriptionsTable,
      mandate: subscriptionMandatesTable,
      user: usersTable,
    })
    .from(subscriptionsTable)
    .innerJoin(
      subscriptionMandatesTable,
      eq(subscriptionsTable.id, subscriptionMandatesTable.subscriptionId),
    )
    .innerJoin(usersTable, eq(subscriptionsTable.userId, usersTable.id))
    .where(
      and(
        eq(subscriptionsTable.status, "active"),
        eq(subscriptionMandatesTable.status, "active"),
        gte(subscriptionMandatesTable.nextChargeAt, startWindow),
        lte(subscriptionMandatesTable.nextChargeAt, endWindow),
      ),
    );

  let processed = 0;
  let sent = 0;
  let errors = 0;

  for (const candidate of candidates) {
    processed++;
    try {
      const chargeDate = candidate.mandate.nextChargeAt;
      if (!chargeDate) {
        continue;
      }

      // Check if a notification was already created for this subscription on the same calendar day (in UTC or relative to charge date)
      const startOfDay = new Date(chargeDate);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(chargeDate);
      endOfDay.setUTCHours(23, 59, 59, 999);

      const [existingNotification] = await db
        .select()
        .from(preDebitNotificationsTable)
        .where(
          and(
            eq(preDebitNotificationsTable.subscriptionId, candidate.subscription.id),
            gte(preDebitNotificationsTable.scheduledChargeAt, startOfDay),
            lte(preDebitNotificationsTable.scheduledChargeAt, endOfDay)
          )
        )
        .limit(1);

      if (existingNotification) {
        logger.info(
          { subscriptionId: candidate.subscription.id, chargeDate: chargeDate.toISOString() },
          "pre-debit sweep: notification already exists for this date, skipping"
        );
        continue;
      }

      // Create a record in preDebitNotificationsTable with status = "pending"
      const [notifRecord] = await db
        .insert(preDebitNotificationsTable)
        .values({
          subscriptionId: candidate.subscription.id,
          scheduledChargeAt: chargeDate,
          status: "pending",
        })
        .returning();

      const amountINR = (candidate.subscription.pricePerDeliveryPaise / 100).toFixed(2);
      const chargeDateStr = formatIstDate(chargeDate);

      const emailBody = `Dear customer, this is a pre-debit warning notification for your subscription #${candidate.subscription.id}. An upcoming charge of ₹${amountINR} will be debited from your account on ${chargeDateStr} (IST).`;
      const whatsappBody = `Dear customer, upcoming charge of ₹${amountINR} for your subscription #${candidate.subscription.id} is scheduled on ${chargeDateStr}.`;

      let emailSent = false;
      let whatsappSent = false;

      // Dispatch Email
      if (candidate.user.email) {
        try {
          await sendMail({
            to: candidate.user.email,
            subject: `Upcoming Subscription Charge Notification - Subscription #${candidate.subscription.id}`,
            text: emailBody,
            html: `<p>${emailBody}</p>`,
          });
          emailSent = true;
        } catch (err) {
          logger.error({ err, subscriptionId: candidate.subscription.id }, "pre-debit sweep: email dispatch failed");
        }
      }

      // Dispatch WhatsApp
      const phone = candidate.subscription.phone || candidate.user.phoneE164;
      if (phone) {
        let cleanPhone = phone.replace(/[^0-9]/g, "");
        if (cleanPhone.length === 12 && cleanPhone.startsWith("91")) {
          cleanPhone = cleanPhone.slice(2);
        }
        const normalized = normalisePhone("+91", cleanPhone);
        if (normalized) {
          try {
            const res = await sendWhatsappMessage(normalized, whatsappBody, {
              dedupe: {
                userId: candidate.subscription.userId,
                templateId: "pre-debit-warning",
                serviceDate: chargeDateStr,
              },
            });
            if (res.ok && !res.discarded) {
              whatsappSent = true;
            }
          } catch (err) {
            logger.error({ err, subscriptionId: candidate.subscription.id }, "pre-debit sweep: WhatsApp dispatch failed");
          }
        }
      }

      // Upon successful dispatch, update the record's status to "sent" and write dispatchedAt
      if (emailSent || whatsappSent) {
        await db
          .update(preDebitNotificationsTable)
          .set({
            status: "sent",
            dispatchedAt: new Date(),
          })
          .where(eq(preDebitNotificationsTable.id, notifRecord.id));
        sent++;
      }
    } catch (err) {
      errors++;
      logger.error({ err, subscriptionId: candidate.subscription.id }, "pre-debit sweep: failed processing subscription candidate");
    }
  }

  logger.info(
    { processed, sent, errors },
    "pre-debit sweep: sweep complete"
  );
  return { processed, sent, errors };
}

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

// Hourly by default — matches the 1h-wide rolling window above, see the
// coverage-gap explanation on runPreDebitNotificationsSweep. Overridable for
// tests / ops via PRE_DEBIT_SCHEDULER_INTERVAL_MS (pre-existing env var).
const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await runPreDebitNotificationsSweep();
  } catch (err) {
    logger.error({ err }, "pre-debit scheduler tick failed");
  } finally {
    running = false;
  }
}

export function startPreDebitScheduler(): void {
  if (timer) return;
  const intervalMs = Number(
    process.env["PRE_DEBIT_SCHEDULER_INTERVAL_MS"] ?? DEFAULT_INTERVAL_MS,
  );
  timer = setInterval(() => void tick(), intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  // Fire an immediate tick too so a restart doesn't sit idle for a full
  // interval before the first sweep runs.
  void tick();
  logger.info({ intervalMs }, "pre-debit scheduler started (hourly rolling window)");
}

export function stopPreDebitScheduler(): void {
  if (timer) {
    clearTimeout(timer);
    clearInterval(timer);
    timer = null;
  }
}
