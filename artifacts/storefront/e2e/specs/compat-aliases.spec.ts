import { test, expect } from "@playwright/test";

/**
 * D-04A/D-05A compat aliases (TNM-CRO-01 owner ruling 2026-08-11): /quiz ->
 * /quick-setup and /auth -> /login, both 308, query string intact. Next
 * forwards a fixed-destination redirect's incoming query string
 * automatically — this proves it for the ruled param set (condition, goal,
 * origin, acquisitionContextId, returnTo) rather than assuming it, exactly
 * as the runbook's "curl matrix" accept criterion asks. Uses Playwright's
 * request context with maxRedirects: 0 so the 308 + Location header are
 * observed directly, the same as `curl -sD -` without `-L`.
 */

const RULED_PARAMS = "condition=pcos&goal=lose_weight&origin=organic&acquisitionContextId=abc123&returnTo=%2Fmeal-planner";

test("/quiz -> /quick-setup, 308, ruled params intact", async ({ request }) => {
  const res = await request.get(`/quiz?${RULED_PARAMS}`, { maxRedirects: 0 });
  expect(res.status()).toBe(308);
  const location = res.headers()["location"];
  expect(location).toBeTruthy();
  const url = new URL(location!, "http://x");
  expect(url.pathname).toBe("/quick-setup");
  expect(url.searchParams.get("condition")).toBe("pcos");
  expect(url.searchParams.get("goal")).toBe("lose_weight");
  expect(url.searchParams.get("origin")).toBe("organic");
  expect(url.searchParams.get("acquisitionContextId")).toBe("abc123");
  expect(url.searchParams.get("returnTo")).toBe("/meal-planner");
});

test("/auth -> /login, 308, ruled params intact", async ({ request }) => {
  const res = await request.get(`/auth?${RULED_PARAMS}`, { maxRedirects: 0 });
  expect(res.status()).toBe(308);
  const location = res.headers()["location"];
  expect(location).toBeTruthy();
  const url = new URL(location!, "http://x");
  expect(url.pathname).toBe("/login");
  expect(url.searchParams.get("condition")).toBe("pcos");
  expect(url.searchParams.get("goal")).toBe("lose_weight");
  expect(url.searchParams.get("origin")).toBe("organic");
  expect(url.searchParams.get("acquisitionContextId")).toBe("abc123");
  expect(url.searchParams.get("returnTo")).toBe("/meal-planner");
});

test("/quiz and /auth with no query string redirect cleanly, no dangling '?'", async ({ request }) => {
  const quiz = await request.get("/quiz", { maxRedirects: 0 });
  expect(quiz.status()).toBe(308);
  expect(quiz.headers()["location"]).toBe("/quick-setup");

  const auth = await request.get("/auth", { maxRedirects: 0 });
  expect(auth.status()).toBe(308);
  expect(auth.headers()["location"]).toBe("/login");
});
