import { test } from "node:test";
import assert from "node:assert/strict";
import { saveClinical, deleteHealthField, deleteAccount } from "./preferencesApi";
import { grantHealthConsent, revokeHealthConsent, hasHealthConsent } from "./healthConsent";

const jsonRes = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("saveClinical PATCHes /preferences with the clinical subset", async () => {
  let seen: { url: string; method?: string; body: any } | null = null;
  const impl = (async (u: string, init?: RequestInit) => { seen = { url: u, method: init?.method, body: JSON.parse(String(init?.body)) }; return jsonRes({ preferences: {} }); }) as unknown as typeof fetch;
  await saveClinical({ medicalConditions: ["diabetes"], hba1cPct: 6.1, pcosHistory: null, heightCm: 170, weightKg: 68 }, impl);
  assert.match(seen!.url, /\/api\/preferences$/);
  assert.equal(seen!.method, "PATCH");
  assert.deepEqual(seen!.body.medicalConditions, ["diabetes"]);
  assert.equal(seen!.body.hba1cPct, 6.1);
});

test("deleteHealthField hits the erasure route, passing ?condition when given", async () => {
  const urls: string[] = [];
  const impl = (async (u: string, init?: RequestInit) => { urls.push(u); assert.equal(init?.method, "DELETE"); return jsonRes({ success: true, message: "removed" }); }) as unknown as typeof fetch;
  await deleteHealthField("weightKg", undefined, impl);
  await deleteHealthField("medicalConditions", "diabetes", impl);
  assert.match(urls[0]!, /\/api\/user\/health-data\/weightKg$/);
  assert.match(urls[1]!, /\/api\/user\/health-data\/medicalConditions\?condition=diabetes$/);
});

test("deleteAccount DELETEs /user/account", async () => {
  let url = "";
  const impl = (async (u: string) => { url = u; return jsonRes({ success: true }); }) as unknown as typeof fetch;
  await deleteAccount(impl);
  assert.match(url, /\/api\/user\/account$/);
});

test("consent client: grant sets health processing true; hasHealthConsent reads the flag", async () => {
  let body: any = null;
  const impl = (async (_u: string, init?: RequestInit) => { body = JSON.parse(String(init?.body)); return jsonRes({ consent: { purposeHealthDataProcessing: true } }); }) as unknown as typeof fetch;
  await grantHealthConsent(impl);
  assert.equal(body.purposeHealthDataProcessing, true);
  assert.equal(body.consentVersion, "2023_DPDPA_v1");
  await revokeHealthConsent(impl);
  assert.equal(body.purposeHealthDataProcessing, false);
  assert.equal(hasHealthConsent({ purposeHealthDataProcessing: true } as any), true);
  assert.equal(hasHealthConsent(null), false);
});
