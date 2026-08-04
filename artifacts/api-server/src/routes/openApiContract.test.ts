import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import express, { Router } from "express";
import { createServer, type Server } from "node:http";

process.env["DATABASE_URL"] ||=
  "postgres://postgres:postgres@127.0.0.1:5432/tanmatra_test";

const { default: openApiContractRouter, apiDeprecationHeaderGuard, validateRouterContract, OPENAPI_SPEC_V1 } =
  await import("./openApiContract");
const { default: opsRouter } = await import("./ops");
const { default: adminAuthRouter } = await import("./adminAuth");
const { default: adminStatusRouter } = await import("./adminStatus");
const { default: adminAuditRouter } = await import("./adminAudit");
const { default: adminRolesRouter } = await import("./adminRoles");
const { default: legalDocumentsRouter } = await import("./legalDocuments");

describe("OpenAPI Contract Specification & Admin/Ops Coverage (ADM-04)", () => {
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

    assert.ok(spec.paths["/ops/kds/orders"]);
    assert.ok(spec.paths["/legal-documents"]);
    assert.ok(spec.paths["/admin/legal-documents/{slug}/publish"]);
  });

  it("Acceptance: every route in opsRouter (/ops/*) is contracted in the OpenAPI specification", () => {
    const check = validateRouterContract(opsRouter, "/ops", OPENAPI_SPEC_V1);
    assert.strictEqual(
      check.valid,
      true,
      `Uncontracted /ops/* endpoints found: ${check.missing.join(", ")}`,
    );
    assert.ok(check.totalChecked >= 15, "Expected at least 15 ops routes to be checked");
  });

  it("Acceptance: every route in adminAuth and adminStatus is contracted", () => {
    const checkAuth = validateRouterContract(adminAuthRouter, "", OPENAPI_SPEC_V1);
    assert.strictEqual(
      checkAuth.valid,
      true,
      `Uncontracted adminAuth endpoints found: ${checkAuth.missing.join(", ")}`,
    );

    const checkStatus = validateRouterContract(adminStatusRouter, "", OPENAPI_SPEC_V1);
    assert.strictEqual(
      checkStatus.valid,
      true,
    );
  });

  it("Acceptance: every route in adminAudit is contracted", () => {
    const checkAudit = validateRouterContract(adminAuditRouter, "", OPENAPI_SPEC_V1);
    assert.strictEqual(
      checkAudit.valid,
      true,
      `Uncontracted adminAudit endpoints found: ${checkAudit.missing.join(", ")}`,
    );
  });

  it("Acceptance: every route in adminRoles is contracted", () => {
    const checkRoles = validateRouterContract(adminRolesRouter, "", OPENAPI_SPEC_V1);
    assert.strictEqual(
      checkRoles.valid,
      true,
      `Uncontracted adminRoles endpoints found: ${checkRoles.missing.join(", ")}`,
    );
  });

  it("Acceptance (ADM-20): every route in legalDocumentsRouter (public + /admin/legal-documents*) is contracted", () => {
    const check = validateRouterContract(legalDocumentsRouter, "", OPENAPI_SPEC_V1);
    assert.strictEqual(
      check.valid,
      true,
      `Uncontracted legalDocuments endpoints found: ${check.missing.join(", ")}`,
    );
    assert.ok(check.totalChecked >= 6, "Expected at least 6 legal-document routes to be checked");
  });
  it("Acceptance: contract validation fails when a router registers an uncontracted path", () => {
    const rogueRouter = Router();
    rogueRouter.get("/uncontracted-test-route", (_req, res) => res.send("ok"));

    const check = validateRouterContract(rogueRouter, "/ops", OPENAPI_SPEC_V1);
    assert.strictEqual(check.valid, false, "Validation must fail for uncontracted route");
    assert.ok(
      check.missing.includes("/ops/uncontracted-test-route"),
      "Must identify the exact uncontracted route",
    );
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
    assert.strictEqual(body.currentVersion, "v1.3.0");
    assert.ok(Array.isArray(body.changelog));
    assert.ok(body.changelog.length >= 2);
    assert.ok(body.changelog[0].changes.length > 0);
  });
});
