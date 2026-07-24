import { test } from "node:test";
import assert from "node:assert/strict";
import { getCreditLedger, creditLabel, type CreditEntry } from "./billingApi";

const jsonRes = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const entry = (o: Partial<CreditEntry>): CreditEntry => ({
  id: 1, deltaPaise: 50000, reason: "voucher_redeemed", refType: "voucher", refId: "3", note: null, createdAt: "2026-07-24T00:00:00.000Z", ...o,
});

test("getCreditLedger: GETs /credit-ledger and returns entries + balance", async () => {
  let url = "";
  const impl = (async (u: string) => { url = u; return jsonRes({ entries: [entry({})], balancePaise: 95000 }); }) as unknown as typeof fetch;
  const led = await getCreditLedger(impl);
  assert.match(url, /\/api\/credit-ledger$/);
  assert.equal(led.balancePaise, 95000);
  assert.equal(led.entries.length, 1);
});

test("getCreditLedger: resilient defaults ([] / 0) on a sparse body", async () => {
  const impl = (async () => jsonRes({})) as unknown as typeof fetch;
  const led = await getCreditLedger(impl);
  assert.deepEqual(led.entries, []);
  assert.equal(led.balancePaise, 0);
});

test("creditLabel: prefers the note, else humanises the reason", () => {
  assert.equal(creditLabel(entry({ note: "Voucher GIFT500" })), "Voucher GIFT500");
  assert.equal(creditLabel(entry({ note: null, reason: "referral_bonus" })), "Referral bonus");
  assert.equal(creditLabel(entry({ note: null, reason: "checkout_applied" })), "Checkout applied");
});
