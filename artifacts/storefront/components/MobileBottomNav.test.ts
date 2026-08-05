import test from "node:test";
import assert from "node:assert/strict";

type TabKey = "home" | "menu" | "care" | "account";

function resolveActiveTab(pathname: string): TabKey {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/menu") || pathname.startsWith("/dish")) return "menu";
  if (pathname.startsWith("/care")) return "care";
  if (pathname.startsWith("/account")) return "account";
  return "home";
}

test("resolveActiveTab matches core routes correctly", () => {
  assert.equal(resolveActiveTab("/"), "home");
  assert.equal(resolveActiveTab("/menu"), "menu");
  assert.equal(resolveActiveTab("/dish/123"), "menu");
  assert.equal(resolveActiveTab("/care"), "care");
  assert.equal(resolveActiveTab("/account/orders"), "account");
});
