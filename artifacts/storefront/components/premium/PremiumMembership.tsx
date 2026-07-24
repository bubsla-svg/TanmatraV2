"use client";
// Premium purchase + membership state. Session-gated (401 → PhoneAuth). Joining
// is a real money-path: server order → Razorpay modal → server verify+activate
// (payForPremium). Cancel/resume are free (period already paid).
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/apiClient";
import { formatPaise } from "@/lib/format";
import { createRazorpayAdapter } from "@/lib/razorpayAdapter";
import { getPremium, payForPremium, cancelPremium, resumePremium, type PremiumMe } from "@/lib/premiumApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function PremiumMembership() {
  const [me, setMe] = useState<PremiumMe | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setMe(await getPremium()); setNeedsAuth(false); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Couldn't load Premium."); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const run = useCallback(async (fn: () => Promise<void>, fallback: string) => {
    setBusy(true); setError(null);
    try { await fn(); }
    catch (e) {
      if (e instanceof ApiError && e.status === 401) setNeedsAuth(true);
      else setError(e instanceof ApiError ? e.message : fallback);
    } finally { setBusy(false); }
  }, []);

  const join = () => run(async () => {
    const membership = await payForPremium(createRazorpayAdapter());
    setMe((p) => ({ membership, isPremium: true, pricePaise: p?.pricePaise ?? membership.monthlyPricePaise }));
  }, "Payment didn't complete — you can try again.");

  const cancel = () => run(async () => { const { membership } = await cancelPremium(); setMe((p) => p && { ...p, membership }); }, "Couldn't cancel.");
  const resume = () => run(async () => { const { membership } = await resumePremium(); setMe((p) => p && { ...p, membership, isPremium: true }); }, "Couldn't resume.");

  if (needsAuth) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">Sign in to join Tanmatra Premium.</p>
        <PhoneAuth onVerified={() => void load()} />
      </div>
    );
  }
  if (!me) return <p className="text-sm text-ink-muted">{error ?? "Loading Premium…"}</p>;

  const m = me.membership;
  const active = me.isPremium && m;
  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <p className="tabular text-3xl font-bold text-gold-text">{formatPaise(me.pricePaise)}<span className="text-sm font-medium text-ink-muted"> / month</span></p>
      {error && <p role="alert" className="mt-2 text-xs font-medium text-[var(--danger)]">{error}</p>}

      {active ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="rounded-lg bg-sage-soft px-3 py-2 text-sm font-medium text-sage-text">
            Active membership — {m.status === "cancelled" ? "ends" : "renews"} on {day(m.currentPeriodEnd)}.
          </p>
          <p className="tabular text-xs text-ink-muted">RD consults used this period: {m.rdConsultsUsedThisPeriod} / {m.rdConsultsPerPeriod}</p>
          <Link href="/rd" className="rounded-xl bg-gold px-5 py-2.5 text-center text-sm font-semibold text-[var(--gold-ink)]">Book your free RD consult</Link>
          {m.status === "cancelled"
            ? <button type="button" onClick={resume} disabled={busy} className="text-sm font-medium text-gold-text hover:underline disabled:opacity-60">{busy ? "Working…" : "Resume auto-renewal"}</button>
            : <button type="button" onClick={cancel} disabled={busy} className="text-sm font-medium text-ink-muted hover:text-ink disabled:opacity-60">{busy ? "Working…" : "Cancel renewal"}</button>}
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" onClick={join} disabled={busy} className="rounded-xl bg-gold px-6 py-3 text-sm font-semibold text-[var(--gold-ink)] disabled:opacity-60">
            {busy ? "Opening payment…" : "Join Tanmatra Premium"}
          </button>
          <p className="text-xs text-ink-faint">Cancel anytime · your first RD consult is included every period.</p>
        </div>
      )}
    </div>
  );
}
