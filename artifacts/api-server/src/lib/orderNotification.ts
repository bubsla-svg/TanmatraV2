import { db, ordersTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { normalisePhone, sendWhatsappMessage } from "./whatsapp";
import { sendMail } from "./mail";

/**
 * Dispatches order confirmation notifications (WhatsApp and Email) for a given order ID.
 * Wrapped in try...catch to ensure errors never fail the primary HTTP request.
 */
export async function sendOrderConfirmation(orderId: number): Promise<void> {
  try {
    const rows = await db
      .select({
        order: ordersTable,
        user: usersTable,
      })
      .from(ordersTable)
      .leftJoin(usersTable, eq(ordersTable.userId, usersTable.id))
      .where(eq(ordersTable.id, orderId))
      .limit(1);

    const row = rows[0];
    if (!row || !row.order) {
      logger.warn({ orderId }, "orderNotification: order not found");
      return;
    }

    const { order, user } = row;
    const phone = order.phone || user?.phoneE164;
    const email = user?.email;
    const totalINR = (order.totalPaise / 100).toFixed(2);
    
    const itemsSummary = Array.isArray(order.items)
      ? order.items.map((it: { name: string; qty: number; price: number }) => `${it.qty}x ${it.name}`).join(", ")
      : "Your items";

    // 1. Dispatch WhatsApp confirmation
    if (phone) {
      let cleanPhone = phone.replace(/[^0-9]/g, "");
      if (cleanPhone.length === 12 && cleanPhone.startsWith("91")) {
        cleanPhone = cleanPhone.slice(2);
      }
      const normalized = normalisePhone("+91", cleanPhone);
      if (normalized) {
        const whatsappBody = `Hello! Your Tanmatra order #${order.id} (${order.externalOrderId || ""}) is confirmed. Total: ₹${totalINR}. Items: ${itemsSummary}. We are preparing your meal now!`;
        await sendWhatsappMessage(normalized, whatsappBody);
        logger.info({ orderId, phone: normalized.e164 }, "orderNotification: WhatsApp sent");
      } else {
        logger.warn({ orderId, phone }, "orderNotification: phone normalization failed for WhatsApp");
      }
    }

    // 2. Dispatch Email confirmation
    if (email) {
      const subject = `Tanmatra Order Confirmation - #${order.id}`;
      const text = `Thank you for ordering with Tanmatra!\n\nOrder ID: #${order.id} (${order.externalOrderId || ""})\nTotal: ₹${totalINR}\nItems: ${itemsSummary}\n\nWe are preparing your meal now!`;
      const html = `<p>Thank you for ordering with <strong>Tanmatra</strong>!</p><p><strong>Order ID:</strong> #${order.id} (${order.externalOrderId || ""})<br/><strong>Total:</strong> ₹${totalINR}<br/><strong>Items:</strong> ${itemsSummary}</p><p>We are preparing your meal now!</p>`;
      await sendMail({ to: email, subject, text, html });
      logger.info({ orderId, email }, "orderNotification: Email sent");
    }
  } catch (err) {
    logger.error({ err, orderId }, "orderNotification: failed to send order confirmation");
  }
}
