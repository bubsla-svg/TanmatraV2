import { test } from "node:test";
import assert from "node:assert/strict";
import { getRds, getRd, hasFreeIntro, fromPricePaise, type RdProfile } from "./rdApi";

const RD: RdProfile = {
  slug: "rd-anjali-nair",
  name: "Anjali Nair",
  title: "Lead Registered Dietitian",
  credentials: ["RD (India)", "MSc Clinical Nutrition"],
  bio: "Metabolic health desk.",
  yearsExperience: 12,
  languages: ["English", "Hindi"],
  specialties: ["Type 2 diabetes", "PCOS"],
  bookable: true,
  pricing: { intro_15m: 0, follow_up_30m: 120000, follow_up_45m: 180000 },
};

const jsonRes = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("getRds: unwraps { rds } from the directory", async () => {
  let calledUrl = "";
  const fetchImpl = (async (url: string) => {
    calledUrl = url;
    return jsonRes({ rds: [RD] });
  }) as unknown as typeof fetch;
  const rds = await getRds(fetchImpl);
  assert.match(calledUrl, /\/api\/rd\/directory$/);
  assert.equal(rds.length, 1);
  assert.equal(rds[0]!.slug, "rd-anjali-nair");
});

test("getRds: [] on non-2xx", async () => {
  const fetchImpl = (async () => jsonRes({ error: "boom" }, 500)) as unknown as typeof fetch;
  assert.deepEqual(await getRds(fetchImpl), []);
});

test("getRds: [] when the fetch throws (cold API)", async () => {
  const fetchImpl = (async () => {
    throw new Error("ECONNREFUSED");
  }) as unknown as typeof fetch;
  assert.deepEqual(await getRds(fetchImpl), []);
});

test("getRd: finds a profile by slug from the roster", async () => {
  const fetchImpl = (async () => jsonRes({ rds: [RD] })) as unknown as typeof fetch;
  const rd = await getRd("rd-anjali-nair", fetchImpl);
  assert.equal(rd?.name, "Anjali Nair");
});

test("getRd: null when the slug is not in the roster", async () => {
  const fetchImpl = (async () => jsonRes({ rds: [RD] })) as unknown as typeof fetch;
  assert.equal(await getRd("rd-nobody", fetchImpl), null);
});

test("hasFreeIntro / fromPricePaise: derive display facts from pricing", () => {
  assert.equal(hasFreeIntro(RD.pricing), true);
  assert.equal(fromPricePaise(RD.pricing), 120000);
  assert.equal(fromPricePaise({ intro_15m: 0, follow_up_30m: 0, follow_up_45m: 0 }), null);
});
