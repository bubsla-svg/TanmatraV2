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

/** Return-route guard (domain invariant 13, "Return-Route Preservation").
 *  Rejects protocol-relative (`//host`) and absolute external URLs — only a
 *  same-origin absolute path is honored — so `next` can never be used to
 *  bounce a freshly verified session off-site. */
export function safeNextPath(next: string | undefined): string {
  return next && /^\/(?!\/)/.test(next) ? next : "/account";
}
