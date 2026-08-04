import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { type AddressInfo } from "node:net";
import http from "node:http";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { inArray, eq, and, desc } from "drizzle-orm";

process.env["DATABASE_URL"] ||= "postgres://postgres:postgres@127.0.0.1:5432/tanmatra_test";

const { db, usersTable, adminRolesTable, auditLogTable } = await import("@workspace/db");
const { default: adminRolesRouter } = await import("./adminRoles");

const execPromise = promisify(exec);

const RUN = randomUUID().slice(0, 8);
const USER_REGISTRY = new Map<string, { id: string }>();

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const r = req as any;
    const headerId = req.header("x-test-user-id");
    const u = headerId ? USER_REGISTRY.get(headerId) : undefined;
    if (u) r.user = u;
    r.isAuthenticated = () => r.user != null;
    r.log = { error: () => {}, info: () => {}, warn: () => {}, debug: () => {} };
    next();
  });
  app.use(adminRolesRouter);
  return app;
}

let server: http.Server;
let baseUrl = "";
const CREATED_USER_IDS: string[] = [];

test("setup server", async () => {
  await new Promise<void>((resolve) => {
    server = http.createServer(makeApp()).listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  
  // Cleanup roles first due to FK
  if (CREATED_USER_IDS.length > 0) {
    await db.delete(adminRolesTable).where(inArray(adminRolesTable.userId, CREATED_USER_IDS));
    await db.delete(auditLogTable).where(inArray(auditLogTable.resourceId, CREATED_USER_IDS)); // Cleanup audits too
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});

async function makeUser(label: string): Promise<{ id: string }> {
  const id = randomUUID();
  await db.insert(usersTable).values({
    id,
    email: `admin-roles-${label}-${id}@example.test`,
    firstName: label,
  });
  CREATED_USER_IDS.push(id);
  const user = { id };
  USER_REGISTRY.set(id, user);
  return user;
}

async function assignRole(userId: string, role: string) {
  await db.insert(adminRolesTable).values({
    userId,
    role,
  });
}

test("Acceptance (a): the CLI inserts an owner grant for a real user; a second run is idempotent", async () => {
  const user = await makeUser("cli-owner");
  
  // Run CLI
  const { stdout, stderr } = await execPromise(`pnpm --filter @workspace/scripts run assign-admin-role --user ${user.id} --role owner`);
  
  assert.match(stdout, /Successfully assigned role owner/);
  
  // Verify DB
  const [grant] = await db.select().from(adminRolesTable).where(and(eq(adminRolesTable.userId, user.id), eq(adminRolesTable.role, "owner")));
  assert.ok(grant);

  // Run again
  const { stdout: stdout2 } = await execPromise(`pnpm --filter @workspace/scripts run assign-admin-role --user ${user.id} --role owner`);
  assert.match(stdout2, /already has role owner/);
});

test("Acceptance (b): POST /admin/roles from a catalog-only operator returns 403; from an owner returns 200", async () => {
  const owner = await makeUser("owner");
  await assignRole(owner.id, "owner");

  const catalogOp = await makeUser("catalog-op");
  await assignRole(catalogOp.id, "catalog");

  const targetUser = await makeUser("target-user");

  // Try from catalogOp
  const resDeny = await fetch(`${baseUrl}/admin/roles`, {
    method: "POST",
    body: JSON.stringify({ userId: targetUser.id, role: "kitchen" }),
    headers: {
      "Content-Type": "application/json",
      "x-test-user-id": catalogOp.id,
    },
  });
  assert.equal(resDeny.status, 403);

  // Try from owner
  const resAllow = await fetch(`${baseUrl}/admin/roles`, {
    method: "POST",
    body: JSON.stringify({ userId: targetUser.id, role: "kitchen" }),
    headers: {
      "Content-Type": "application/json",
      "x-test-user-id": owner.id,
    },
  });
  assert.equal(resAllow.status, 200);

  // Verify grant
  const [grant] = await db.select().from(adminRolesTable).where(and(eq(adminRolesTable.userId, targetUser.id), eq(adminRolesTable.role, "kitchen")));
  assert.ok(grant);
});

test("POST /admin/roles blocks synthetic operator (x-admin-token)", async () => {
  const targetUser = await makeUser("target-synthetic");
  const ADMIN_TOKEN = "test-token-synthetic";
  process.env["RD_ADMIN_TOKEN"] = ADMIN_TOKEN;

  const res = await fetch(`${baseUrl}/admin/roles`, {
    method: "POST",
    body: JSON.stringify({ userId: targetUser.id, role: "kitchen" }),
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": ADMIN_TOKEN,
    },
  });

  // It should fail with 403 because x-admin-token is NOT an owner (sensitive role).
  assert.equal(res.status, 403);
});

test("Acceptance (c): a single grant writes exactly one audit_log row", async () => {
  const owner = await makeUser("owner-audit");
  await assignRole(owner.id, "owner");
  const targetUser = await makeUser("target-audit");

  // Clear previous audits for this target if any (should be clean)
  
  await fetch(`${baseUrl}/admin/roles`, {
    method: "POST",
    body: JSON.stringify({ userId: targetUser.id, role: "support" }),
    headers: {
      "Content-Type": "application/json",
      "x-test-user-id": owner.id,
    },
  });

  const audits = await db
    .select()
    .from(auditLogTable)
    .where(and(eq(auditLogTable.resourceId, targetUser.id), eq(auditLogTable.action, "admin.role_grant")));

  assert.equal(audits.length, 1);
  assert.equal(audits[0].actorId, owner.id);
  const meta = JSON.parse(audits[0].meta as string);
  assert.deepEqual(meta.after, { role: "support" });
});

test("Acceptance (d): POST with invalid role -> 422; non-existent userId -> 404; re-granting -> 200", async () => {
  const owner = await makeUser("owner-validation");
  await assignRole(owner.id, "owner");
  const targetUser = await makeUser("target-validation");

  // Invalid role
  const resInvalidRole = await fetch(`${baseUrl}/admin/roles`, {
    method: "POST",
    body: JSON.stringify({ userId: targetUser.id, role: "superadmin" }),
    headers: {
      "Content-Type": "application/json",
      "x-test-user-id": owner.id,
    },
  });
  assert.equal(resInvalidRole.status, 422);

  // Non-existent user
  const resNoUser = await fetch(`${baseUrl}/admin/roles`, {
    method: "POST",
    body: JSON.stringify({ userId: randomUUID(), role: "kitchen" }),
    headers: {
      "Content-Type": "application/json",
      "x-test-user-id": owner.id,
    },
  });
  assert.equal(resNoUser.status, 404);

  // Re-granting (idempotent 200)
  await assignRole(targetUser.id, "kitchen"); // Grant first
  
  const resReGrant = await fetch(`${baseUrl}/admin/roles`, {
    method: "POST",
    body: JSON.stringify({ userId: targetUser.id, role: "kitchen" }),
    headers: {
      "Content-Type": "application/json",
      "x-test-user-id": owner.id,
    },
  });
  assert.equal(resReGrant.status, 200);
  
  // Verify still only one row in DB for this combo
  const grants = await db.select().from(adminRolesTable).where(and(eq(adminRolesTable.userId, targetUser.id), eq(adminRolesTable.role, "kitchen")));
  assert.equal(grants.length, 1);
});

test("Acceptance (e): DELETE removes grant and writes audit row; deleting non-existent -> 404", async () => {
  const owner = await makeUser("owner-delete");
  await assignRole(owner.id, "owner");
  const targetUser = await makeUser("target-delete");
  await assignRole(targetUser.id, "kitchen");

  // Delete
  const resDelete = await fetch(`${baseUrl}/admin/roles/${targetUser.id}/kitchen`, {
    method: "DELETE",
    headers: {
      "x-test-user-id": owner.id,
    },
  });
  assert.equal(resDelete.status, 200);

  // Verify removed
  const [grant] = await db.select().from(adminRolesTable).where(and(eq(adminRolesTable.userId, targetUser.id), eq(adminRolesTable.role, "kitchen")));
  assert.equal(grant, undefined);

  // Verify audit
  const audits = await db
    .select()
    .from(auditLogTable)
    .where(and(eq(auditLogTable.resourceId, targetUser.id), eq(auditLogTable.action, "admin.role_revoke")));
  
  assert.equal(audits.length, 1);
  const meta = JSON.parse(audits[0].meta as string);
  assert.deepEqual(meta.before, { role: "kitchen" });

  // Delete non-existent
  const resDeleteNonExistent = await fetch(`${baseUrl}/admin/roles/${targetUser.id}/kitchen`, {
    method: "DELETE",
    headers: {
      "x-test-user-id": owner.id,
    },
  });
  assert.equal(resDeleteNonExistent.status, 404);
});
