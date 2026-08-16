import type { Metadata } from "next";
import { LoginCard } from "@/components/auth/LoginCard";
import { parseAuthStep, safeNextPath } from "@/lib/loginRoute";
import { FocusHeader } from "@/components/FocusHeader";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

/**
 * Standalone OTP entry (§2 — account access; checkout keeps its own in-flow
 * identity). `next` is sanitized to an internal path — a value that isn't a
 * genuine same-origin absolute path falls back to "/", so this can never be
 * an open redirect (lib/loginRoute.ts owns the guard, unit-tested there).
 *
 * `step` is the P0 §7 canonical linkable auth state (`phone|otp`) — LoginCard
 * opens directly at that stage and keeps the address bar in sync as the
 * visitor progresses. `account-conflict` is part of the P0-specified step
 * enum but has no backing implementation yet (see
 * docs/architecture/route-contract.md §3.2); an unrecognised or absent step
 * falls back to PhoneAuth's own default.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; step?: string }>;
}) {
  const { next, step } = await searchParams;
  const safeNext = safeNextPath(next);
  const authStep = parseAuthStep(step);
  return (
    <div className="min-h-dvh">
      <FocusHeader backLabel="Back" />
      {/* The plainest, most utilitarian screen in the batch (Brief 26): one
          centered card, generous whitespace, nothing competing with the OTP
          flow that lives inside it. */}
      <section className="mx-auto max-w-md px-4 py-16 md:py-24">
        <LoginCard next={safeNext} initialStep={authStep} />
      </section>
    </div>
  );
}
