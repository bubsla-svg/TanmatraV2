import test from "node:test";
import assert from "node:assert/strict";

process.env["DATABASE_URL"] ||= "postgresql://dummy:dummy@localhost:5432/dummy";

const { emailTicketReply } = await import("./supportTriage");
const { SUPPORT_CATEGORIES } = await import("@workspace/db");

/**
 * The customer-facing support dialog (SupportTicketDialog.tsx) tells every
 * customer "our care team will reply by email shortly." Before this,
 * sendReply() only ever wrote sentReply to the database — nothing consumed
 * it, so that promise was never kept for a single ticket. emailTicketReply()
 * is the fix; these two cases are the guard clauses that must short-circuit
 * BEFORE touching the database (so they're testable without a live
 * Postgres, unlike the "user has/hasn't got an email on file" branches,
 * which the money-path integration suite covers with a live DB).
 */

function baseTicket() {
  return {
    id: 1,
    userId: "user-1",
    orderId: null,
    channel: "web",
    subject: "Help with my order",
    body: "It's late",
    status: "sent",
    category: null,
    priority: null,
    team: null,
    triageRunId: null,
    triageReason: null,
    triagedAt: null,
    draftReply: null,
    draftCitations: [],
    draftRunId: null,
    draftedAt: null,
    sentReply: "We've refunded the delivery fee.",
    sentBy: "admin-1",
    sentAt: new Date(),
    humanCategory: null,
    humanPriority: null,
    humanTeam: null,
    rejectionReason: null,
    rejectedBy: null,
    rejectedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

test("emailTicketReply reports a reason and never queries the DB when there is no userId", async () => {
  const ticket = { ...baseTicket(), userId: null };
  const result = await emailTicketReply(ticket as unknown as Parameters<typeof emailTicketReply>[0]);
  assert.equal(result.delivered, false);
  assert.match(result.reason ?? "", /no recipient|no reply/);
});

test("emailTicketReply reports a reason and never queries the DB when there is no sentReply", async () => {
  const ticket = { ...baseTicket(), sentReply: null };
  const result = await emailTicketReply(ticket as unknown as Parameters<typeof emailTicketReply>[0]);
  assert.equal(result.delivered, false);
  assert.match(result.reason ?? "", /no recipient|no reply/);
});

test("sanity: SUPPORT_CATEGORIES import resolves (confirms @workspace/db import works under the dummy DATABASE_URL)", () => {
  assert.ok(Array.isArray(SUPPORT_CATEGORIES) && SUPPORT_CATEGORIES.length > 0);
});
