"use client";
// Company workspace landing — the accept-redirect target and the planner's
// back-link. Read-only: company header, office-lunch list, team roster. Admins
// get a lunch-planner link. Session-gated (401 → PhoneAuth).
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/apiClient";
import { formatPaise } from "@/lib/format";
import { getCompany, getCompanyOfficeOrders, officeWindowOpen, type Company, type CompanyMember, type OfficeOrder } from "@/lib/companyApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

export function CompanyLanding({ slug }: { slug: string }) {
  const [data, setData] = useState<{ company: Company; membership: CompanyMember | null; members: CompanyMember[] } | null>(null);
  const [orders, setOrders] = useState<OfficeOrder[]>([]);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  const load = useCallback(async () => {
    try {
      const c = await getCompany(slug);
      setData(c); setState("ready"); setNeedsAuth(false);
      void getCompanyOfficeOrders(slug).then((r) => setOrders(r.officeOrders)).catch(() => {});
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setNeedsAuth(true);
      else setState("missing");
    }
  }, [slug]);
  useEffect(() => { void load(); }, [load]);

  if (needsAuth) return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">Sign in to view your company workspace.</p>
      <PhoneAuth onVerified={() => void load()} />
    </div>
  );
  if (state === "loading") return <p className="text-sm text-ink-muted">Loading…</p>;
  if (state === "missing" || !data) return <p className="text-sm text-ink-muted">This company workspace isn&rsquo;t available to you.</p>;

  const { company, membership, members } = data;
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-line bg-surface p-6">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{company.name}</h1>
        <p className="mt-2 text-sm text-ink-muted">Company meal program · <span className="tabular font-semibold text-ink">{formatPaise(company.perEmployeeMonthlyBudgetPaise)}</span>/person/month</p>
        {membership?.role === "admin" && (
          <Link href={`/corporate/${company.slug}/lunch-planner`} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-gold-text hover:underline">
            Open the lunch planner
            <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>

      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Office lunches</h2>
        {orders.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">No office lunches scheduled yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/office-lunch/${o.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 hover:border-[var(--gold)]">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{o.title}</span>
                    <span className="text-xs text-ink-faint">{day(o.scheduledFor)}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${officeWindowOpen(o) ? "bg-sage text-sage-foreground" : "bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-ink-muted"}`}>
                    {officeWindowOpen(o) ? "Picks open" : o.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Team ({members.length})</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {members.map((m) => (
            <li key={m.id} className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs text-ink-muted">{m.email}{m.role === "admin" ? " · admin" : ""}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
