import { test } from "node:test";
import assert from "node:assert/strict";
import { getGroup, removeLine, closeGroup, groupSubtotalPaise, type GroupOrder } from "./groupOrdersApi";

const jsonRes = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const line = (o: Partial<GroupOrder["items"][number]>) => ({
  lineId: "l1", dishId: 1, name: "Dish", image: "", unitPrice: 20000, quantity: 1, customizations: [], addedBy: "u", addedByName: "A", ...o,
});
const group = (o: Partial<GroupOrder>): GroupOrder => ({
  id: 1, code: "ABC123", hostUserId: "host", hostName: "Riya", status: "open", items: [], participants: [], createdAt: "", updatedAt: "", closedAt: null, ...o,
});

test("getGroup GETs the public /group-orders/:code", async () => {
  let url = "";
  const impl = (async (u: string) => { url = u; return jsonRes({ group: group({}) }); }) as unknown as typeof fetch;
  await getGroup("ABC123", impl);
  assert.match(url, /\/api\/group-orders\/ABC123$/);
});

test("removeLine and closeGroup POST to their sub-routes", async () => {
  const calls: { url: string; body: any }[] = [];
  const impl = (async (u: string, init?: RequestInit) => { calls.push({ url: u, body: init?.body ? JSON.parse(String(init.body)) : undefined }); return jsonRes({ group: group({}) }); }) as unknown as typeof fetch;
  await removeLine("ABC123", "l9", impl);
  await closeGroup("ABC123", impl);
  assert.match(calls[0]!.url, /\/group-orders\/ABC123\/remove-line$/);
  assert.deepEqual(calls[0]!.body, { lineId: "l9" });
  assert.match(calls[1]!.url, /\/group-orders\/ABC123\/close$/);
});

test("groupSubtotalPaise sums unitPrice × quantity across lines", () => {
  const g = group({ items: [line({ unitPrice: 20000, quantity: 2 }), line({ lineId: "l2", unitPrice: 15000, quantity: 1 })] });
  assert.equal(groupSubtotalPaise(g), 55000);
});
