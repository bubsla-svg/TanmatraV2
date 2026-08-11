import type { OtpStage } from "./otpFlow";

/**
 * Pure /login URL-contract helpers (P0 §7 — route-contract.md §3.2). The
 * canonical, linkable auth state is `?step=phone|otp|account-conflict`;
 * `?next=` is the separate post-auth return destination. Kept DOM-free so
 * both are unit-tested without a browser or a rendered page.
 *
 * `account-conflict` is part of the P0-specified step enum but has no
 * backing implementation anywhere in the product today — verify-otp is a
 * plain upsert-by-phone (artifacts/api-server/src/routes/auth.ts), so no
 * signal exists that could ever produce that state. parseAuthStep therefore
 * falls through to `undefined` for it rather than fabricating a UI for a
 * state nothing can trigger.
 */
export type AuthStep = "phone" | "otp";

const VALID_STEPS: readonly AuthStep[] = ["phone", "otp"];

export function parseAuthStep(step: string | undefined): AuthStep | undefined {
  return VALID_STEPS.includes(step as AuthStep) ? (step as AuthStep) : undefined;
}

/** The `OtpStage` a URL step corresponds to, for driving PhoneAuth's initial
 *  render. `undefined` (no/invalid step) leaves PhoneAuth's own default. */
export function otpStageForAuthStep(step: AuthStep | undefined): OtpStage | undefined {
  if (step === "phone") return "phone";
  if (step === "otp") return "code";
  return undefined;
}

/** The reverse mapping, used to keep the address bar in sync as the visitor
 *  progresses through PhoneAuth. "collapsed" has no URL representation — that
 *  teaser state only exists on other islands, never on /login itself. */
export function authStepForOtpStage(stage: OtpStage): AuthStep | undefined {
  if (stage === "phone") return "phone";
  if (stage === "code") return "otp";
  return undefined;
}

/** Return-route guard (domain invariant 13, "Return-Route Preservation";
 *  D-05A/D-10 owner ruling 2026-08-11). Rejects protocol-relative (`//host`),
 *  absolute external URLs, non-http(s) schemes (`javascript:`), and
 *  malformed values — only a same-origin absolute path is honored — so
 *  `next` can never be used to bounce a freshly verified session off-site.
 *  Falls back to `/`.
 *
 *  Parsed through the real WHATWG URL parser rather than a hand-rolled
 *  regex: a regex checking "does it start with exactly one /" still misses
 *  the classic backslash-normalization bypass (`/\evil.example` — browsers
 *  treat `\` as `/` for special schemes per the URL spec, so a regex that
 *  only rejects a literal second `/` lets `/\evil.example` straight
 *  through). Resolving against a placeholder origin and checking the
 *  RESULT's origin catches that by construction: the parser applies the
 *  exact same normalization a browser would, so there is no bypass left to
 *  individually enumerate. */
const SANITIZER_BASE_ORIGIN = "http://tnm-returnto-sanitizer.internal";

export function safeNextPath(next: string | undefined): string {
  const FALLBACK = "/";
  if (!next) return FALLBACK;
  // Reject anything that isn't a literal absolute-path string up front —
  // e.g. a bare "menu" or an encoded "%2Fevil.com" resolves "successfully"
  // against the placeholder base below without ever being same-origin
  // *content*, but only a genuine "/..." string is the contract this
  // function honors (domain invariant 13: same-origin absolute path only).
  if (!next.startsWith("/")) return FALLBACK;
  let parsed: URL;
  try {
    parsed = new URL(next, SANITIZER_BASE_ORIGIN);
  } catch {
    return FALLBACK;
  }
  if (parsed.origin !== SANITIZER_BASE_ORIGIN) return FALLBACK;
  return parsed.pathname + parsed.search + parsed.hash;
}
