/**
 * Sticky, cookie-free experiment assignment (T10). A unit (the funnel
 * session id when one exists, else a per-tab token) is hashed with the
 * experiment name, so the same visitor lands in the same arm on every
 * screen of one session, and two experiments never share an assignment
 * pattern. Pure and `@/`-free so lib/ tests run under node --test.
 *
 * Nothing here touches money: the arm only changes how Razorpay's own sheet
 * is opened; every amount still comes from the server.
 */
export type Variant = "control" | "treatment";

/** FNV-1a, 32-bit, with a murmur3 finalizer: plain FNV clusters on
 *  sequential inputs ("u1", "u2", …) badly enough to skew a 10% arm to 6%. */
export function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** 50/50 by default; `treatmentShare` in [0,1] narrows the pilot. */
export function assignVariant(experiment: string, unit: string, treatmentShare = 0.5): Variant {
  const bucket = hash32(`${experiment}:${unit}`) / 0x100000000; // [0,1)
  return bucket < treatmentShare ? "treatment" : "control";
}

const UNIT_KEY = "tnm_exp_unit";

/** The per-tab fallback unit: minted once, kept in sessionStorage. */
export function tabUnit(storage: Pick<Storage, "getItem" | "setItem"> | null, mint: () => string): string | null {
  if (!storage) return null;
  try {
    const existing = storage.getItem(UNIT_KEY);
    if (existing) return existing;
    const fresh = mint();
    storage.setItem(UNIT_KEY, fresh);
    return fresh;
  } catch {
    return null;
  }
}

export const MAGIC_CHECKOUT_EXPERIMENT = "magic_checkout";

/**
 * The Magic Checkout arm for this session, or null when the pilot is off or
 * no unit is available (server render, storage blocked): null means "not in
 * the experiment", and the events carry no arm at all rather than a made-up
 * control.
 */
export function magicCheckoutVariant(opts: {
  enabled: boolean;
  sessionId: string | null;
  storage: Pick<Storage, "getItem" | "setItem"> | null;
  mint?: () => string;
}): Variant | null {
  if (!opts.enabled) return null;
  const unit = opts.sessionId ?? tabUnit(opts.storage, opts.mint ?? (() => Math.random().toString(36).slice(2, 14)));
  if (!unit) return null;
  return assignVariant(MAGIC_CHECKOUT_EXPERIMENT, unit);
}

/** The funnel prop block every checkout event carries when the pilot is on. */
export function experimentProps(variant: Variant | null): Record<string, string> {
  return variant ? { [MAGIC_CHECKOUT_EXPERIMENT]: variant } : {};
}
