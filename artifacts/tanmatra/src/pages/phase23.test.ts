import test from "node:test";
import assert from "node:assert/strict";

import { LocationService } from "../services/LocationService";
import { AuthService } from "../services/AuthService";
import { CartService } from "../services/CartService";

test("LocationService handles serviceability checks accurately", () => {
  const valid = LocationService.checkServiceability("560034");
  assert.equal(valid.isServiceable, true);
  assert.equal(valid.city, "Koramangala");

  const invalid = LocationService.checkServiceability("999999");
  assert.equal(invalid.isServiceable, false);
});

test("AuthService preserves return route correctly", () => {
  const redirectUrl = AuthService.buildAuthRedirectUrl("/custom-build?stage=review");
  assert.equal(redirectUrl, "/auth?returnTo=%2Fcustom-build%3Fstage%3Dreview");

  const user = AuthService.login("+919876543210");
  assert.equal(user.isAuthenticated, true);
  assert.equal(user.phone, "+919876543210");

  AuthService.logout();
  assert.equal(AuthService.getCurrentUser().isAuthenticated, false);
});

test("CartService manages items, accompaniments, and complete-your-meal addons", () => {
  CartService.clear();
  assert.equal(CartService.getItems().length, 0);

  const meal = {
    mealId: "m1",
    name: "Golden Quinoa Bowl",
    slug: "quinoa-bowl",
    imageUrl: "",
    calories: 400,
    proteinGrams: 20,
    carbsGrams: 50,
    fatGrams: 10,
    clinicalTags: [],
    isLocked: false,
    pricePaise: 29900,
  };

  CartService.addItem(meal, "Brown Rice");
  assert.equal(CartService.getItems().length, 1);
  assert.equal(CartService.getSubtotalPaise(), 29900);

  const addons = CartService.getRecommendedAddons();
  assert.ok(addons.length >= 2);
  assert.equal(addons[0].slug, "digestive-kombucha");
});
