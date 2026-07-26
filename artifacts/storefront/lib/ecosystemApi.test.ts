import { test, mock, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  getMySymptomLogs,
  recordSymptomLog,
  getCommunityQaThreads,
  submitQuestionThread,
  getMyNutritionHistory,
  getMyChallengeTracker,
} from "./ecosystemApi";

afterEach(() => {
  mock.restoreAll();
});

test("symptom log helpers correctly invoke endpoints", async () => {
  mock.method(globalThis, "fetch", async (url: string | URL, opts?: RequestInit) => {
    assert.equal(url.toString().endsWith("/api/symptom-logs"), true);
    if (opts?.method === "POST") {
      return new Response(JSON.stringify({ id: 1, symptomType: "bloating" }), { status: 201 });
    }
    return new Response(JSON.stringify([{ id: 1, symptomType: "bloating" }]), { status: 200 });
  });

  const list = await getMySymptomLogs();
  assert.equal(list[0]?.symptomType, "bloating");

  const recorded = await recordSymptomLog({
    loggedDate: "2026-07-25",
    symptomType: "bloating",
    severity: 2,
    notes: "",
    relatedDishSlug: "",
  });
  assert.equal(recorded.symptomType, "bloating");
});

test("community QA helpers correctly invoke endpoints", async () => {
  mock.method(globalThis, "fetch", async (url: string | URL, opts?: RequestInit) => {
    assert.equal(url.toString().endsWith("/api/community/qa"), true);
    return new Response(JSON.stringify(opts?.method === "POST" ? { id: 2, category: "pcos" } : []), { status: 200 });
  });

  const threads = await getCommunityQaThreads();
  assert.equal(threads.length, 0);

  const newThread = await submitQuestionThread({
    questionTitle: "Best GI index for lunches?",
    questionBody: "Looking for low GI vegetarian options.",
    category: "pcos",
  });
  assert.equal(newThread.category, "pcos");
});

test("history and tracker helpers invoke correct targets", async () => {
  mock.method(globalThis, "fetch", async (url: string | URL) => {
    const s = url.toString();
    if (s.endsWith("/api/nutrition-history")) {
      return new Response(JSON.stringify({ logs: [], targets: { calorieTarget: 2100 } }), { status: 200 });
    }
    return new Response(JSON.stringify({ challenges: [{ id: 10, slug: "sugar-free-14d" }], memberships: [], checkIns: [] }), { status: 200 });
  });

  const hist = await getMyNutritionHistory();
  assert.equal(hist.targets.calorieTarget, 2100);

  const tracker = await getMyChallengeTracker();
  assert.equal(tracker.challenges[0]?.slug, "sugar-free-14d");
});
