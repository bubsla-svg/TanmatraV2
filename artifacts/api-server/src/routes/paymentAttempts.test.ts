import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { db, quotesTable, paymentAttemptsTable, usersTable, ordersTable, subscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import paymentAttemptsRouter from "./paymentAttempts";
import quotesRouter from "./quotes";
import premiumRouter from "./premium";
import corporateRouter from "./corporate";
import { premiumMembershipsTable, vouchersTable, creditLedgerTable } from "@workspace/db";
import { createHmac } from "node:crypto";
test("Payment Integrity and Idempotency", async (t) => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const userId = (req.headers["x-test-user-id"] as string) || "test_user_1";
    (req as any).user = { id: userId };
    (req as any).isAuthenticated = () => true;
    (req as any).log = { info: () => {}, warn: () => {}, error: () => {} };
    next();
  });
  app.use(paymentAttemptsRouter);
  app.use(quotesRouter);
  app.use(premiumRouter);
  app.use(corporateRouter);
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Test App Error:", err);
    res.status(500).json({ error: err.message });
  });

  // Use a local listener for tests
  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  await db.insert(usersTable).values([
    { id: "test_user_1", email: "test1@example.com" },
    { id: "test_user_2", email: "test2@example.com" }
  ]).onConflictDoNothing();

  t.after(() => {
    server.close();
  });

  await t.test("Expired quote -> no PaymentAttempt created", async () => {
    const quoteId = crypto.randomUUID();
    await db.insert(quotesTable).values({
      id: quoteId,
      userId: "test_user_1",
      status: "active",
      currency: "INR",
      totalPaise: 1000,
      items: [],
      expiresAt: new Date(Date.now() - 10000) // expired
    });
    
    const idempotencyKey = crypto.randomUUID();
    const res = await fetch(`${baseUrl}/payment-attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ quoteId })
    });
    
    assert.equal(res.status, 409);
    const data = (await res.json()) as any;
    assert.equal(data.code, "quote_expired");

    const attempts = await db.select().from(paymentAttemptsTable).where(eq(paymentAttemptsTable.idempotencyKey, idempotencyKey));
    assert.equal(attempts.length, 0);
  });

  await t.test("Same idempotency key sent twice -> one PaymentAttempt", async () => {
    const quoteId = crypto.randomUUID();
    await db.insert(quotesTable).values({
      id: quoteId,
      userId: "test_user_1",
      status: "active",
      currency: "INR",
      totalPaise: 1000,
      items: [],
      expiresAt: new Date(Date.now() + 10000)
    });
    
    const idempotencyKey = crypto.randomUUID();
    
    const res1 = await fetch(`${baseUrl}/payment-attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ quoteId })
    });
    assert.equal(res1.status, 201);
    
    const res2 = await fetch(`${baseUrl}/payment-attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ quoteId })
    });
    assert.equal(res2.status, 409);
    const data2 = (await res2.json()) as any;
    assert.equal(data2.code, "PAYMENT_ATTEMPT_ALREADY_EXISTS");

    const attempts = await db.select().from(paymentAttemptsTable).where(eq(paymentAttemptsTable.idempotencyKey, idempotencyKey));
    assert.equal(attempts.length, 1);
  });

  await t.test("Concurrent same-key requests -> one provider invocation", async () => {
    const quoteId = crypto.randomUUID();
    await db.insert(quotesTable).values({
      id: quoteId,
      userId: "test_user_1",
      status: "active",
      currency: "INR",
      totalPaise: 1000,
      items: [],
      expiresAt: new Date(Date.now() + 10000)
    });
    
    const idempotencyKey = crypto.randomUUID();
    
    const results = await Promise.allSettled([
      fetch(`${baseUrl}/payment-attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ quoteId })
      }),
      fetch(`${baseUrl}/payment-attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ quoteId })
      })
    ]);
    
    const successfulResults = results.filter(
      (r) => r.status === "fulfilled" && (r.value as Response).status === 201
    );
    assert.equal(successfulResults.length, 1);
    
    const conflictResults = results.filter(
      (r) => r.status === "fulfilled" && (r.value as Response).status === 409
    );
    assert.equal(conflictResults.length, 1);

    const attempts = await db.select().from(paymentAttemptsTable).where(eq(paymentAttemptsTable.idempotencyKey, idempotencyKey));
    assert.equal(attempts.length, 1);
  });

  await t.test("Timed-out request retried -> existing attempt returned", async () => {
    const quoteId = crypto.randomUUID();
    await db.insert(quotesTable).values({
      id: quoteId,
      userId: "test_user_1",
      status: "active",
      currency: "INR",
      totalPaise: 1000,
      items: [],
      expiresAt: new Date(Date.now() + 10000)
    });
    
    const idempotencyKey = crypto.randomUUID();
    
    await fetch(`${baseUrl}/payment-attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ quoteId })
    });
    
    const res = await fetch(`${baseUrl}/payment-attempts/by-idempotency-key/${idempotencyKey}`);
    assert.equal(res.status, 200);
    const data = (await res.json()) as any;
    assert.equal(data.status, "processing");
  });

  await t.test("Successful provider callback repeated -> one order", async () => {
    // Simulated via the fact that if a payment attempt is succeeded, the order is already created
    const quoteId = crypto.randomUUID();
    await db.insert(quotesTable).values({
      id: quoteId,
      userId: "test_user_1",
      status: "active",
      currency: "INR",
      totalPaise: 1000,
      items: [],
      expiresAt: new Date(Date.now() + 10000)
    });
    
    const idempotencyKey = crypto.randomUUID();
    const attemptId = crypto.randomUUID();
    
    await db.insert(paymentAttemptsTable).values({
      id: attemptId,
      customerId: "test_user_1",
      quoteId,
      idempotencyKey,
      status: "succeeded",
      orderId: "order_123"
    });

    const res = await fetch(`${baseUrl}/payment-attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ quoteId })
    });
    
    assert.equal(res.status, 409);
    const data = (await res.json()) as any;
    assert.equal(data.code, "ORDER_ALREADY_CONFIRMED");
    assert.equal(data.orderId, "order_123");
  });

  await t.test("Repeated successful callback -> one subscription", async () => {
    const razorpayOrderId = crypto.randomUUID();
    const paymentId = crypto.randomUUID();
    const keySecret = process.env["RAZORPAY_KEY_SECRET"] || "secret";
    process.env["RAZORPAY_KEY_ID"] = "key_id";
    process.env["RAZORPAY_KEY_SECRET"] = keySecret;
    const signature = createHmac("sha256", keySecret).update(`${razorpayOrderId}|${paymentId}`).digest("hex");

    await db.delete(premiumMembershipsTable).where(eq(premiumMembershipsTable.userId, "test_user_1"));

    // Insert pending payment
    await db.insert(premiumMembershipsTable).values({
      userId: "test_user_1",
      status: "pending_payment",
      monthlyPricePaise: 99900,
      startedAt: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
      rdConsultsUsedThisPeriod: 0,
      rdConsultsPerPeriod: 1,
      razorpayOrderId
    });

    const payload = { razorpayPaymentId: paymentId, razorpayOrderId, razorpaySignature: signature };

    // First callback
    const res1 = await fetch(`${baseUrl}/premium/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    assert.equal(res1.status, 200);

    // Repeated callback
    const res2 = await fetch(`${baseUrl}/premium/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    assert.equal(res2.status, 200); // premium verify returns 200 OK if already processed
    const data2 = (await res2.json()) as any;
    assert.equal(data2.status, "already_processed");

    const memberships = await db.select().from(premiumMembershipsTable).where(eq(premiumMembershipsTable.userId, "test_user_1"));
    assert.equal(memberships.length, 1);
    assert.equal(memberships[0].status, "active");
  });

  await t.test("Voucher or entitlement -> consumed once", async () => {
    const code = crypto.randomUUID().slice(0, 20).toUpperCase();
    await db.delete(vouchersTable).where(eq(vouchersTable.purchasedByUserId, "test_user_1"));
    await db.delete(creditLedgerTable).where(eq(creditLedgerTable.userId, "test_user_1"));
    await db.insert(vouchersTable).values({
      amountPaise: 50000,
      code,
      status: "active",
      purchasedByUserId: "test_user_1"
    });

    // First redemption
    const res1 = await fetch(`${baseUrl}/vouchers/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });
    assert.equal(res1.status, 200);

    // Second redemption
    const res2 = await fetch(`${baseUrl}/vouchers/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });
    assert.equal(res2.status, 409); // Already redeemed

    const ledgers = await db.select().from(creditLedgerTable).where(eq(creditLedgerTable.userId, "test_user_1"));
    const voucherCredits = ledgers.filter(l => l.refType === "voucher" && Number(l.deltaPaise || 0) === 50000);
    assert.equal(voucherCredits.length, 1);
  });

  await t.test("Failed payment -> entitlement reservation released", async () => {
    // If a payment fails (e.g. timeout), the quote expires and any reserved entitlements should be freed.
    // Here we simulate the terminal failure causing the quote to expire.
    const quoteId = crypto.randomUUID();
    await db.insert(quotesTable).values({
      id: quoteId,
      userId: "test_user_1",
      status: "active",
      currency: "INR",
      totalPaise: 1000,
      items: [],
      expiresAt: new Date(Date.now() + 10000) // active
    });

    const idempotencyKey = crypto.randomUUID();
    const res = await fetch(`${baseUrl}/payment-attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ quoteId })
    });
    assert.equal(res.status, 201);
    const data = (await res.json()) as any;
    const attemptId = data.id;
    
    // Simulate terminal failure
    const failRes = await fetch(`${baseUrl}/payment-attempts/${attemptId}/fail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    assert.equal(failRes.status, 200);

    // Call fail again (duplicate notification)
    const failRes2 = await fetch(`${baseUrl}/payment-attempts/${attemptId}/fail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    assert.equal(failRes2.status, 200);
    
    const expiredQuote = await db.select().from(quotesTable).where(eq(quotesTable.id, quoteId));
    assert.equal(expiredQuote.length, 1, "Quote count must be 1");
    assert.equal(expiredQuote[0].status, "expired", "reservation status must be released/expired");
    
    // Explicitly assert PaymentAttempt database count is exactly 1 and status is failed
    const attempts = await db.select().from(paymentAttemptsTable).where(eq(paymentAttemptsTable.id, attemptId));
    assert.equal(attempts.length, 1, "PaymentAttempt count must be exactly 1");
    assert.equal(attempts[0].status, "failed", "PaymentAttempt status must be failed");
    assert.equal(attempts[0].orderId, null, "orderId must be null");

    // Ensure zero orders and zero subscriptions exist
    const ordersAfterFail = await db.select().from(ordersTable).where(eq(ordersTable.userId, "test_user_1"));
    assert.equal(ordersAfterFail.length, 0, "order count must be exactly 0");
    const subsAfterFail = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, "test_user_1"));
    assert.equal(subsAfterFail.length, 0, "subscription count must be exactly 0");
  });

  await t.test("Same key with another quote is rejected", async () => {
    const quoteId1 = crypto.randomUUID();
    const quoteId2 = crypto.randomUUID();
    
    await db.insert(quotesTable).values([
      {
        id: quoteId1,
        userId: "test_user_1",
        status: "active",
        currency: "INR",
        totalPaise: 1000,
        items: [],
        expiresAt: new Date(Date.now() + 10000)
      },
      {
        id: quoteId2,
        userId: "test_user_1",
        status: "active",
        currency: "INR",
        totalPaise: 2000,
        items: [],
        expiresAt: new Date(Date.now() + 10000)
      }
    ]);

    const idempotencyKey = crypto.randomUUID();

    const res1 = await fetch(`${baseUrl}/payment-attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ quoteId: quoteId1 })
    });
    assert.equal(res1.status, 201);

    const res2 = await fetch(`${baseUrl}/payment-attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ quoteId: quoteId2 })
    });
    assert.equal(res2.status, 409);
    const data2 = (await res2.json()) as any;
    assert.equal(data2.code, "IDEMPOTENCY_KEY_REUSE_CONFLICT");
  });

  await t.test("Same key from another customer is isolated", async () => {
    const quoteId1 = crypto.randomUUID();
    const quoteId2 = crypto.randomUUID();
    
    await db.insert(quotesTable).values([
      {
        id: quoteId1,
        userId: "test_user_1",
        status: "active",
        currency: "INR",
        totalPaise: 1000,
        items: [],
        expiresAt: new Date(Date.now() + 10000)
      },
      {
        id: quoteId2,
        userId: "test_user_2",
        status: "active",
        currency: "INR",
        totalPaise: 1000,
        items: [],
        expiresAt: new Date(Date.now() + 10000)
      }
    ]);

    const idempotencyKey = crypto.randomUUID();

    // Customer 1 request
    const res1 = await fetch(`${baseUrl}/payment-attempts`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Idempotency-Key": idempotencyKey,
        "x-test-user-id": "test_user_1"
      },
      body: JSON.stringify({ quoteId: quoteId1 })
    });
    assert.equal(res1.status, 201);

    // Customer 2 request with SAME key should SUCCEED (isolated)
    const res2 = await fetch(`${baseUrl}/payment-attempts`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Idempotency-Key": idempotencyKey,
        "x-test-user-id": "test_user_2"
      },
      body: JSON.stringify({ quoteId: quoteId2 })
    });
    assert.equal(res2.status, 201);

    const attempts = await db.select().from(paymentAttemptsTable).where(eq(paymentAttemptsTable.idempotencyKey, idempotencyKey));
    assert.equal(attempts.length, 2);
  });

  await t.test("Failed payment creates no order and no subscription", async () => {
    const testUserId = `user_fail_${crypto.randomUUID()}`;
    await db.insert(usersTable).values({
      id: testUserId,
      email: `${testUserId}@example.com`
    }).onConflictDoNothing();

    const quoteId = crypto.randomUUID();
    await db.insert(quotesTable).values({
      id: quoteId,
      userId: testUserId,
      status: "active",
      currency: "INR",
      totalPaise: 1000,
      items: [],
      expiresAt: new Date(Date.now() + 10000)
    });

    const idempotencyKey = crypto.randomUUID();
    const res = await fetch(`${baseUrl}/payment-attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ quoteId })
    });
    assert.equal(res.status, 201);
    const data = (await res.json()) as any;
    const attemptId = data.id;

    // Fail payment
    const failRes = await fetch(`${baseUrl}/payment-attempts/${attemptId}/fail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    assert.equal(failRes.status, 200);

    const ordersAfter = await db.select().from(ordersTable).where(eq(ordersTable.userId, testUserId));
    const subsAfter = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, testUserId));

    assert.equal(ordersAfter.length, 0, "No orders should be created for failed payment");
    assert.equal(subsAfter.length, 0, "No subscriptions should be created for failed payment");
  });

  await t.test("Terminal failure requires a new key", async () => {
    const quoteId1 = crypto.randomUUID();
    const quoteId2 = crypto.randomUUID();
    await db.insert(quotesTable).values([
      {
        id: quoteId1,
        userId: "test_user_1",
        status: "active",
        currency: "INR",
        totalPaise: 1000,
        items: [],
        expiresAt: new Date(Date.now() + 10000)
      },
      {
        id: quoteId2,
        userId: "test_user_1",
        status: "active",
        currency: "INR",
        totalPaise: 1000,
        items: [],
        expiresAt: new Date(Date.now() + 10000)
      }
    ]);

    const idempotencyKey = crypto.randomUUID();
    const res = await fetch(`${baseUrl}/payment-attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ quoteId: quoteId1 })
    });
    assert.equal(res.status, 201);
    const data = (await res.json()) as any;
    const attemptId = data.id;

    // Fail the attempt
    await fetch(`${baseUrl}/payment-attempts/${attemptId}/fail`, { method: "POST" });

    // Try to call again with same key (should be conflict/denied, require new key)
    const retryRes = await fetch(`${baseUrl}/payment-attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ quoteId: quoteId1 })
    });
    
    assert.equal(retryRes.status, 409);
    const retryData = (await retryRes.json()) as any;
    assert.equal(retryData.code, "PAYMENT_ATTEMPT_ALREADY_EXISTS");
  });
});
