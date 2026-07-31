"use client";
// Client: session probe + Firebase OTP are browser-only.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { firebaseConfigured, getFirebaseAuth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthUser, verifyOtp } from "@/lib/api";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";
import { Button } from "@/components/ui/button";

/**
 * The /login card (SF account surfaces / CUJ-02). An already-signed-in visitor
 * is forwarded to `next` immediately (replace, so Back never bounces through
 * /login — the no-redirect-loop rule); otherwise Firebase OTP signs them in and
 * the verified session forwards the same way. No Firebase config = the same
 * fail-LOUD fallback the plan gate uses — never a silent dead end.
 */
export function LoginCard({ next }: { next: string }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

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
          const auth = getFirebaseAuth();
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
    <div className="flex flex-col gap-6 rounded-3xl border border-line bg-surface p-6 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Sign in</h1>
      {checking ? (
        <p className="text-sm text-ink-muted">Checking your session…</p>
      ) : firebaseConfigured() ? (
        <>
          <p className="text-sm text-ink-muted">A code by SMS, no passwords.</p>
          <PhoneAuth onVerified={() => router.replace(next)} />
        </>
      ) : (
        <>
          <p role="alert" className="text-sm font-medium text-[var(--danger)]">
            Sign-in is temporarily unavailable. You can order individual dishes from the menu meanwhile.
          </p>
          <Button asChild shape="pill" size="fluid" className="self-start px-5 py-3 font-semibold">
            <Link href="/menu">Browse the menu</Link>
          </Button>
        </>
      )}
    </div>
  );
}
