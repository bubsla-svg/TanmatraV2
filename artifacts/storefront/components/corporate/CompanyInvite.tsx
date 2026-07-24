"use client";
// Accept a company invite by token. Public preview; accepting binds the invited
// email's membership to the signed-in user (server enforces email match). 401 →
// login-then-return; 403 → email mismatch.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/apiClient";
import { getInvite, acceptInvite, type CompanyMember, type Company } from "@/lib/companyApi";

export function CompanyInvite({ token }: { token: string }) {
  const router = useRouter();
  const [invite, setInvite] = useState<CompanyMember | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getInvite(token)
      .then((r) => { setInvite(r.invite); setCompany(r.company ?? null); setState("ready"); })
      .catch(() => setState("missing"));
  }, [token]);

  async function accept() {
    setBusy(true); setError(null);
    try {
      const res = await acceptInvite(token);
      const slug = res.company?.slug ?? company?.slug;
      router.push(slug ? `/corporate/${slug}` : "/account");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { router.push(`/login?next=${encodeURIComponent(`/corporate/invite/${token}`)}`); return; }
      setError(e instanceof ApiError && e.status === 403 ? "This invite was sent to a different email — sign in with that address." : "Could not accept the invite.");
      setBusy(false);
    }
  }

  if (state === "loading") return <p className="text-sm text-ink-muted">Fetching your invitation…</p>;
  if (state === "missing" || !invite) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 text-center">
        <p className="text-sm font-semibold text-ink">Invite unavailable</p>
        <p className="mt-1 text-sm text-ink-muted">This link may have expired or already been used. Ask your company admin for a fresh invite.</p>
        <Link href="/corporate" className="mt-3 inline-block text-sm font-medium text-gold-text hover:underline">Back to Corporate</Link>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <h1 className="text-lg font-semibold text-ink">{company?.name ?? "Company meal program"}</h1>
      <p className="mt-1 text-sm text-ink-muted">
        You&rsquo;ve been invited as a{invite.role === "admin" ? "n" : ""} <span className="font-medium text-ink">{invite.role}</span>. Accept to start using the company meal program.
      </p>
      <div className="mt-4 rounded-xl border border-line bg-surface-raised p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Invitation for</p>
        <p className="mt-1 text-sm text-ink">{invite.email}</p>
      </div>
      {error && <p role="alert" className="mt-3 text-xs font-medium text-[var(--danger)]">{error}</p>}
      <button type="button" onClick={accept} disabled={busy} className="mt-4 w-full rounded-xl bg-gold px-6 py-3 text-sm font-semibold text-[var(--gold-ink)] disabled:opacity-60">
        {busy ? "Joining…" : "Accept invite"}
      </button>
      <p className="mt-3 text-center text-[11px] text-ink-faint">Secure corporate invitation.</p>
    </div>
  );
}
