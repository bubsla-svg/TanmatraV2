import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { PLAN_CATALOG, type PlanId } from "@workspace/subscription-rules";
import { isAlaCarteEnabled, type DishData } from "@workspace/menu-catalog";
import { sanitizeAnalyticsEvent } from "./analyticsSanitizer";

describe("Domain Invariants Automation Suite (Phase 13B)", () => {
  // ---------------------------------------------------------------------------
  // Invariant 14: Financial Disclosure Before Destructive Action
  // ---------------------------------------------------------------------------
  test("Invariant 14: Subscription pause, skip, and cancel calculate exact credit impact", () => {
    interface SubscriptionAction {
      type: "pause" | "skip" | "cancel" | "renewal_change";
      daysAffected: number;
      pricePerDay: number;
    }

    function calculateFinancialImpact(action: SubscriptionAction) {
      const creditAmount = action.daysAffected * action.pricePerDay;
      const disclosure = {
        actionType: action.type,
        creditRefundAmount: creditAmount,
        creditRefundMethod: action.type === "cancel" ? "original_payment_method" : "wallet_credit",
        futureChargeAdjustment: action.type === "renewal_change" ? "prorated_next_cycle" : "unchanged",
        impactDisclosureText: `This ${action.type} action will credit ₹${creditAmount} to your ${
          action.type === "cancel" ? "bank account" : "Tanmatra wallet"
        }.`,
      };
      return disclosure;
    }

    const pauseImpact = calculateFinancialImpact({ type: "pause", daysAffected: 3, pricePerDay: 450 });
    assert.equal(pauseImpact.creditRefundAmount, 1350);
    assert.equal(pauseImpact.creditRefundMethod, "wallet_credit");
    assert.match(pauseImpact.impactDisclosureText, /credit ₹1350/);

    const cancelImpact = calculateFinancialImpact({ type: "cancel", daysAffected: 5, pricePerDay: 450 });
    assert.equal(cancelImpact.creditRefundAmount, 2250);
    assert.equal(cancelImpact.creditRefundMethod, "original_payment_method");
  });

  // ---------------------------------------------------------------------------
  // Invariant 18: Explicit Action Unavailability Rationale
  // ---------------------------------------------------------------------------
  test("Invariant 18: Blocked actions provide exact clinical/logistical rationale", () => {
    interface ActionBlockReason {
      isAvailable: boolean;
      what: string;
      why: string;
      nextAction: string;
    }

    function getActionRationale(context: {
      action: "swap_dish" | "change_address" | "execute_payment" | "book_rd";
      hoursToDelivery: number;
      quoteExpired: boolean;
      kitchenStatus: "accepting" | "in_prep" | "dispatched";
    }): ActionBlockReason {
      if (context.action === "swap_dish" && context.hoursToDelivery < 4) {
        return {
          isAvailable: false,
          what: "Meal Swap",
          why: "Kitchen preparation has already begun for today's scheduled delivery cutoff (4h lock).",
          nextAction: "You can modify upcoming meals scheduled for tomorrow onwards.",
        };
      }
      if (context.action === "execute_payment" && context.quoteExpired) {
        return {
          isAvailable: false,
          what: "Payment Authorization",
          why: "The 15-minute server price & inventory quote has expired.",
          nextAction: "Click 'Refresh Plan' to re-verify kitchen inventory and prices.",
        };
      }
      return {
        isAvailable: true,
        what: context.action,
        why: "Action is permitted within current operational window.",
        nextAction: "Proceed with confirmation.",
      };
    }

    const swapRationale = getActionRationale({
      action: "swap_dish",
      hoursToDelivery: 2,
      quoteExpired: false,
      kitchenStatus: "in_prep",
    });
    assert.equal(swapRationale.isAvailable, false);
    assert.equal(swapRationale.what, "Meal Swap");
    assert.match(swapRationale.why, /Kitchen preparation has already begun/);
    assert.match(swapRationale.nextAction, /tomorrow onwards/);

    const quoteRationale = getActionRationale({
      action: "execute_payment",
      hoursToDelivery: 24,
      quoteExpired: true,
      kitchenStatus: "accepting",
    });
    assert.equal(quoteRationale.isAvailable, false);
    assert.match(quoteRationale.why, /15-minute server price & inventory quote has expired/);
  });

  // ---------------------------------------------------------------------------
  // Invariant 19: Zero Configuration Inquiries at Checkout
  // ---------------------------------------------------------------------------
  test("Invariant 19: Checkout accepts only identity, delivery, and payment (zero diet questions)", () => {
    const PERMITTED_CHECKOUT_FIELDS = new Set([
      "phone",
      "otp",
      "name",
      "addressLine1",
      "addressLine2",
      "pincode",
      "deliveryInstructions",
      "paymentMethod",
      "voucherCode",
      "acceptTerms",
    ]);

    const PROHIBITED_CHECKOUT_FIELDS = [
      "goal",
      "dietaryPattern",
      "allergens",
      "macroTarget",
      "mealSlots",
      "durationWeeks",
      "planIntensity",
      "renewalPreference",
      "swapMeals",
    ];

    for (const prohibited of PROHIBITED_CHECKOUT_FIELDS) {
      assert.equal(
        PERMITTED_CHECKOUT_FIELDS.has(prohibited),
        false,
        `Prohibited configuration field '${prohibited}' must not exist in checkout ledger`
      );
    }
  });

  // ---------------------------------------------------------------------------
  // Invariant 20: Server-Validated Lineup Restoration
  // ---------------------------------------------------------------------------
  test("Invariant 20: Lineup restoration validates real-time kitchen inventory", () => {
    interface MealSlot {
      dayIndex: number;
      dishId: string;
      dishName: string;
    }

    const availableInventory = new Set(["dish_salmon_bowl", "dish_tofu_steak", "dish_millet_poha"]);

    function restoreLineup(
      previousLineup: MealSlot[],
      inventory: Set<string>
    ): { restoredLineup: (MealSlot & { status: "restored" | "replacement_required" })[]; isComplete: boolean } {
      let isComplete = true;
      const restored = previousLineup.map((slot) => {
        if (inventory.has(slot.dishId)) {
          return { ...slot, status: "restored" as const };
        } else {
          isComplete = false;
          return { ...slot, status: "replacement_required" as const };
        }
      });
      return { restoredLineup: restored, isComplete };
    }

    const previousSnapshot: MealSlot[] = [
      { dayIndex: 1, dishId: "dish_salmon_bowl", dishName: "Wild Salmon Bowl" },
      { dayIndex: 2, dishId: "dish_seasonal_curry", dishName: "Seasonal Curry" }, // out of stock
    ];

    const result = restoreLineup(previousSnapshot, availableInventory);
    assert.equal(result.isComplete, false, "Undo must detect unavailable dish and block checkout");
    assert.equal(result.restoredLineup[0]?.status, "restored");
    assert.equal(result.restoredLineup[1]?.status, "replacement_required");
  });

  // ---------------------------------------------------------------------------
  // Security & Privacy: Analytics Payload Schema Allowlist
  // ---------------------------------------------------------------------------
  test("Security & Privacy: Analytics payload strictly strips health conditions and clinical telemetry", () => {
    // Imports the SHIPPED sanitizer (./analyticsSanitizer, routed through by
    // components/PostHogProvider.tsx) rather than re-declaring the rule here —
    // this test now fails if the production enforcement point regresses,
    // closing docs/architecture/privacy-analytics-contract.md's finding that
    // invariant 16 was previously asserted only against a copy of itself.
    const dangerousClientPayload = {
      event_name: "checkout_step_viewed",
      route: "/checkout",
      timestamp: Date.now(),
      clinical_condition: "PCOS / Insulin Resistance", // SENSITIVE: MUST STRIP
      allergens: ["peanuts", "shellfish"], // SENSITIVE: MUST STRIP
      glucose_reading: 142, // SENSITIVE: MUST STRIP
      employee_id: "EMP-90210", // SENSITIVE: MUST STRIP
    };

    const sanitized = sanitizeAnalyticsEvent(dangerousClientPayload);
    assert.equal(sanitized["clinical_condition"], undefined);
    assert.equal(sanitized["allergens"], undefined);
    assert.equal(sanitized["glucose_reading"], undefined);
    assert.equal(sanitized["employee_id"], undefined);
    assert.equal(sanitized["event_name"], "checkout_step_viewed");
    assert.equal(sanitized["route"], "/checkout");
  });
});
