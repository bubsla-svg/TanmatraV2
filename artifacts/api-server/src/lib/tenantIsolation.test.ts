import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import express from "express";
import { createServer, type Server } from "node:http";
import {
  buildTenantCacheKey,
  auditTenantResourceAccess,
  tenantIsolationGuard,
  tenantAuditLogs,
} from "./tenantIsolation";

describe("Multi-Tenant Isolation, Cache Scoping & Security Audit Engine", () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    const app = express();
    app.use(express.json());

    // Mock authentication middleware populating req.user
    app.use((req, _res, next) => {
      const tenantHeader = req.headers["x-tenant-id"] as string;
      if (tenantHeader) {
        (req as any).user = { id: `user_${tenantHeader}`, tenantId: tenantHeader };
      }
      next();
    });

    // Protected multi-tenant route checking targeted tenant parameter
    app.get(
      "/tenants/:tenantId/dashboard",
      tenantIsolationGuard((req) => req.params.tenantId as string),
      (req, res) => {
        res.json({ ok: true, data: `Private dashboard metrics for ${req.params.tenantId}` });
      }
    );

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

  it("Step 1 (Tenant-Aware Cache Keys): constructs tenant-scoped keys and throws on missing context", () => {
    const key = buildTenantCacheKey("tenant_alpha", "orders_summary");
    assert.strictEqual(key, "tenant:tenant_alpha:orders_summary");

    assert.throws(() => {
      buildTenantCacheKey("", "orders_summary");
    }, /Tenant isolation failure/);
  });

  it("Step 2 (Legal Audit Trail): records forensic access log and detects cross-tenant breach attempt", () => {
    tenantAuditLogs.length = 0;

    const auditRes = auditTenantResourceAccess({
      requestingTenantId: "tenant_customer_A",
      requestingUserId: "user_101",
      targetResourceId: "/dashboard/revenue",
      targetTenantId: "tenant_customer_B", // Cross-Tenant Probe!
      action: "GET",
      ip: "192.168.1.50",
    });

    assert.strictEqual(auditRes.isAuthorized, false);
    assert.strictEqual(auditRes.record.breachDetected, true);
    assert.strictEqual(auditRes.record.requestingTenantId, "tenant_customer_A");
    assert.strictEqual(auditRes.record.targetTenantId, "tenant_customer_B");
    assert.ok(tenantAuditLogs.length > 0);
  });

  it("Step 3 (Tenant Isolation Guard): allows same-tenant requests and blocks cross-tenant access with 403", async () => {
    // 1. Same Tenant Access (Customer A accessing Customer A dashboard) -> 200 OK
    const resAuthorized = await fetch(`${baseUrl}/tenants/tenant_customer_A/dashboard`, {
      headers: { "x-tenant-id": "tenant_customer_A" },
    });
    assert.strictEqual(resAuthorized.status, 200);
    const bodyAuthorized = (await resAuthorized.json()) as any;
    assert.strictEqual(bodyAuthorized.ok, true);

    // 2. Cross-Tenant Leak Attempt (Customer A trying to access Customer B dashboard) -> 403 Forbidden
    const resUnauthorized = await fetch(`${baseUrl}/tenants/tenant_customer_B/dashboard`, {
      headers: { "x-tenant-id": "tenant_customer_A" },
    });

    assert.strictEqual(resUnauthorized.status, 403);
    const bodyUnauthorized = (await resUnauthorized.json()) as any;
    assert.strictEqual(bodyUnauthorized.error, "tenant_isolation_violation");
    assert.ok(bodyUnauthorized.auditEventId);
  });
});
