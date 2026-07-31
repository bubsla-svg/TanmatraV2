import type { Metadata } from "next";
import { LoginCard } from "@/components/auth/LoginCard";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

/**
 * Standalone OTP entry (§2 — account access; checkout keeps its own in-flow
 * identity). `next` is sanitized to an internal path — a value that doesn't
 * start with exactly one "/" falls back to /account, so this can never be an
 * open redirect.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = next && /^\/(?!\/)/.test(next) ? next : "/account";
  return (
    <div className="min-h-screen">
      {/* The plainest, most utilitarian screen in the batch (Brief 26): one
          centered card, generous whitespace, nothing competing with the OTP
          flow that lives inside it. */}
      <section className="mx-auto max-w-md px-4 py-16 md:py-24">
        <LoginCard next={safeNext} />
      </section>
    </div>
  );
}
