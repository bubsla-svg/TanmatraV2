import { test } from "node:test";
import assert from "node:assert/strict";
import { getWalletBalancePaise, previewVoucher, redeemVoucher, getMyVouchers } from "./vouchersApi";

const jsonRes = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function fakeFetch(routes: (url: string, init: RequestInit) => Response) {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  const impl = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(String(init.body)) : undefined });
    return routes(url, init);
  }) as unknown as typeof fetch;
  return { impl, calls };
}

test("getWalletBalancePaise: GETs /credit-ledger and unwraps balancePaise", async () => {
  const { impl, calls } = fakeFetch(() => jsonRes({ balancePaise: 45000, entries: [] }));
  const bal = await getWalletBalancePaise(impl);
  assert.match(calls[0]!.url, /\/api\/credit-ledger$/);
  assert.equal(bal, 45000);
});

test("getWalletBalancePaise: defaults to 0 when the field is absent", async () => {
  const { impl } = fakeFetch(() => jsonRes({ entries: [] }));
  assert.equal(await getWalletBalancePaise(impl), 0);
});

test("previewVoucher: POSTs an upper-cased, trimmed code", async () => {
  const { impl, calls } = fakeFetch(() => jsonRes({ code: "GIFT500", amountPaise: 50000, status: "active", redeemed: false }));
  const p = await previewVoucher("  gift500 ", impl);
  assert.match(calls[0]!.url, /\/api\/vouchers\/preview$/);
  assert.deepEqual(calls[0]!.body, { code: "GIFT500" });
  assert.equal(p.amountPaise, 50000);
});

test("redeemVoucher: POSTs the code and returns { voucher, creditedPaise }", async () => {
  const { impl, calls } = fakeFetch(() =>
    jsonRes({ voucher: { id: 3, code: "GIFT500", amountPaise: 50000, status: "redeemed", redeemedAt: "t", createdAt: "t" }, creditedPaise: 50000 }),
  );
  const r = await redeemVoucher("gift500", impl);
  assert.match(calls[0]!.url, /\/api\/vouchers\/redeem$/);
  assert.equal(calls[0]!.method, "POST");
  assert.deepEqual(calls[0]!.body, { code: "GIFT500" });
  assert.equal(r.creditedPaise, 50000);
});

test("getMyVouchers: GETs /vouchers/mine and returns both lists", async () => {
  const { impl, calls } = fakeFetch(() => jsonRes({ purchased: [], redeemed: [{ id: 3, code: "GIFT500", amountPaise: 50000, status: "redeemed", redeemedAt: "t", createdAt: "t" }] }));
  const mine = await getMyVouchers(impl);
  assert.match(calls[0]!.url, /\/api\/vouchers\/mine$/);
  assert.equal(mine.redeemed.length, 1);
  assert.equal(mine.purchased.length, 0);
});
