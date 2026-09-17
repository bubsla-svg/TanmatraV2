/**
 * T2 (CRO handoff 2026-09-17): the placement / funnel-visit cookies the
 * storefront writes ride the same-origin /api proxy onto the order row, so
 * the server's `purchase` event can join a sale back to its scan. Pure
 * read of the cookie jar — bounded and character-restricted, because a
 * cookie is attacker-controlled input and only ever groups a scoreboard.
 *
 * Run: cd artifacts/api-server && node --test --import tsx ./src/routes/checkout.attribution.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Request } from "express";
import { attributionCookie } from "./checkout";

const req = (cookies: Record<string, unknown> | undefined) => ({ cookies }) as unknown as Request;

test("a well-formed cookie is read; a missing, malformed or oversized one reads as null", () => {
  assert.equal(attributionCookie(req({ tnm_src: "gym12", tnm_fsid: "fs_ab-CD" }), "tnm_src"), "gym12");
  assert.equal(attributionCookie(req({ tnm_src: "gym12", tnm_fsid: "fs_ab-CD" }), "tnm_fsid"), "fs_ab-CD");
  assert.equal(attributionCookie(req(undefined), "tnm_src"), null);
  assert.equal(attributionCookie(req({}), "tnm_src"), null);
  assert.equal(attributionCookie(req({ tnm_src: "gym 12" }), "tnm_src"), null, "spaces are not a placement");
  assert.equal(attributionCookie(req({ tnm_src: "<script>" }), "tnm_src"), null);
  assert.equal(attributionCookie(req({ tnm_src: "x".repeat(65) }), "tnm_src"), null, "bounded at 64");
  assert.equal(attributionCookie(req({ tnm_src: 42 }), "tnm_src"), null, "only strings");
});
