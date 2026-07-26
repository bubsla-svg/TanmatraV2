"use client"; // Justification: interactive lead form input handling and async network submission.

import React, { useState } from "react";
import { emitLpEvent } from "@/lib/lpEvents";

export interface LeadFormProps {
  pageSlug: string;
  kind: "corporate" | "gym" | "rd" | "trainer" | "dietitian";
  title?: string;
  subtitle?: string;
  buttonLabel?: string;
  endpoint?: string;
  onSuccess?: () => void;
}

/** Reusable CRO LeadForm (L-1 & L-4/L-6) with inline validation and event emission. */
export function LeadForm({
  pageSlug,
  kind,
  title = "Start a Consultation",
  subtitle = "Tell us about your organization or practice.",
  buttonLabel = "Submit Application",
  endpoint,
  onSuccess,
}: LeadFormProps) {
  const isRd = kind === "rd" || kind === "dietitian";
  const targetUrl = endpoint || (kind === "corporate" ? "/api/corporate-leads" : "/api/partners/leads");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload: Record<string, string> = { kind, source: pageSlug };
    form.forEach((v, k) => { if (typeof v === "string" && v.trim()) payload[k] = v.trim(); });
    emitLpEvent("lead_submit", { page: pageSlug, kind });

    if (isRd && (!payload.rdRegNo || !/^[A-Za-z0-9][A-Za-z0-9\s/.-]{2,30}$/.test(payload.rdRegNo))) {
      setErr("Please enter a valid IDA / RD Registration Number (e.g. RD-1234).");
      setLoading(false);
      emitLpEvent("lead_error", { page: pageSlug, error: "bad_rd_reg_no" });
      return;
    }

    try {
      const res = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Submission failed");
      setSubmitted(true);
      emitLpEvent("lead_success", { page: pageSlug, kind });
      onSuccess?.();
    } catch (ex: any) {
      const msg = ex?.message || "Something went wrong. Please try again.";
      setErr(msg);
      emitLpEvent("lead_error", { page: pageSlug, error: msg });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 text-center shadow-sm">
        <h3 className="text-lg font-semibold text-ink">Application Received</h3>
        <p className="mt-2 text-sm text-ink-muted">Our partnership desk will review your credentials and contact you within 24 hours.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-sm">
      <div>
        <h3 className="text-lg font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-xs text-ink-muted">{subtitle}</p>
      </div>
      {err && <div className="rounded-lg border border-line bg-surface-subtle p-2 text-xs font-medium text-ink-muted">{err}</div>}
      <div>
        <label className="block text-xs font-semibold text-ink mb-1">Full Name</label>
        <input required name="name" type="text" placeholder="e.g. Dr. Anjali Rao" className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-ink mb-1">Work Email</label>
        <input required name="email" type="email" placeholder="email@practice.com" className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-ink mb-1">Phone Number</label>
        <input required name="phone" type="tel" placeholder="+91 98765 43210" className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none" />
      </div>
      {isRd ? (
        <>
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">IDA / RD Registration License Number</label>
            <input required name="rdRegNo" type="text" placeholder="e.g. RD-10492 or IDA/5432" className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">Practice Setting</label>
            <select name="practiceSetting" defaultValue="clinic" className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none">
              <option value="clinic">Private Clinic / Studio</option>
              <option value="hospital">Hospital / Clinical Dept</option>
              <option value="freelance">Independent / Freelance</option>
              <option value="online">Online Consultation</option>
            </select>
          </div>
        </>
      ) : (
        <div>
          <label className="block text-xs font-semibold text-ink mb-1">Organization / Gym Name</label>
          <input required name="company" type="text" placeholder="e.g. FitLife NCR" className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none" />
        </div>
      )}
      <button disabled={loading} type="submit" className="w-full rounded-xl bg-gold py-3 text-sm font-semibold text-[var(--gold-ink)] transition-transform active:scale-95 disabled:opacity-50">
        {loading ? "Submitting..." : buttonLabel}
      </button>
    </form>
  );
}
