/**
 * /api/build — the api-server's deploy-truth probe.
 *
 * This endpoint exists so the cloud-run job can prove the revision now serving
 * traffic is the commit it just deployed. /livez cannot: a stale revision
 * answers it identically, so a deploy that never rolled is indistinguishable
 * from one that did. deploy.yml polls this until `sha` matches github.sha, and
 * a mismatch reaches the rollback step.
 *
 * These cases therefore pin the CONTRACT the deploy step depends on — the field
 * name, and that the value comes from the environment at run time rather than
 * being baked in. Changing either without changing deploy.yml would leave the
 * deploy verifying nothing while still going green.
 *
 * Run with:
 *   node --test --import tsx ./src/routes/health.build.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import http from "node:http";
import type { AddressInfo } from "node:net";

process.env["DATABASE_URL"] ||= "postgresql://dummy:dummy@localhost:5432/dummy";

const express = (await import("express")).default;

async function getBuild(env: Record<string, string | undefined>): Promise<{
  status: number;
  body: { app?: string; sha?: string; builtAt?: string | null };
}> {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  // Fresh import per case: the handler reads process.env at request time, but
  // re-importing keeps this honest if that ever changes to module scope.
  const { default: router } = await import(`./health?build=${Math.random()}`);
  const app = express();
  app.use(router);
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const { port } = server.address() as AddressInfo;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/build`);
    return { status: res.status, body: (await res.json()) as any };
  } finally {
    server.close();
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("reports BUILD_SHA from the environment under the key deploy.yml reads", async () => {
  const sha = "0123456789abcdef0123456789abcdef01234567";
  const { status, body } = await getBuild({ BUILD_SHA: sha, BUILT_AT: "2026-08-18T00:00:00Z" });
  assert.equal(status, 200);
  // deploy.yml does: json.load(...).get("sha") — this key name is load-bearing.
  assert.equal(body.sha, sha);
  assert.equal(body.builtAt, "2026-08-18T00:00:00Z");
  assert.equal(body.app, "tanmatra-api");
});

test("never 500s when the deploy did not set BUILD_SHA", async () => {
  // A crash here would make the deploy step retry ten times and then roll back
  // a revision that was actually fine.
  const { status, body } = await getBuild({ BUILD_SHA: undefined, BUILT_AT: undefined });
  assert.equal(status, 200);
  assert.equal(body.sha, "unknown");
  assert.equal(body.builtAt, null);
});

test("an unset sha can never be mistaken for a real commit", async () => {
  // deploy.yml compares this field to github.sha. The fallback must not be
  // something a comparison could accidentally satisfy (empty string, "0", null).
  const { body } = await getBuild({ BUILD_SHA: undefined });
  assert.equal(typeof body.sha, "string");
  assert.ok(body.sha && !/^[0-9a-f]{40}$/.test(body.sha), "fallback must not look like a sha");
});

test("requires no database — it is polled before dependencies are trusted", async () => {
  // DATABASE_URL points at a dummy host throughout this file; reaching a real
  // connection here would hang the deploy's verification loop.
  const { status } = await getBuild({ BUILD_SHA: "abc" });
  assert.equal(status, 200);
});
