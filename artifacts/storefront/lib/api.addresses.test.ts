/**
 * SF-04 — the address API client's wire contract, tested with an injected fetch
 * (no network). Locks the method/path/credentials/body shape against the server
 * routes (userAddresses.ts) and that a 401 surfaces as a typed ApiError so the
 * UI can offer sign-in.
 * Run: node --test --import tsx ./lib/api.addresses.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  ApiError,
  type AddressInput,
} from "./api";

interface Call {
  method: string;
  url: string;
  body?: string;
  hasContentType: boolean;
  credentials?: string;
}

function fakeFetch(calls: Call[], respond: () => { status: number; body: unknown }): typeof fetch {
  return (async (url: unknown, init: Record<string, unknown>) => {
    const headers = init.headers as Record<string, string> | undefined;
    calls.push({
      method: String(init.method),
      url: String(url),
      body: init.body as string | undefined,
      hasContentType: Boolean(headers?.["content-type"]),
      credentials: init.credentials as string | undefined,
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

const ADDR = {
  id: "7", label: "Home", type: "home", line1: "Tower 4", line2: "", city: "Noida",
  pincode: "201301", phone: "+919999999999", isDefault: true, createdAt: "t", updatedAt: "t",
};

test("getAddresses: GET /api/addresses, cookie-authed, no body/content-type", async () => {
  const calls: Call[] = [];
  const res = await getAddresses(fakeFetch(calls, () => ({ status: 200, body: { addresses: [ADDR] } })));
  const [c] = calls;
  assert.ok(c);
  assert.equal(c.method, "GET");
  assert.match(c.url, /\/api\/addresses$/);
  assert.equal(c.credentials, "include");
  assert.equal(c.body, undefined);
  assert.equal(c.hasContentType, false);
  assert.equal(res.addresses[0]?.id, "7");
});

test("createAddress: POST /api/addresses with the JSON body + content-type", async () => {
  const calls: Call[] = [];
  const input: AddressInput = { label: "Work", line1: "Block C", city: "Noida", pincode: "201301", phone: "+919000000000" };
  const res = await createAddress(input, fakeFetch(calls, () => ({ status: 201, body: { address: { ...ADDR, label: "Work" } } })));
  const [c] = calls;
  assert.ok(c);
  assert.equal(c.method, "POST");
  assert.match(c.url, /\/api\/addresses$/);
  assert.equal(c.hasContentType, true);
  assert.deepEqual(JSON.parse(c.body ?? "{}"), input);
  assert.equal(res.address.label, "Work");
});

test("updateAddress: PATCH /api/addresses/:id with only the partial fields", async () => {
  const calls: Call[] = [];
  await updateAddress("7", { isDefault: true }, fakeFetch(calls, () => ({ status: 200, body: { address: ADDR } })));
  const [c] = calls;
  assert.ok(c);
  assert.equal(c.method, "PATCH");
  assert.match(c.url, /\/api\/addresses\/7$/);
  assert.deepEqual(JSON.parse(c.body ?? "{}"), { isDefault: true });
});

test("deleteAddress: DELETE /api/addresses/:id, no body", async () => {
  const calls: Call[] = [];
  const res = await deleteAddress("7", fakeFetch(calls, () => ({ status: 200, body: { ok: true } })));
  const [c] = calls;
  assert.ok(c);
  assert.equal(c.method, "DELETE");
  assert.match(c.url, /\/api\/addresses\/7$/);
  assert.equal(c.body, undefined);
  assert.equal(res.ok, true);
});

test("401 surfaces as a typed ApiError (so the UI can offer sign-in)", async () => {
  const calls: Call[] = [];
  await assert.rejects(
    getAddresses(fakeFetch(calls, () => ({ status: 401, body: { error: "unauthorized" } }))),
    (e) => e instanceof ApiError && e.status === 401 && /unauthorized/.test((e as Error).message),
  );
});
