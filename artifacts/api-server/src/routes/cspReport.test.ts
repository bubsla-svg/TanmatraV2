import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import express from "express";
import { createServer, type Server } from "node:http";
import cspReportRouter, { cspViolationLogs } from "./cspReport";

describe("Content Security Policy (CSP) Report-Only & Audit Route", () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use(express.text({ type: "application/csp-report" }));
    app.use(cspReportRouter);

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

  it("ingests CSP violation report payloads and returns 204 No Content gracefully", async () => {
    const violationPayload = {
      "csp-report": {
        "document-uri": "https://tanmatra.food/",
        referrer: "",
        "violated-directive": "script-src",
        "effective-directive": "script-src",
        "original-policy": "default-src 'self'; script-src 'self' https://images.unsplash.com",
        disposition: "report",
        "blocked-uri": "https://unapproved-analytics.com/tracker.js",
        "status-code": 200,
      },
    };

    const res = await fetch(`${baseUrl}/v1/csp-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(violationPayload),
    });

    assert.strictEqual(res.status, 204);
    assert.ok(cspViolationLogs.length > 0);

    const logged = cspViolationLogs.find(
      (l) => l?.["blocked-uri"] === "https://unapproved-analytics.com/tracker.js"
    );
    assert.ok(logged);
    assert.strictEqual(logged["effective-directive"], "script-src");
  });

  it("exposes the GET /v1/csp-report/audit inspection endpoint", async () => {
    const res = await fetch(`${baseUrl}/v1/csp-report/audit`);
    assert.strictEqual(res.status, 200);

    const body = (await res.json()) as { totalViolations: number; violations: any[] };
    assert.ok(typeof body.totalViolations === "number");
    assert.ok(Array.isArray(body.violations));
  });
});
