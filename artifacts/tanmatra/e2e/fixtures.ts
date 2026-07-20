import { type Page, type APIRequestContext, expect } from "@playwright/test";

// ── Money (integer paise — see docs/test-plan.md "Money precision") ──────────
// Mirrors artifacts/tanmatra/src/lib/cartContext.tsx. Keep in sync (ideally
// import from a shared module once one exists).
export const FREE_DELIVERY_THRESHOLD = 50_000; // ₹500
export const DELIVERY_FEE = 5_000; // ₹50
// Statutory GST split — mirrors cartMath.ts / computeChargePaise:
// prepared food 5% (no ITC) + delivery service 18%.
export const FOOD_GST_BPS = 500; // 5.00%
export const DELIVERY_GST_BPS = 1800; // 18.00%

export const rupees = (r: number): number => Math.round(r * 100); // ₹ → paise
export const deliveryFeeFor = (subtotalPaise: number): number =>
  subtotalPaise === 0 || subtotalPaise >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
export const gstOn = (subtotalPaise: number): number =>
  Math.round((subtotalPaise * FOOD_GST_BPS) / 10_000) +
  Math.round((deliveryFeeFor(subtotalPaise) * DELIVERY_GST_BPS) / 10_000);

/** Assert a paise amount exactly (never compare floats). */
export function expectPaise(actual: number, expected: number, msg?: string): void {
  expect(Number.isInteger(actual), `${msg ?? "amount"} must be integer paise`).toBe(true);
  expect(actual, msg).toBe(expected);
}

// ── Cart seeding (Zustand persist key `tanmatra:cart:v1`) ────────────────────
export interface CartItem {
  lineId: string;
  dishId: number;
  slug: string;
  name: string;
  image: string;
  basePrice: number;
  unitPrice: number;
  quantity: number;
  kitchen: string;
  isVeg: boolean;
  rdVerified: boolean;
  macros: { protein: number; carbs: number; fat: number; fiber: number; calories: number };
  customizations: string[];
}

export function cartItem(overrides: Partial<CartItem> = {}): CartItem {
  const unit = overrides.unitPrice ?? rupees(130);
  return {
    lineId: overrides.lineId ?? `line-${Math.random().toString(36).slice(2, 8)}`,
    dishId: overrides.dishId ?? 2,
    slug: overrides.slug ?? "aglio-olio-veg",
    name: overrides.name ?? "Aglio Olio - Veg",
    image: overrides.image ?? "",
    basePrice: overrides.basePrice ?? unit,
    unitPrice: unit,
    quantity: overrides.quantity ?? 1,
    kitchen: overrides.kitchen ?? "continental",
    isVeg: overrides.isVeg ?? true,
    rdVerified: overrides.rdVerified ?? true,
    macros: overrides.macros ?? { protein: 14, carbs: 65, fat: 10, fiber: 5, calories: 420 },
    customizations: overrides.customizations ?? [],
    ...overrides,
  };
}

/**
 * Seed the cart BEFORE the app boots (addInitScript) so /checkout doesn't
 * redirect to /menu. Call before page.goto.
 */
export async function seedCart(
  page: Page,
  items: CartItem[],
  bundleSlugs: string[] = [],
): Promise<void> {
  const persisted = { state: { items, bundleSlugs }, version: 0 };
  await page.addInitScript((p) => {
    window.localStorage.setItem("tanmatra:cart:v1", JSON.stringify(p));
  }, persisted);
}

export const cartSubtotal = (items: CartItem[]): number =>
  items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);

/**
 * Pre-resolve first-touch onboarding BEFORE the app boots so specs exercise
 * their own surface instead of the SoftGate overlay (mounted on discovery
 * routes for fresh visitors) or the quiz-nudge banner. Call in a
 * `test.beforeEach` (before page.goto) from any spec that navigates to
 * `/`, `/menu`, `/dish/*`, or the landing pages. Specs that test the gate
 * itself (softgate.spec.ts) must NOT call this.
 */
export async function quietFirstTouch(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "tanmatra:softgate:v1",
      JSON.stringify({ v: 1, at: Date.now(), outcome: "completed" }),
    );
    window.localStorage.setItem(
      "tanmatra:quiz-banner-dismissed-at:v2",
      String(Date.now()),
    );
  });
}

// ── API helpers (assert correctness at the source) ───────────────────────────
export const API_BASE =
  process.env["E2E_API_BASE"] ??
  "https://wellness-foods-475157072474.asia-south2.run.app/api";

export interface PublicDish {
  id: number;
  slug: string;
  name: string;
  price: number; // paise
  isVeg: boolean;
  allergens: string[];
  glycaemicIndex: "low" | "medium" | "high" | string;
  category: string;
  macros: { protein: number; carbs: number; fat: number; fiber: number; calories: number };
  ingredients: string[];
  isAvailable: boolean;
}

export async function fetchPublicMenu(request: APIRequestContext): Promise<PublicDish[]> {
  const res = await request.get(`${API_BASE}/menu/public`);
  expect(res.ok(), `GET /menu/public → ${res.status()}`).toBeTruthy();
  const body = (await res.json()) as { dishes: PublicDish[] };
  return body.dishes;
}

/** Pincode fixtures — real serviceable zone is Noida NCR (see grounding notes). */
export const PINCODES = {
  serviceable: "201301", // Noida
  outOfZone: "560001", // Bengaluru — currently NOT serviceable in code
};
