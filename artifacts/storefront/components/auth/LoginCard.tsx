"use client";
// Client: session probe + Firebase OTP are browser-only.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { firebaseConfigured, getFirebaseAuth } from "@/lib/firebase";
import { getAuthUser, verifyOtp } from "@/lib/api";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";
import { Button } from "@/components/ui/button";
import { authStepForOtpStage, otpStageForAuthStep, type AuthStep } from "@/lib/loginRoute";
import type { OtpStage } from "@/lib/otpFlow";

/**
 * The /login card (SF account surfaces / CUJ-02). An already-signed-in visitor
 * is forwarded to `next` immediately (replace, so Back never bounces through
 * /login — the no-redirect-loop rule); otherwise Firebase OTP signs them in and
 * the verified session forwards the same way. No Firebase config = the same
 * fail-LOUD fallback the plan gate uses — never a silent dead end.
 *
 * `initialStep` opens PhoneAuth directly at the URL's step (P0 §7); as the
 * visitor progresses, syncStepInUrl keeps `?step=` a truthful record of state
 * via router.replace — never a push, so Back doesn't fill up with OTP substeps.
 */
export function LoginCard({ next, initialStep }: { next: string; initialStep?: AuthStep }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  function syncStepInUrl(stage: OtpStage) {
    const step = authStepForOtpStage(stage);
    const qs = new URLSearchParams();
    if (step) qs.set("step", step);
    if (next !== "/account") qs.set("next", next);
    const query = qs.toString();
    router.replace(query ? `/login?${query}` : "/login", { scroll: false });
  }

  useEffect(() => {
    let live = true;
    let unsubscribe: (() => void) | null = null;

    getAuthUser()
      .then(async ({ user }) => {
        if (!live) return;
        if (user) {
          router.replace(next);
          return;
        }

        if (firebaseConfigured()) {
          // Same reason getFirebaseAuth is async: keep the SDK out of the
          // chunk and fetch it when a session is actually being established.
          const [{ onAuthStateChanged }, auth] = await Promise.all([
            import("firebase/auth"),
            getFirebaseAuth(),
          ]);
          if (!live) return;
          unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
            if (!live) return;
            if (fbUser) {
              try {
                const idToken = await fbUser.getIdToken(true);
                await verifyOtp({ idToken });
                if (live) router.replace(next);
              } catch {
                if (live) setChecking(false);
              }
            } else {
              if (live) setChecking(false);
            }
          });
        } else {
          setChecking(false);
        }
      })
      .catch(() => {
        if (live) setChecking(false);
      });

    return () => {
      live = false;
      if (unsubscribe) unsubscribe();
    };
  }, [next, router]);

  // Same card language as the plan flow's identity gate
  // (checkout/plan/PlanIdentityGate.tsx) — one bordered surface, heading
  // always present (an e2e spec asserts the "Sign in" heading regardless of
  // which of the three states below is showing), state-specific content
  // beneath it.
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5">
      <h1 className="font-display text-3xl font-semibold leading-[1.05] tracking-[-.02em] text-primary">Sign in</h1>
      {checking ? (
        <p className="text-sm leading-relaxed text-ink-muted">Checking your session…</p>
      ) : firebaseConfigured() ? (
        <>
          <p className="text-sm leading-relaxed text-ink-muted">A code by SMS, no passwords.</p>
          <PhoneAuth
            startExpanded
            initialStage={otpStageForAuthStep(initialStep)}
            onStageChange={syncStepInUrl}
            onVerified={() => router.replace(next)}
          />
        </>
      ) : (
        <>
          <p role="alert" className="text-sm font-medium text-danger">
            Sign-in is temporarily unavailable. You can order individual dishes from the menu meanwhile.
          </p>
          <Button asChild shape="pill" size="fluid" className="min-h-12 self-start px-5 py-3 font-semibold">
            <Link href="/menu">Browse the menu</Link>
          </Button>
        </>
      )}
    </div>
  );
}
