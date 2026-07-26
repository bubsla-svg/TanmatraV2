/**
 * Integration tests for B2B Corporate Teams seat tiers (P-4 / Table II.2).
 *
 * Confirms exact server-side quote and invoice calculation across seat count
 * boundaries (9 vs 10, 24 vs 25, 49 vs 50) and proves that client-supplied
 * totals are ignored in favor of server-side computation.
 */

import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { type AddressInfo } from "node:net";
import http from "node:http";

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import corporateRouter from "./corporate";

let server: http.Server;
let baseUrl = "";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const r = req as unknown as {
      log: Record<string, (...a: unknown[]) => void>;
      isAuthenticated: () => boolean;
      user?: { id: string; email?: string | null; firstName?: string | null };
    };
    r.isAuthenticated = () => true;
    r.user = { id: "test-user-corp", email: "corp@example.test", firstName: "Corp" };
    r.log = {
      error: () => {},
      info: () => {},
      warn: () => {},
      debug: () => {},
      trace: () => {},
      fatal: () => {},
    };
    next();
  });
  app.use(corporateRouter);
  return app;
}

async function api(method: string, path: string, body?: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

before(async () => {
  const app = makeApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

// ── Seat Boundary Verification (9 vs 10, 24 vs 25, 49 vs 50) ─────────────────

test("POST /corporate/teams/quote — strictly verifies seat tier boundaries (9 vs 10, 24 vs 25, 49 vs 50)", async () => {
  // 9 seats: rejected (minimum 10 seats required)
  const r9 = await api("POST", "/corporate/teams/quote", { seats: 9, track: "veg" });
  assert.equal(r9.status, 400);
  assert.equal(r9.json.code, "insufficient_seats");
  assert.equal(r9.json.minSeats, 10);

  // 10 seats: Tier 1 (₹209/meal veg)
  const r10 = await api("POST", "/corporate/teams/quote", { seats: 10, track: "veg" });
  assert.equal(r10.status, 200);
  assert.equal(r10.json.quote.tier, 1);
  assert.equal(r10.json.quote.pricePerMealPaise, 20900);
  assert.ok(r10.json.quote.discountSource.includes("Tier 1 (10-24 seats: ₹209/meal)"));

  // 24 seats: Tier 1 (₹209/meal veg)
  const r24 = await api("POST", "/corporate/teams/quote", { seats: 24, track: "veg" });
  assert.equal(r24.status, 200);
  assert.equal(r24.json.quote.tier, 1);
  assert.equal(r24.json.quote.pricePerMealPaise, 20900);

  // 25 seats: Tier 2 (₹199/meal veg)
  const r25 = await api("POST", "/corporate/teams/quote", { seats: 25, track: "veg" });
  assert.equal(r25.status, 200);
  assert.equal(r25.json.quote.tier, 2);
  assert.equal(r25.json.quote.pricePerMealPaise, 19900);
  assert.ok(r25.json.quote.discountSource.includes("Tier 2 (25-49 seats: ₹199/meal)"));

  // 49 seats: Tier 2 (₹199/meal veg)
  const r49 = await api("POST", "/corporate/teams/quote", { seats: 49, track: "veg" });
  assert.equal(r49.status, 200);
  assert.equal(r49.json.quote.tier, 2);
  assert.equal(r49.json.quote.pricePerMealPaise, 19900);

  // 50 seats: Tier 3 (₹189/meal veg, DELIBERATELY under ₹200 meal voucher tax-free ceiling)
  const r50 = await api("POST", "/corporate/teams/quote", { seats: 50, track: "veg" });
  assert.equal(r50.status, 200);
  assert.equal(r50.json.quote.tier, 3);
  assert.equal(r50.json.quote.pricePerMealPaise, 18900);
  assert.ok(r50.json.quote.discountSource.includes("Tier 3 (50+ seats: ₹189/meal)"));
});

test("POST /corporate/teams/invoice — authoritatively computes server-side and logs discount source, ignoring client-supplied total", async () => {
  const reqBody = {
    seats: 30,
    track: "nonveg", // Tier 2 nonveg = ₹219/meal (21900 paise)
    mealsPerCycle: 22,
    companyName: "Acme Corp",
    contactEmail: "hr@acmex.test",
    clientTotalPaise: 1, // Tampered client total
  };

  const res = await api("POST", "/corporate/teams/invoice", reqBody);
  assert.equal(res.status, 200, JSON.stringify(res.json));

  const inv = res.json.invoice;
  assert.equal(inv.authoritative, true);
  assert.equal(inv.seats, 30);
  assert.equal(inv.tier, 2);
  assert.equal(inv.pricePerMealPaise, 21900);
  assert.equal(inv.totalMeals, 30 * 22); // 660 meals
  assert.equal(inv.cycleTotalPaise, 660 * 21900); // 14454000 paise (₹144,540) — clientTotalPaise=1 ignored!
  assert.equal(inv.preTaxPaise, Math.round(14454000 / 1.05));
  assert.equal(inv.gstPaise, 14454000 - inv.preTaxPaise);
  assert.ok(inv.discountSource.includes("Corporate Teams Tier 2"));
});
