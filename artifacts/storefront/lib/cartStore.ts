/**
 * Pure cart core (SF-02). Framework-free and node-testable: the React context
 * is a thin shell over these functions.
 *
 * Money discipline (§4.3): line prices are the SERVER's menu prices (dish.price
 * from /api/menu), and the subtotal here is display-only — the amount that
 * bills is always the server-computed order total (POST /api/orders response /
 * the Razorpay order created from the DB row). No client number ever reaches a
 * payment payload.
 *
 * Persistence goes through a guarded storage wrapper: any storage access can
 * throw (Safari private mode, storage-partitioned iframes — the SecurityError
 * class of bug), and stored JSON is untrusted — both are contained here.
 */

/** A customisation selection carried on a cart line, mirroring the wire shape
 *  POST /orders accepts (checkout.ts) — a group name plus the option names
 *  chosen within it. Never a price; the server re-resolves the price against
 *  its own copy of the dish's customisation groups (dishCustomizations.ts on
 *  both sides — server is authoritative, this is the checkout payload). */
export interface CartLineCustomization {
  groupName: string;
  optionNames: string[];
}

/** Display-only macro snapshot captured at add-time (D-14 — "Andaaza nahi,
 *  likha hua"; the checkout line shows more than name + price). Same figures
 *  the menu card already renders (DishData.macros / macrosEstimated) — never
 *  re-derived here, never sent to the server, never part of pricing. */
export interface CartLineMacros {
  calories: number;
  protein: number;
  /** Mirrors DishData.macrosEstimated — the UI labels an estimated figure
   *  with "~", the same convention DishCard/the PDP already use. */
  estimated?: boolean;
}

export interface CartLine {
  dishId: number;
  kind: "dish" | "marketplace";
  slug: string;
  name: string;
  /** Server menu price snapshot, paise, INCLUDING any customisation modifier
   *  already summed in. Display-only; server re-prices at order. */
  pricePaise: number;
  qty: number;
  /** Wire payload for POST /orders — set only by a customised add. */
  customizationSelections?: CartLineCustomization[];
  /** Non-default option names, for display (cart drawer, order summary).
   *  Precomputed at add-time (see lib/dishCustomizations.ts previewCustomizations)
   *  rather than re-derived here — this module doesn't have the dish's group
   *  definitions to derive it from. */
  customizations?: string[];
  /** Optional so a cart written before this field existed still parses and
   *  renders — as a line with no macro chip, never a crash. */
  macros?: CartLineMacros;
}

export interface CartState {
  lines: CartLine[];
}

export const EMPTY_CART: CartState = { lines: [] };
export const MAX_QTY_PER_LINE = 9;

/** Identity for line matching: a plain add and a customised add of the SAME
 *  dish are different lines, and two DIFFERENT customisations of the same
 *  dish are different lines from each other too. Every existing call site
 *  that omits `customizations` gets the empty signature — i.e. matches only
 *  the plain line for that dish, exactly today's behaviour, unchanged. */
function lineSignature(customizations: string[] | undefined): string {
  if (!customizations || customizations.length === 0) return "";
  return [...customizations].sort().join("␟");
}

function sameLine(l: CartLine, dishId: number, kind: CartLine["kind"], signature: string): boolean {
  return l.dishId === dishId && l.kind === kind && lineSignature(l.customizations) === signature;
}

export function addLine(state: CartState, line: Omit<CartLine, "qty">): CartState {
  return addOrUpdateQty(state, line, 1);
}

export function addOrUpdateQty(state: CartState, line: Omit<CartLine, "qty">, qty: number): CartState {
  const signature = lineSignature(line.customizations);
  const existing = state.lines.find((l) => sameLine(l, line.dishId, line.kind, signature));
  if (existing) return setQty(state, line.dishId, line.kind, existing.qty + qty, line.customizations);
  const clamped = Math.max(1, Math.min(MAX_QTY_PER_LINE, Math.trunc(qty)));
  return { lines: [...state.lines, { ...line, qty: clamped }] };
}

export function setQty(
  state: CartState,
  dishId: number,
  kind: "dish" | "marketplace",
  qty: number,
  customizations?: string[],
): CartState {
  const signature = lineSignature(customizations);
  const clamped = Math.max(0, Math.min(MAX_QTY_PER_LINE, Math.trunc(qty)));
  if (clamped === 0) {
    return { lines: state.lines.filter((l) => !sameLine(l, dishId, kind, signature)) };
  }
  return {
    lines: state.lines.map((l) => (sameLine(l, dishId, kind, signature) ? { ...l, qty: clamped } : l)),
  };
}

export function itemCount(state: CartState): number {
  return state.lines.reduce((n, l) => n + l.qty, 0);
}

/** Display subtotal in paise — never the billed amount (server owns that). */
export function subtotalPaise(state: CartState): number {
  return state.lines.reduce((s, l) => s + l.pricePaise * l.qty, 0);
}

export function qtyOf(
  state: CartState,
  dishId: number,
  kind: "dish" | "marketplace",
  customizations?: string[],
): number {
  const signature = lineSignature(customizations);
  return state.lines.find((l) => sameLine(l, dishId, kind, signature))?.qty ?? 0;
}

// ── Guarded persistence ──────────────────────────────────────────────────────

const STORAGE_KEY = "storefront:cart:v1";

function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((v) => typeof v === "string");
}

function isValidCustomizationSelections(x: unknown): x is CartLineCustomization[] {
  return (
    Array.isArray(x) &&
    x.every(
      (v) =>
        typeof v === "object" &&
        v !== null &&
        typeof (v as Record<string, unknown>).groupName === "string" &&
        isStringArray((v as Record<string, unknown>).optionNames),
    )
  );
}

function isValidMacros(x: unknown): x is CartLineMacros {
  if (typeof x !== "object" || x === null) return false;
  const m = x as Record<string, unknown>;
  return (
    typeof m.calories === "number" &&
    m.calories >= 0 &&
    typeof m.protein === "number" &&
    m.protein >= 0 &&
    (m.estimated === undefined || typeof m.estimated === "boolean")
  );
}

function isValidLine(x: unknown): x is CartLine {
  if (typeof x !== "object" || x === null) return false;
  const l = x as Record<string, unknown>;
  return (
    typeof l.dishId === "number" &&
    (l.kind === "dish" || l.kind === "marketplace") &&
    typeof l.slug === "string" &&
    typeof l.name === "string" &&
    typeof l.pricePaise === "number" &&
    l.pricePaise >= 0 &&
    typeof l.qty === "number" &&
    l.qty >= 1 &&
    l.qty <= MAX_QTY_PER_LINE &&
    (l.customizations === undefined || isStringArray(l.customizations)) &&
    (l.customizationSelections === undefined || isValidCustomizationSelections(l.customizationSelections)) &&
    // Absent entirely on a cart written before this field existed — that
    // line still passes (macros stays undefined, no chip renders). A
    // PRESENT-but-malformed value is what gets refused, same policy as
    // customizations/customizationSelections above.
    (l.macros === undefined || isValidMacros(l.macros))
  );
}

/** Parse untrusted stored JSON to a valid cart, or empty. Never throws. */
export function parseStoredCart(raw: string | null): CartState {
  if (!raw) return EMPTY_CART;
  try {
    const parsed: unknown = JSON.parse(raw);
    const lines = (parsed as { lines?: unknown }).lines;
    if (!Array.isArray(lines)) return EMPTY_CART;
    return { lines: lines.filter(isValidLine) };
  } catch {
    return EMPTY_CART;
  }
}

/** Load from localStorage through a guard — storage access itself may throw. */
export function loadCart(): CartState {
  try {
    return parseStoredCart(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return EMPTY_CART;
  }
}

/** Persist through the same guard; silently a no-op where storage is denied. */
export function saveCart(state: CartState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage denied (private mode / partitioned context) — cart stays in-memory */
  }
}
