import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import express from "express";
import { createServer, type Server } from "node:http";
import { z } from "zod/v4";
import {
  validateRequest,
  sanitizeInputMiddleware,
  routeBurstGuard,
  clearRateAwarenessForTesting,
} from "./requestValidationGuard";

describe("Request Validation, Sanitization & Middleware Rate Awareness Engine", () => {
  let server: Server;
  let baseUrl: string;

  const testBodySchema = z.object({
    title: z.string().min(3),
    quantity: z.number().int().positive(),
  }).strip();

  before(async () => {
    const app = express();
    app.use(express.json());

    // Mount XSS Sanitizer & Rate Awareness Guard
    app.use(sanitizeInputMiddleware);
    app.use(routeBurstGuard(10)); // max 10 per sec for testing

    // Test route with Step 1 validation
    app.post("/test-endpoint", validateRequest({ body: testBodySchema }), (req, res) => {
      res.json({ ok: true, data: req.body });
    });

    await new Promise<void>((resolve) => {
      server = createServer(app).listen(0, "127.0.0.1", () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    clearRateAwarenessForTesting();
  });

  it("Step 1 (Input Validation): rejects invalid payload or missing fields with 400 Bad Request", async () => {
    // Missing required field 'quantity'
    const res = await fetch(`${baseUrl}/test-endpoint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Paneer Bowl" }),
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as any;
    assert.strictEqual(body.error, "validation_failed");
    assert.ok(body.issues);
  });

  it("Step 1 (Input Validation): strips unexpected fields and approves valid schema payloads", async () => {
    const res = await fetch(`${baseUrl}/test-endpoint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Keto Salad",
        quantity: 2,
        unapprovedExtraField: "hacker_data_injection",
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.data.title, "Keto Salad");
    assert.strictEqual(body.data.quantity, 2);
    assert.strictEqual(body.data.unapprovedExtraField, undefined); // Stripped!
  });

  it("Step 2 (Sanitization): strips malicious script tags and inline handlers from input strings", async () => {
    const maliciousPayload = {
      title: "Clean Dish<script>alert('xss')</script>",
      quantity: 1,
    };

    const res = await fetch(`${baseUrl}/test-endpoint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(maliciousPayload),
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.data.title, "Clean Dish"); // Script tag stripped clean!
  });

  it("Step 3 (Rate Awareness Guard): blocks rapid endpoint probing exceeding threshold with 429", async () => {
    const validBody = JSON.stringify({ title: "Healthy Bowl", quantity: 1 });

    // Send 10 allowed requests
    for (let i = 0; i < 10; i++) {
      const res = await fetch(`${baseUrl}/test-endpoint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: validBody,
      });
      assert.strictEqual(res.status, 200);
    }

    // 11th probe request in the same second exceeds burst threshold -> 429
    const burstRes = await fetch(`${baseUrl}/test-endpoint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: validBody,
    });

    assert.strictEqual(burstRes.status, 429);
    const burstBody = (await burstRes.json()) as any;
    assert.strictEqual(burstBody.error, "burst_rate_limit_exceeded");
  });
});
