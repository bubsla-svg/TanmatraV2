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

export interface CartLine {
  dishId: number;
  slug: string;
  name: string;
  /** Server menu price snapshot, paise. Display-only; server re-prices at order. */
  pricePaise: number;
  qty: number;
}

export interface CartState {
  lines: CartLine[];
}

export const EMPTY_CART: CartState = { lines: [] };
export const MAX_QTY_PER_LINE = 9;

export function addLine(state: CartState, line: Omit<CartLine, "qty">): CartState {
  const existing = state.lines.find((l) => l.dishId === line.dishId);
  if (existing) return setQty(state, line.dishId, existing.qty + 1);
  return { lines: [...state.lines, { ...line, qty: 1 }] };
}

export function setQty(state: CartState, dishId: number, qty: number): CartState {
  const clamped = Math.max(0, Math.min(MAX_QTY_PER_LINE, Math.trunc(qty)));
  if (clamped === 0) {
    return { lines: state.lines.filter((l) => l.dishId !== dishId) };
  }
  return {
    lines: state.lines.map((l) => (l.dishId === dishId ? { ...l, qty: clamped } : l)),
  };
}

export function itemCount(state: CartState): number {
  return state.lines.reduce((n, l) => n + l.qty, 0);
}

/** Display subtotal in paise — never the billed amount (server owns that). */
export function subtotalPaise(state: CartState): number {
  return state.lines.reduce((s, l) => s + l.pricePaise * l.qty, 0);
}

export function qtyOf(state: CartState, dishId: number): number {
  return state.lines.find((l) => l.dishId === dishId)?.qty ?? 0;
}

// ── Guarded persistence ──────────────────────────────────────────────────────

const STORAGE_KEY = "storefront:cart:v1";

function isValidLine(x: unknown): x is CartLine {
  if (typeof x !== "object" || x === null) return false;
  const l = x as Record<string, unknown>;
  return (
    typeof l.dishId === "number" &&
    typeof l.slug === "string" &&
    typeof l.name === "string" &&
    typeof l.pricePaise === "number" &&
    l.pricePaise >= 0 &&
    typeof l.qty === "number" &&
    l.qty >= 1 &&
    l.qty <= MAX_QTY_PER_LINE
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
