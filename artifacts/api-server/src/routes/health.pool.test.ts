/**
 * Connection-pool telemetry (audit-validation 3.2: the pool was unmonitored).
 *
 * The value under test is `saturated`, and the distinction it draws is the
 * whole point: a pool running at its ceiling with nobody queued is a pool
 * being USED, not a pool in trouble. Only a non-empty wait queue means the
 * pool has become the bottleneck. Getting that wrong in either direction is
 * what makes telemetry useless — warn on every busy pool and the signal is
 * filtered out before the incident that needs it; warn only on some harder
 * condition and the incident passes unnamed.
 *
 * Run with:
 *   node --test --import tsx ./src/routes/health.pool.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env["DATABASE_URL"] ||= "postgresql://dummy:dummy@localhost:5432/dummy";

const { poolSnapshots } = await import("@workspace/db");

test("reports both named pools", () => {
  const names = poolSnapshots().map((p) => p.name).sort();
  // The override carve-out exists so staff dispatch never queues behind the
  // auto-dispatcher. Losing it from telemetry would hide exactly the
  // starvation it was created to prevent.
  assert.deepEqual(names, ["main", "override"]);
});

test("an idle pool is not saturated and reports zero utilisation", () => {
  // Nothing has issued a query in this process, so both pools are empty.
  for (const p of poolSnapshots()) {
    assert.equal(p.waiting, 0, `${p.name} should have no waiters`);
    assert.equal(p.saturated, false, `${p.name} should not be saturated`);
    assert.equal(p.utilisation, 0, `${p.name} should be unused`);
  }
});

test("every field is a finite number, never NaN", () => {
  // utilisation divides by a ceiling that comes from an env var. A malformed
  // PG_POOL_MAX must not turn telemetry into NaN — a NaN here would render as
  // null in the log line and quietly read as "no data" during an incident.
  for (const p of poolSnapshots()) {
    for (const k of ["total", "idle", "waiting", "max", "utilisation"] as const) {
      assert.ok(Number.isFinite(p[k]), `${p.name}.${k} must be finite, got ${p[k]}`);
    }
    assert.equal(typeof p.saturated, "boolean");
  }
});

test("the configured ceilings are reported, not guessed", () => {
  const byName = Object.fromEntries(poolSnapshots().map((p) => [p.name, p]));
  // Defaults documented in lib/db: main ~16, override carve-out 4.
  assert.equal(byName["main"]!.max, Number(process.env["PG_POOL_MAX"] ?? 16));
  assert.equal(byName["override"]!.max, Number(process.env["PG_OVERRIDE_POOL_MAX"] ?? 4));
});
