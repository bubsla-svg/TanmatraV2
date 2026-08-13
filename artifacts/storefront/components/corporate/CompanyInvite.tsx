"use client";
// Accept a company invite by token. Public preview; accepting binds the invited
// email's membership to the signed-in user (server enforces email match). 401 →
// inline PhoneAuth (island, no redirect — see every other auth-gated surface in
// this app); 403 → email mismatch.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { ApiError } from "@/lib/apiClient";
import { getInvite, acceptInvite } from "@/lib/companyApi";
import { Button } from "@/components/ui/button";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";

export function CompanyInvite({ token }: { token: string }) {
  const router = useRouter();
  const inviteQuery = useQuery({
    queryKey: ["corporate", "invite", token],
    queryFn: () => getInvite(token),
  });
  const [needsAuth, setNeedsAuth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true); setError(null); setNeedsAuth(false);
    try {
      const res = await acceptInvite(token);
      const slug = res.company?.slug ?? inviteQuery.data?.company?.slug;
      router.push(slug ? `/corporate/${slug}` : "/account");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { setNeedsAuth(true); setBusy(false); return; }
      setError(e instanceof ApiError && e.status === 403 ? "This invite was sent to a different email — sign in with that address." : "Could not accept the invite.");
      setBusy(false);
    }
  }

  if (needsAuth) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-line bg-surface p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-surface">
          <Building2 className="h-7 w-7 text-gold-text" strokeWidth={1.75} />
        </div>
        <p className="text-sm text-ink-muted">Sign in to accept this invite.</p>
        <PhoneAuth startExpanded onVerified={() => void accept()} />
      </div>
    );
  }

  if (inviteQuery.isPending) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-surface">
          <Building2 className="h-7 w-7 text-gold-text" strokeWidth={1.75} />
        </div>
        <p className="text-sm text-ink-muted">Fetching your invitation…</p>
      </div>
    );
  }

  if (inviteQuery.isError) {
    // A genuinely missing/expired/used invite (404) is the only case that
    // earns the "ask your admin" copy. Every other failure — network blip,
    // 500 — is transient and gets a retry, not a dead end.
    const notFound = inviteQuery.error instanceof ApiError && inviteQuery.error.status === 404;
    return (
      <div className="flex flex-col items-center gap-2 rounded-3xl border border-line bg-surface p-8 text-center">
        <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full border border-line bg-surface">
          <Building2 className="h-7 w-7 text-ink-faint" strokeWidth={1.75} />
        </div>
        <h1 className="text-base font-semibold text-ink">{notFound ? "Invite unavailable" : "Couldn't load this invite"}</h1>
        <p className="text-sm text-ink-muted">
          {notFound
            ? "This link may have expired or already been used. Ask your company admin for a fresh invite."
            : "Something went wrong loading this invite. Please try again."}
        </p>
        {notFound ? (
          <Link href="/corporate-wellness" className="mt-2 inline-block text-sm font-medium text-gold-text hover:underline">Back to Corporate</Link>
        ) : (
          <button type="button" onClick={() => void inviteQuery.refetch()} className="mt-2 text-sm font-medium text-gold-text hover:underline">Try again</button>
        )}
      </div>
    );
  }

  const { invite, company } = inviteQuery.data;

  return (
    <div className="flex flex-col items-center rounded-3xl border border-line bg-surface p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-surface">
        <Building2 className="h-7 w-7 text-gold-text" strokeWidth={1.75} />
      </div>
      <h1 className="mt-5 text-xl font-semibold tracking-tight text-ink">{company?.name ?? "Company meal program"}</h1>
      <p className="mt-2 text-sm text-ink-muted">
        You&rsquo;ve been invited as a{invite.role === "admin" ? "n" : ""} <span className="font-medium text-ink">{invite.role}</span>. Accept to start using the company meal program.
      </p>

      <div className="mt-6 w-full rounded-2xl border border-line bg-surface-raised p-4 text-left">
        <p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">Invitation for</p>
        <p className="mt-1 text-sm text-ink">{invite.email}</p>
      </div>

      {error && <p role="alert" className="mt-4 text-xs font-medium text-[var(--danger)]">{error}</p>}

      <Button
        type="button"
        onClick={accept}
        disabled={busy}
        shape="pill"
        size="fluid"
        className="mt-6 w-full px-6 py-3.5 font-semibold disabled:opacity-60"
      >
        {busy ? "Joining…" : "Accept invite"}
      </Button>
      <p className="mt-4 text-2xs text-ink-faint">Secure corporate invitation.</p>
    </div>
  );
}
