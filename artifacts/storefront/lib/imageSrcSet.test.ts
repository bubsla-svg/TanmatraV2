import test from "node:test";
import assert from "node:assert/strict";
import { responsiveSrcSet } from "./imageSrcSet";

test("unsplash URLs get candidates up to the width they already ask for", () => {
  const set = responsiveSrcSet("https://images.unsplash.com/photo-1570696516188-ade861b84a49?w=800&q=80");
  assert.ok(set);
  const widths = set!.split(", ").map((c) => c.split(" ")[1]);
  assert.deepEqual(widths, ["320w", "480w", "640w", "800w"]);
  // q is preserved on every candidate — dropping it would change the render.
  assert.equal(set!.split(", ").filter((c) => c.includes("q=80")).length, 4);
});

test("no candidate is WIDER than the source already requests", () => {
  // The regression this guards: offering 1200w for a URL pinned at w=800 makes
  // large screens download more than they do today, not less.
  const set = responsiveSrcSet("https://images.unsplash.com/photo-x?w=800&q=80");
  assert.ok(!set!.includes("1200w"));
  assert.ok(!set!.includes("w=1200"));
});

test("a proxied dish photo gets no srcSet — the proxy cannot resize", () => {
  // /images/* is a byte proxy through the legacy SPA. Every width would return
  // identical bytes, so the browser would pick the widest and we would have
  // made it worse while reporting an optimisation.
  assert.equal(responsiveSrcSet("/images/dishes/paneer-tikka.jpg"), null);
  assert.equal(responsiveSrcSet("/dishes/paneer-tikka.jpg"), null);
  assert.equal(responsiveSrcSet("https://cdn.example.com/a.jpg"), null);
});

test("an unbounded unsplash URL gets the full ladder", () => {
  const set = responsiveSrcSet("https://images.unsplash.com/photo-y");
  assert.ok(set!.endsWith("1200w"));
});

test("junk input is null, never a throw", () => {
  assert.equal(responsiveSrcSet(""), null);
  assert.equal(responsiveSrcSet("not a url at all"), null);
});
