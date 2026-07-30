"use client";
// Accept a company invite by token. Public preview; accepting binds the invited
// email's membership to the signed-in user (server enforces email match). 401 →
// login-then-return; 403 → email mismatch.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
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

  if (state === "loading") {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-surface">
          <Building2 className="h-7 w-7 text-gold-text" strokeWidth={1.75} />
        </div>
        <p className="text-sm text-ink-muted">Fetching your invitation…</p>
      </div>
    );
  }
  if (state === "missing" || !invite) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-3xl border border-line bg-surface p-8 text-center">
        <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full border border-line bg-surface">
          <Building2 className="h-7 w-7 text-ink-faint" strokeWidth={1.75} />
        </div>
        <p className="text-base font-semibold text-ink">Invite unavailable</p>
        <p className="text-sm text-ink-muted">This link may have expired or already been used. Ask your company admin for a fresh invite.</p>
        <Link href="/corporate" className="mt-2 inline-block text-sm font-medium text-gold-text hover:underline">Back to Corporate</Link>
      </div>
    );
  }
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
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Invitation for</p>
        <p className="mt-1 text-sm text-ink">{invite.email}</p>
      </div>

      {error && <p role="alert" className="mt-4 text-xs font-medium text-[var(--danger)]">{error}</p>}

      <button
        type="button"
        onClick={accept}
        disabled={busy}
        className="mt-6 w-full rounded-full bg-gold px-6 py-3.5 text-sm font-semibold text-[var(--gold-ink)] transition-opacity disabled:opacity-60"
      >
        {busy ? "Joining…" : "Accept invite"}
      </button>
      <p className="mt-4 text-[11px] text-ink-faint">Secure corporate invitation.</p>
    </div>
  );
}
