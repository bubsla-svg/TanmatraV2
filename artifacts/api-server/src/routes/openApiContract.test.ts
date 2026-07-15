import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import express from "express";
import { createServer, type Server } from "node:http";
import openApiContractRouter, { apiDeprecationHeaderGuard } from "./openApiContract";

describe("OpenAPI Contract Specification, Explicit Versioning & API Changelog Engine", () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use(openApiContractRouter);

    // Mock deprecated v0 route for testing
    app.get("/v0/legacy-menu", apiDeprecationHeaderGuard("2026-06-01", "2026-12-31"), (_req, res) => {
      res.json({ ok: true, legacy: true });
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

  it("Step 1 (OpenAPI Contract): exposes GET /v1/openapi.json returning OpenAPI 3.0 specification", async () => {
    const res = await fetch(`${baseUrl}/v1/openapi.json`);
    assert.strictEqual(res.status, 200);

    const spec = (await res.json()) as any;
    assert.strictEqual(spec.openapi, "3.0.3");
    assert.ok(spec.info.title.includes("Tanmatra"));
    assert.ok(spec.paths["/catalog/skus"]);
  });

  it("Step 2 (Explicit Versioning & Deprecation Guard): sets Deprecation and Sunset headers on legacy routes", async () => {
    const res = await fetch(`${baseUrl}/v0/legacy-menu`);
    assert.strictEqual(res.status, 200);

    assert.strictEqual(res.headers.get("deprecation"), "2026-06-01");
    assert.strictEqual(res.headers.get("sunset"), "2026-12-31");
    assert.ok(res.headers.get("link")?.includes("/api/v1/changelog"));
  });

  it("Step 3 (Publish Changelog): exposes GET /v1/changelog listing active versions and migration timelines", async () => {
    const res = await fetch(`${baseUrl}/v1/changelog`);
    assert.strictEqual(res.status, 200);

    const body = (await res.json()) as any;
    assert.strictEqual(body.currentVersion, "v1.2.0");
    assert.ok(Array.isArray(body.changelog));
    assert.ok(body.changelog.length >= 2);
    assert.ok(body.changelog[0].changes.length > 0);
  });
});
