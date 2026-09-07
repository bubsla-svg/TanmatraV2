/**
 * The ONE registry of money paths, and the ONE way to reach a purchase.
 *
 * Every surface that takes money — a plan, the à-la-carte cart, a pantry item,
 * Premium, a paid RD consult — now ends at `/checkout`. Before this module,
 * three of those five opened the Razorpay modal in place (the PDP's "Buy on
 * its own", `/premium`'s Join button, the RD booking card's Pay), each with its
 * own auth gate, its own retry rules, and its own idea of what happens when a
 * payment is captured but verify fails. That divergence was not cosmetic: two
 * of the three had no captured-but-unverified state at all, so a failed verify
 * re-enabled a Pay button over money that had already left the account.
 *
 * A checkout intent is the whole vocabulary of "what is being bought". It is
 * serialised into `/checkout`'s query string and parsed back on the other side,
 * so the query string is validated in exactly one place rather than at each
 * `searchParams` read. Pure and DB-free by construction — the SERVER still
 * owns every amount; an intent names WHAT is being bought, never what it costs.
 */

import { asBuilderCycle, type BuilderCycle } from "./checkoutCycle";

/** Ceiling for a marketplace line, mirroring the cart's own MAX_QTY_PER_LINE.
 *  Duplicated as a literal rather than imported so this module stays free of
 *  the cart store (which reaches for `window` on hydration); the test locks
 *  the two together. */
export const MAX_INTENT_QTY = 9;

export type CheckoutIntent =
  | { mode: "plan"; planId: string; track?: string; cycle?: BuilderCycle; bump?: boolean }
  | { mode: "alacarte" }
  | { mode: "premium" }
  | { mode: "marketplace"; itemSlug: string; qty: number }
  | { mode: "consult"; appointmentId: number };

export type CheckoutMode = CheckoutIntent["mode"];

/** The modes reached by an explicit `?mode=`. `plan` is NOT among them: it is
 *  addressed by `?plan=<id>` — the shape already live in QR codes, the plan
 *  builder's push and customers' bookmarks, which this module must not break. */
const EXPLICIT_MODES = ["alacarte", "premium", "marketplace", "consult"] as const;

type ExplicitMode = (typeof EXPLICIT_MODES)[number];

function isExplicitMode(v: string | undefined): v is ExplicitMode {
  return EXPLICIT_MODES.includes(v as ExplicitMode);
}

/** Clamp to a real line quantity: 1..MAX_INTENT_QTY, integers only. A missing,
 *  fractional, negative or absurd `qty` resolves to 1 — never to 0 (an order
 *  for nothing) and never to an unbounded number the server would have to
 *  refuse after the customer has already committed. */
export function clampIntentQty(qty: number | string | undefined): number {
  const n = typeof qty === "string" ? Number(qty) : qty;
  if (n === undefined || n === null || !Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(MAX_INTENT_QTY, Math.trunc(n)));
}

/**
 * The href for an intent. Every money CTA in the app builds its link here, so
 * "where does buying happen" has exactly one answer and adding a sixth money
 * path is a change to this file rather than a fourth private Razorpay call
 * site.
 */
export function checkoutHref(intent: CheckoutIntent): string {
  const q = new URLSearchParams();
  switch (intent.mode) {
    case "plan":
      q.set("plan", intent.planId);
      if (intent.track) q.set("track", intent.track);
      if (intent.cycle) q.set("cycle", intent.cycle);
      if (intent.bump) q.set("bump", "1");
      break;
    case "marketplace":
      q.set("mode", "marketplace");
      q.set("item", intent.itemSlug);
      // Always explicit, including qty=1: a link a customer can re-open must
      // buy the same quantity it bought the first time, not whatever the
      // default happens to be when it is next parsed.
      q.set("qty", String(clampIntentQty(intent.qty)));
      break;
    case "consult":
      q.set("mode", "consult");
      q.set("appointment", String(intent.appointmentId));
      break;
    default:
      q.set("mode", intent.mode);
  }
  return `/checkout?${q.toString()}`;
}

/** Raw `searchParams` as Next hands them over. */
export interface CheckoutParams {
  plan?: string;
  mode?: string;
  track?: string;
  cycle?: string;
  bump?: string;
  item?: string;
  qty?: string;
  appointment?: string;
}

/**
 * Parse a query string back into an intent, or `null` when it names no
 * purchase this app can complete — an unknown mode, a marketplace link with no
 * item, a consult link whose appointment id is not a positive integer. `null`
 * is the caller's cue to fall back to the à-la-carte leg (the one mode with a
 * designed empty state), never to guess at what the customer meant.
 *
 * `?plan=` is checked FIRST and independently of `?mode=`, because that is the
 * link shape already in the wild.
 */
export function parseCheckoutIntent(params: CheckoutParams): CheckoutIntent | null {
  if (params.plan) {
    return {
      mode: "plan",
      planId: params.plan,
      ...(params.track ? { track: params.track } : {}),
      ...(asBuilderCycle(params.cycle) ? { cycle: asBuilderCycle(params.cycle) } : {}),
      ...(params.bump === "1" ? { bump: true } : {}),
    };
  }
  if (!isExplicitMode(params.mode)) return null;
  switch (params.mode) {
    case "marketplace": {
      const slug = params.item?.trim();
      if (!slug) return null;
      return { mode: "marketplace", itemSlug: slug, qty: clampIntentQty(params.qty) };
    }
    case "consult": {
      const id = Number(params.appointment);
      if (!Number.isSafeInteger(id) || id <= 0) return null;
      return { mode: "consult", appointmentId: id };
    }
    case "premium":
      return { mode: "premium" };
    default:
      return { mode: "alacarte" };
  }
}
