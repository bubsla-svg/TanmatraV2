import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import express from "express";
import { createServer, type Server } from "node:http";
import {
  concurrencyGuardMiddleware,
  serverlessTimeoutGuard,
  resetConcurrencyCountForTesting,
} from "./concurrencyGuard";

describe("Platform Execution Limits, Concurrency Bulkhead & Payload Ceiling Engine", () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    const app = express();
    app.use(express.json({ limit: "4.5mb" }));

    // Mount low concurrency guard (max 2) for testing
    app.use("/test-concurrency", concurrencyGuardMiddleware(2));

    app.get("/test-concurrency/slow", (req, res) => {
      setTimeout(() => {
        if (!res.headersSent) res.json({ ok: true });
      }, 500);
    });

    // Mount 100ms execution timeout watchdog for testing
    app.get("/test-timeout", serverlessTimeoutGuard(100), (_req, _res) => {
      // Simulate long-running AI generation past serverless timeout
    });

    // Payload endpoint capped at 4.5MB
    app.post("/test-payload", (req, res) => {
      res.json({ ok: true, size: req.body?.data?.length ?? 0 });
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
    resetConcurrencyCountForTesting();
  });

  it("Step 1 (Concurrency Ceiling): rejects execution bursts exceeding capacity with 503 and Retry-After header", async () => {
    // Start 2 slow concurrent requests
    const req1 = fetch(`${baseUrl}/test-concurrency/slow`);
    const req2 = fetch(`${baseUrl}/test-concurrency/slow`);

    // Give microtask queue time to increment active request count
    await new Promise((r) => setTimeout(r, 50));

    // 3rd concurrent request exceeds capacity -> 503
    const req3 = await fetch(`${baseUrl}/test-concurrency/slow`);

    assert.strictEqual(req3.status, 503);
    assert.strictEqual(req3.headers.get("retry-after"), "2");
    const body3 = (await req3.json()) as any;
    assert.strictEqual(body3.error, "concurrency_limit_exceeded");

    await Promise.all([req1, req2]);
  });

  it("Step 2 (Execution Timeout): watchdog triggers async hand-off with 202 status on long feature execution", async () => {
    const res = await fetch(`${baseUrl}/test-timeout`);

    assert.strictEqual(res.status, 202);
    const body = (await res.json()) as any;
    assert.strictEqual(body.status, "processing_async");
    assert.ok(body.pollUrl);
    assert.ok(body.message.includes("serverless timeout ceiling"));
  });

  it("Step 3 (Payload Limits): accepts payloads <= 4.5MB and rejects oversized payloads with 413", async () => {
    // Payload under 4.5MB -> 200 OK
    const validData = "A".repeat(1024 * 1024); // 1MB
    const resValid = await fetch(`${baseUrl}/test-payload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: validData }),
    });

    assert.strictEqual(resValid.status, 200);

    // Payload over 4.5MB -> 413 Payload Too Large
    const oversizedData = "X".repeat(5 * 1024 * 1024); // 5MB
    const resOversized = await fetch(`${baseUrl}/test-payload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: oversizedData }),
    });

    assert.strictEqual(resOversized.status, 413);
  });
});
