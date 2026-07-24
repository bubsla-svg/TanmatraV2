import { test } from "node:test";
import assert from "node:assert/strict";
import { getInvite, acceptInvite, getCompany, pickOfficeOrder, closeOfficeOrder, officeWindowOpen, type OfficeOrder } from "./companyApi";

const jsonRes = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("invite endpoints hit /companies/invites/:token(/accept)", async () => {
  const urls: { url: string; method?: string }[] = [];
  const impl = (async (u: string, init?: RequestInit) => { urls.push({ url: u, method: init?.method }); return jsonRes({}); }) as unknown as typeof fetch;
  await getInvite("tok_1", impl);
  await acceptInvite("tok_1", impl);
  assert.match(urls[0]!.url, /\/api\/companies\/invites\/tok_1$/);
  assert.match(urls[1]!.url, /\/api\/companies\/invites\/tok_1\/accept$/);
  assert.equal(urls[1]!.method, "POST");
});

test("getCompany GETs /companies/:slug", async () => {
  let url = "";
  const impl = (async (u: string) => { url = u; return jsonRes({}); }) as unknown as typeof fetch;
  await getCompany("acme", impl);
  assert.match(url, /\/api\/companies\/acme$/);
});

test("office pick/close hit their sub-routes with the items body", async () => {
  const calls: { url: string; body: any }[] = [];
  const impl = (async (u: string, init?: RequestInit) => { calls.push({ url: u, body: init?.body ? JSON.parse(String(init.body)) : undefined }); return jsonRes({ officeOrder: {} }); }) as unknown as typeof fetch;
  await pickOfficeOrder(9, [{ dishId: 1, quantity: 2 }], impl);
  await closeOfficeOrder(9, impl);
  assert.match(calls[0]!.url, /\/api\/office-orders\/9\/pick$/);
  assert.deepEqual(calls[0]!.body, { items: [{ dishId: 1, quantity: 2 }] });
  assert.match(calls[1]!.url, /\/api\/office-orders\/9\/close$/);
});

test("officeWindowOpen is true only when open and before the cutoff", () => {
  const base = { id: 1, companyId: 1, title: "", address: { line: "", city: "", pincode: "" }, perEmployeeBudgetPaise: 40000, scheduledFor: "", picks: [], totalPaise: 0, closedAt: null } as unknown as OfficeOrder;
  const now = 1_000_000;
  assert.equal(officeWindowOpen({ ...base, status: "open", windowClosesAt: new Date(now + 1000).toISOString() }, now), true);
  assert.equal(officeWindowOpen({ ...base, status: "open", windowClosesAt: new Date(now - 1000).toISOString() }, now), false);
  assert.equal(officeWindowOpen({ ...base, status: "closed", windowClosesAt: new Date(now + 1000).toISOString() }, now), false);
});
