/**
 * Corporate lead client's wire contract (injected fetch, no network). Locks
 * method/path/body/credentials against routes/corporateLeads.ts.
 * Run: node --test --import tsx ./lib/corporateApi.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "./apiClient";
import { submitCorporateLead, type CorporateLeadInput } from "./corporateApi";

interface Call { method: string; url: string; credentials?: string; body?: unknown }

function fakeFetch(calls: Call[], respond: () => { status: number; body: unknown }): typeof fetch {
  return (async (url: unknown, init: Record<string, unknown>) => {
    calls.push({
      method: String(init.method),
      url: String(url),
      credentials: init.credentials as string | undefined,
      body: init.body,
    });
    const { status, body } = respond();
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: "",
      text: async () => (body === undefined ? "" : JSON.stringify(body)),
    };
  }) as unknown as typeof fetch;
}

const LEAD: CorporateLeadInput = {
  kind: "corporate",
  name: "Asha Rao",
  workEmail: "asha@acme.test",
  company: "Acme Corp",
  teamSizeBand: "21-100",
  source: "web:/corporate",
};

test("submitCorporateLead: POST /api/corporate-leads sends the lead verbatim", async () => {
  const calls: Call[] = [];
  const res = await submitCorporateLead(LEAD, fakeFetch(calls, () => ({ status: 201, body: { ok: true } })));
  const [c] = calls;
  assert.ok(c);
  assert.equal(c.method, "POST");
  assert.match(c.url, /\/api\/corporate-leads$/);
  assert.equal(c.credentials, "include");
  assert.deepEqual(JSON.parse(String(c.body)), LEAD);
  assert.equal(res.ok, true);
});

test("submitCorporateLead: 400 invalid payload surfaces as a typed ApiError", async () => {
  await assert.rejects(
    submitCorporateLead({ ...LEAD, workEmail: "not-an-email" }, fakeFetch([], () => ({ status: 400, body: { error: "invalid payload" } }))),
    (e) => e instanceof ApiError && e.status === 400 && /invalid payload/.test((e as Error).message),
  );
});

test("submitCorporateLead: 429 rate-limit surfaces as a typed ApiError (form shows a retry message)", async () => {
  await assert.rejects(
    submitCorporateLead(LEAD, fakeFetch([], () => ({ status: 429, body: { error: "rate_limited" } }))),
    (e) => e instanceof ApiError && e.status === 429,
  );
});
