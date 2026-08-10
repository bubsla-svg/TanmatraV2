/**
 * Integration tests for PlanDraft generation and lineup editing (PR A2.2).
 *
 *   POST /plan-drafts/:id/generate                 — DEFECT-PLAN-GEN-001
 *   GET  /plan-drafts/:id/candidates               — DEFECT-PLAN-CANDIDATE-001
 *   POST /plan-drafts/:id/lineup/replace
 *   POST /plan-drafts/:id/lineup/lock
 *   GET  /plan-drafts/:id/accompaniment-options    — DEFECT-PLAN-OPTIONS-001
 *   POST /plan-drafts/:id/lineup/accompaniments
 *   POST /plan-drafts/:id/lineup/shuffle
 *   POST /plan-drafts/:id/lineup/undo
 *
 * Run with:
 *   node --test --import tsx ./src/routes/planDraftLineup.test.ts
 *
 * Real Postgres and real `cookie-parser` — guest ownership is cookie-based and
 * every write is a version compare-and-swap, so both must be exercised for
 * real rather than stubbed. Mounts BOTH routers, because a lineup edit is
 * always preceded by the A2.1 create/patch calls that configure the draft.
 */

import assert from "node:assert/strict";
import { test, after, before } from "node:test";
import { randomUUID } from "node:crypto";
import { type AddressInfo } from "node:net";
import http from "node:http";

import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cookieParser from "cookie-parser";
import { inArray } from "drizzle-orm";
import { db, planDraftsTable, usersTable, type PlanDraft } from "@workspace/db";

import planDraftsRouter from "./planDrafts";
import planDraftLineupRouter from "./planDraftLineup";

/** A veg wrap in the live seed catalog that carries real, priced
 *  customisation groups — the only fixture in this file that depends on
 *  catalog content, and asserted before use so a catalog change fails loudly
 *  here instead of silently weakening the accompaniment test. */
const CUSTOMISABLE_DISH_ID = 121;
const BREAD_GROUP = "Choose Bread Type";
const MULTIGRAIN = "Multigrain Bread";
const MULTIGRAIN_PAISE = 1500;
const ADDONS_GROUP = "Add-ons";
const HUMMUS = "Hummus (70gm)";
const HUMMUS_PAISE = 3000;

let server: http.Server;
let baseUrl = "";
const CREATED_USER_IDS: string[] = [];
const CREATED_DRAFT_IDS: string[] = [];
const USER_REGISTRY = new Map<string, { id: string }>();

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const r = req as unknown as { user?: unknown; isAuthenticated: () => boolean };
    const headerId = req.header("x-test-user-id");
    const u = headerId ? USER_REGISTRY.get(headerId) : undefined;
    if (u) r.user = u;
    r.isAuthenticated = () => r.user != null;
    next();
  });
  app.use(planDraftsRouter);
  app.use(planDraftLineupRouter);
  return app;
}

before(async () => {
  server = http.createServer(makeApp());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (CREATED_DRAFT_IDS.length > 0) {
    await db
      .delete(planDraftsTable)
      .where(inArray(planDraftsTable.id, CREATED_DRAFT_IDS));
  }
  if (CREATED_USER_IDS.length > 0) {
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});

function cookieFrom(res: globalThis.Response): string | null {
  for (const raw of res.headers.getSetCookie()) {
    const [pair] = raw.split(";");
    if (pair?.startsWith("plan_draft_id=")) return pair;
  }
  return null;
}

interface Session {
  id: string;
  cookie: string;
  version: number;
}

async function call(
  path: string,
  init: { method?: string; body?: unknown; cookie?: string | null } = {},
): Promise<{ status: number; json: any }> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.cookie) headers["cookie"] = init.cookie;
  const res = await fetch(`${baseUrl}${path}`, {
    method: init.method ?? "GET",
    headers,
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

/** Creates a guest draft and returns its id + cookie + current version. */
async function createDraft(body: Record<string, unknown>): Promise<Session> {
  const res = await fetch(`${baseUrl}/plan-drafts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  assert.equal(res.status, 201);
  const cookie = cookieFrom(res);
  assert.ok(cookie, "create must set the guest ownership cookie");
  const { draft } = (await res.json()) as { draft: PlanDraft };
  CREATED_DRAFT_IDS.push(draft.id);
  return { id: draft.id, cookie, version: draft.version };
}

async function patch(
  s: Session,
  body: Record<string, unknown>,
): Promise<PlanDraft> {
  const { status, json } = await call(`/plan-drafts/${s.id}`, {
    method: "PATCH",
    cookie: s.cookie,
    body: { version: s.version, ...body },
  });
  assert.equal(status, 200, JSON.stringify(json));
  s.version = json.draft.version;
  return json.draft;
}

/** A custom-journey draft configured and advanced to a generated lineup. */
async function generatedCustomDraft(
  overrides: Record<string, unknown> = {},
): Promise<{ session: Session; draft: PlanDraft }> {
  const s = await createDraft({ journey: "custom" });
  await patch(s, {
    routine: { mealPeriods: ["lunch"], daysPerWeek: 5, deliveryContext: "office" },
    duration: { cycle: "weekly", renewal: "decide_later" },
    dietaryPattern: "vegetarian",
    ...overrides,
  });
  await patch(s, { status: "ready_to_generate" });

  const { status, json } = await call(`/plan-drafts/${s.id}/generate`, {
    method: "POST",
    cookie: s.cookie,
    body: { version: s.version },
  });
  assert.equal(status, 200, JSON.stringify(json));
  s.version = json.draft.version;
  return { session: s, draft: json.draft };
}

test("the accompaniment fixture dish still carries its priced groups", async () => {
  const { DISHES } = await import("@workspace/menu-catalog");
  const dish = DISHES.find((d) => d.id === CUSTOMISABLE_DISH_ID);
  assert.ok(dish, `dish ${CUSTOMISABLE_DISH_ID} must exist in the catalog`);
  const bread = dish.customizations.find((g) => g.groupName === BREAD_GROUP);
  const addons = dish.customizations.find((g) => g.groupName === ADDONS_GROUP);
  assert.equal(
    bread?.options.find((o) => o.name === MULTIGRAIN)?.priceModifier,
    MULTIGRAIN_PAISE,
  );
  assert.equal(
    addons?.options.find((o) => o.name === HUMMUS)?.priceModifier,
    HUMMUS_PAISE,
  );
});

test("generate produces a lineup and advances the draft to lineup_ready", async () => {
  const { draft } = await generatedCustomDraft();

  assert.equal(draft.status, "lineup_ready");
  assert.equal(draft.generationError, null);
  assert.ok(Array.isArray(draft.lineup));
  assert.equal(draft.lineup!.length, 5, "5 days/week x 1 week");
  for (const day of draft.lineup!) {
    assert.equal(day.slots.length, 1);
    assert.equal(day.slots[0]!.mealPeriod, "lunch");
    assert.ok(day.slots[0]!.dishId > 0);
    assert.equal(
      day.slots[0]!.priceAdjustmentPaise,
      0,
      "generation must never move money",
    );
    assert.equal(day.deliveryWindow, null, "delivery windows are A2.3's job");
  }
});

test("generate refuses a draft that is not ready_to_generate", async () => {
  const s = await createDraft({ journey: "custom" });
  const { status, json } = await call(`/plan-drafts/${s.id}/generate`, {
    method: "POST",
    cookie: s.cookie,
    body: { version: s.version },
  });
  assert.equal(status, 409);
  assert.equal(json.code, "not_ready_to_generate");
});

test("generate rejects a stale version instead of overwriting a concurrent edit", async () => {
  const s = await createDraft({ journey: "custom" });
  await patch(s, {
    routine: { mealPeriods: ["lunch"], daysPerWeek: 3, deliveryContext: "home" },
    duration: { cycle: "weekly", renewal: "decide_later" },
  });
  await patch(s, { status: "ready_to_generate" });

  const { status, json } = await call(`/plan-drafts/${s.id}/generate`, {
    method: "POST",
    cookie: s.cookie,
    body: { version: s.version - 1 },
  });
  assert.equal(status, 409);
  assert.equal(json.code, "stale_version");
});

test("a failed generation persists WHY, so a reload is not a dead end", async () => {
  // `steady` is a real catalog plan with status blocked_pending_skus — it must
  // route to a waitlist, never to a builder that pretends to work.
  const s = await createDraft({ journey: "recommended", planId: "steady" });
  await patch(s, { dietaryPattern: "nonveg", status: "ready_to_generate" });

  const gen = await call(`/plan-drafts/${s.id}/generate`, {
    method: "POST",
    cookie: s.cookie,
    body: { version: s.version },
  });
  assert.equal(gen.status, 422);
  assert.equal(gen.json.code, "plan_not_launchable");

  // The reason survives a fresh read — `generation_failed` alone would leave
  // the customer with no idea what to change.
  const reread = await call(`/plan-drafts/${s.id}`, { cookie: s.cookie });
  assert.equal(reread.status, 200);
  // No client transition leaves `generating`, so a failure that forgot to move
  // the status off it would lock the customer out of their own draft forever.
  assert.notEqual(reread.json.draft.status, "generating");
  assert.equal(reread.json.draft.status, "generation_failed");
  assert.equal(reread.json.draft.generationError.code, "plan_not_launchable");
  assert.ok(reread.json.draft.generationError.message.length > 0);
  assert.equal(reread.json.draft.lineup, null);

  // And the customer can recover: the state machine allows retrying.
  s.version = reread.json.draft.version;
  const recovered = await patch(s, { status: "ready_to_generate" });
  assert.equal(recovered.status, "ready_to_generate");
});

test("declaring a new allergen discards the lineup it would have invalidated", async () => {
  const { session, draft } = await generatedCustomDraft();
  assert.ok(draft.lineup && draft.lineup.length > 0);

  // The lineup was generated from the OLD answers. Keeping it would leave a
  // dairy dish sitting in the plan of someone who just declared dairy.
  const updated = await patch(session, { hardAllergens: ["dairy"] });
  assert.equal(updated.lineup, null, "a stale lineup must not survive");
  assert.equal(updated.previousLineup, null, "nor its Undo snapshot");
  assert.deepEqual(updated.lockedSlotKeys, []);
  assert.equal(updated.status, "collecting_preferences");
});

test("re-sending an unchanged answer keeps the lineup", async () => {
  const { session, draft } = await generatedCustomDraft();
  const before = JSON.stringify(draft.lineup);

  // Idempotent re-save of the same values — nothing changed, so nothing is lost.
  const updated = await patch(session, {
    dietaryPattern: "vegetarian",
    hardAllergens: [],
  });
  assert.equal(JSON.stringify(updated.lineup), before);
  assert.equal(updated.status, "lineup_ready");
});

test("candidates are safety-filtered, exclude the current dish, and carry macro deltas", async () => {
  const { session, draft } = await generatedCustomDraft();
  const day = draft.lineup![0]!;
  const current = day.slots[0]!;

  const { status, json } = await call(
    `/plan-drafts/${session.id}/candidates?deliveryDate=${day.deliveryDate}&mealPeriod=lunch`,
    { cookie: session.cookie },
  );
  assert.equal(status, 200);
  assert.equal(json.fixed, false);
  assert.ok(json.candidates.length > 0);
  for (const c of json.candidates) {
    assert.notEqual(c.dishId, current.dishId, "the current dish is not a candidate");
    assert.equal(
      c.nutritionDelta.calories,
      c.nutrition.calories - current.nutrition.calories,
    );
    assert.ok("catalogPriceDeltaPaise" in c);
  }
});

test("a declared hard allergen is honoured by the candidate list", async () => {
  const { session, draft } = await generatedCustomDraft({
    hardAllergens: ["gluten"],
  });
  const day = draft.lineup![0]!;

  const { status, json } = await call(
    `/plan-drafts/${session.id}/candidates?deliveryDate=${day.deliveryDate}&mealPeriod=lunch`,
    { cookie: session.cookie },
  );
  assert.equal(status, 200);
  assert.ok(json.candidates.length > 0);

  const { DISHES } = await import("@workspace/menu-catalog");
  for (const c of json.candidates) {
    const dish = DISHES.find((d) => d.id === c.dishId);
    const declares = (dish?.allergens ?? []).map((a) => a.toLowerCase());
    assert.equal(
      declares.includes("gluten"),
      false,
      `${c.name} declares gluten but was offered anyway`,
    );
  }
});

test("replace swaps the dish, Keep-protects it, and clears Undo", async () => {
  const { session, draft } = await generatedCustomDraft();
  const day = draft.lineup![0]!;

  // Seed an Undo snapshot first so we can prove replace clears it.
  const shuffled = await call(`/plan-drafts/${session.id}/lineup/shuffle`, {
    method: "POST",
    cookie: session.cookie,
    body: { version: session.version },
  });
  assert.equal(shuffled.status, 200);
  session.version = shuffled.json.draft.version;
  assert.ok(shuffled.json.draft.previousLineup, "shuffle records one Undo step");

  const { status, json } = await call(`/plan-drafts/${session.id}/lineup/replace`, {
    method: "POST",
    cookie: session.cookie,
    body: {
      version: session.version,
      deliveryDate: day.deliveryDate,
      mealPeriod: "lunch",
      dishId: CUSTOMISABLE_DISH_ID,
    },
  });
  assert.equal(status, 200, JSON.stringify(json));
  session.version = json.draft.version;

  const slot = json.draft.lineup.find(
    (d: any) => d.deliveryDate === day.deliveryDate,
  ).slots[0];
  assert.equal(slot.dishId, CUSTOMISABLE_DISH_ID);
  assert.equal(slot.locked, true, "a manual pick is Keep-protected by intent");
  assert.equal(
    json.draft.previousLineup,
    null,
    "manual replacement clears Undo",
  );
});

test("replace refuses a dish outside this plan's safe pool", async () => {
  const { session, draft } = await generatedCustomDraft({
    hardAllergens: ["dairy"],
  });
  const day = draft.lineup![0]!;

  // Dish 121 declares Dairy, so a dairy-allergic draft must never accept it.
  const { status, json } = await call(`/plan-drafts/${session.id}/lineup/replace`, {
    method: "POST",
    cookie: session.cookie,
    body: {
      version: session.version,
      deliveryDate: day.deliveryDate,
      mealPeriod: "lunch",
      dishId: CUSTOMISABLE_DISH_ID,
    },
  });
  assert.equal(status, 422);
  assert.equal(json.code, "dish_not_safe");
});

test("accompaniment options come from the dish, and the server prices the selection", async () => {
  const { session, draft } = await generatedCustomDraft();
  const day = draft.lineup![0]!;

  const replaced = await call(`/plan-drafts/${session.id}/lineup/replace`, {
    method: "POST",
    cookie: session.cookie,
    body: {
      version: session.version,
      deliveryDate: day.deliveryDate,
      mealPeriod: "lunch",
      dishId: CUSTOMISABLE_DISH_ID,
    },
  });
  assert.equal(replaced.status, 200, JSON.stringify(replaced.json));
  session.version = replaced.json.draft.version;

  const options = await call(
    `/plan-drafts/${session.id}/accompaniment-options?deliveryDate=${day.deliveryDate}&mealPeriod=lunch`,
    { cookie: session.cookie },
  );
  assert.equal(options.status, 200);
  assert.ok(
    options.json.groups.some((g: any) => g.groupName === BREAD_GROUP),
    "the editor must offer the dish's own groups, not an invented list",
  );

  const applied = await call(
    `/plan-drafts/${session.id}/lineup/accompaniments`,
    {
      method: "POST",
      cookie: session.cookie,
      body: {
        version: session.version,
        deliveryDate: day.deliveryDate,
        mealPeriod: "lunch",
        selections: [
          { groupName: BREAD_GROUP, optionNames: [MULTIGRAIN] },
          { groupName: ADDONS_GROUP, optionNames: [HUMMUS] },
        ],
        // A client-asserted price must be ignored entirely.
        priceAdjustmentPaise: 999_999,
      },
    },
  );
  assert.equal(applied.status, 200, JSON.stringify(applied.json));
  session.version = applied.json.draft.version;

  const slot = applied.json.draft.lineup.find(
    (d: any) => d.deliveryDate === day.deliveryDate,
  ).slots[0];
  assert.equal(
    slot.priceAdjustmentPaise,
    MULTIGRAIN_PAISE + HUMMUS_PAISE,
    "the price adjustment must be the server's sum, never the client's number",
  );
  assert.deepEqual(slot.accompanimentSelections.sort(), [HUMMUS, MULTIGRAIN].sort());
});

test("an unknown accompaniment group fails closed rather than being dropped", async () => {
  const { session, draft } = await generatedCustomDraft();
  const day = draft.lineup![0]!;

  const { status, json } = await call(
    `/plan-drafts/${session.id}/lineup/accompaniments`,
    {
      method: "POST",
      cookie: session.cookie,
      body: {
        version: session.version,
        deliveryDate: day.deliveryDate,
        mealPeriod: "lunch",
        selections: [{ groupName: "Free Caviar", optionNames: ["Yes please"] }],
      },
    },
  );
  assert.equal(status, 422);
  assert.equal(json.code, "invalid_selection");
});

test("a locked slot survives shuffle while the rest re-roll", async () => {
  const { session, draft } = await generatedCustomDraft();
  const day = draft.lineup![0]!;
  const keptDishId = day.slots[0]!.dishId;

  const locked = await call(`/plan-drafts/${session.id}/lineup/lock`, {
    method: "POST",
    cookie: session.cookie,
    body: {
      version: session.version,
      deliveryDate: day.deliveryDate,
      mealPeriod: "lunch",
      locked: true,
    },
  });
  assert.equal(locked.status, 200);
  session.version = locked.json.draft.version;

  const shuffled = await call(`/plan-drafts/${session.id}/lineup/shuffle`, {
    method: "POST",
    cookie: session.cookie,
    body: { version: session.version },
  });
  assert.equal(shuffled.status, 200, JSON.stringify(shuffled.json));
  session.version = shuffled.json.draft.version;

  const after = shuffled.json.draft.lineup.find(
    (d: any) => d.deliveryDate === day.deliveryDate,
  ).slots[0];
  assert.equal(after.dishId, keptDishId, "Keep must survive Shuffle");
});

test("undo restores exactly one step and then refuses", async () => {
  const { session, draft } = await generatedCustomDraft();
  const before = JSON.stringify(draft.lineup);

  const shuffled = await call(`/plan-drafts/${session.id}/lineup/shuffle`, {
    method: "POST",
    cookie: session.cookie,
    body: { version: session.version },
  });
  assert.equal(shuffled.status, 200);
  session.version = shuffled.json.draft.version;

  const undone = await call(`/plan-drafts/${session.id}/lineup/undo`, {
    method: "POST",
    cookie: session.cookie,
    body: { version: session.version },
  });
  assert.equal(undone.status, 200);
  session.version = undone.json.draft.version;
  assert.equal(JSON.stringify(undone.json.draft.lineup), before);

  const again = await call(`/plan-drafts/${session.id}/lineup/undo`, {
    method: "POST",
    cookie: session.cookie,
    body: { version: session.version },
  });
  assert.equal(again.status, 409, "there is exactly one Undo step, not a stack");
  assert.equal(again.json.code, "no_undo");
});

test("lineup edits require the draft's own cookie", async () => {
  const { session, draft } = await generatedCustomDraft();
  const day = draft.lineup![0]!;

  const noCookie = await call(`/plan-drafts/${session.id}/lineup/shuffle`, {
    method: "POST",
    body: { version: session.version },
  });
  assert.equal(noCookie.status, 404, "knowing the id must not be enough");

  const foreign = await call(
    `/plan-drafts/${session.id}/candidates?deliveryDate=${day.deliveryDate}&mealPeriod=lunch`,
    { cookie: "plan_draft_id=" + randomUUID() },
  );
  assert.equal(foreign.status, 404);
});

test("a plan whose meals are fixed refuses lineup edits", async () => {
  // trial_3day is customizable: false in PLAN_CATALOG (fixed trio, no swaps).
  const s = await createDraft({ journey: "recommended", planId: "trial_3day" });
  await patch(s, { dietaryPattern: "veg", status: "ready_to_generate" });

  const gen = await call(`/plan-drafts/${s.id}/generate`, {
    method: "POST",
    cookie: s.cookie,
    body: { version: s.version },
  });
  assert.equal(gen.status, 200, JSON.stringify(gen.json));
  s.version = gen.json.draft.version;

  const day = gen.json.draft.lineup[0];
  const shuffled = await call(`/plan-drafts/${s.id}/lineup/shuffle`, {
    method: "POST",
    cookie: s.cookie,
    body: { version: s.version },
  });
  assert.equal(shuffled.status, 409);
  assert.equal(shuffled.json.code, "plan_not_customizable");

  const candidates = await call(
    `/plan-drafts/${s.id}/candidates?deliveryDate=${day.deliveryDate}&mealPeriod=lunch`,
    { cookie: s.cookie },
  );
  assert.equal(candidates.status, 200);
  assert.equal(candidates.json.fixed, true);
  assert.deepEqual(candidates.json.candidates, []);
});

test("lineup edits are refused before a lineup exists", async () => {
  const s = await createDraft({ journey: "custom" });
  const { status, json } = await call(`/plan-drafts/${s.id}/lineup/shuffle`, {
    method: "POST",
    cookie: s.cookie,
    body: { version: s.version },
  });
  assert.equal(status, 409);
  assert.equal(json.code, "no_lineup");
});
