"use client";
// RD partner application wizard (Stitch brief 16) — replaces the previous
// local-state dead end, which rendered "Application Submitted" without ever
// transmitting anything.
//
// STATE: one draft, owned here and never unmounted, plus one sessionId minted
// once. The brief allows searchParams or a store; a store is used because the
// draft carries the applicant's name, email and phone, and putting PII in the
// URL leaks it into history, referrers and analytics. What the brief actually
// guards against — a per-step useState that silently drops the opt-in and the
// funnel id when the step remounts — cannot happen here: the step bodies are
// stateless and every value lives in this component.
//
// SUCCESS: rendered only after submitRdApplication resolves, i.e. after the row
// is persisted. Breadcrumbs are best-effort and never block or fail the wizard.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  newRdSessionId,
  submitRdApplication,
  trackRdWizardEvent,
  type RdApplicationRow,
} from "@/lib/rdPartnerApi";
import {
  emptyRdDraft,
  rdStepErrors,
  canLeaveRdStep,
  isRdDraftComplete,
  toRdApplicationInput,
  rdSubmitProblem,
  type RdDraft,
  type RdSubmitProblem,
} from "@/lib/rdWizard";
import { RD_WIZARD_STEPS } from "@/content/landing/rdPartners";
import { WizardStepBody } from "./PartnerWizardSteps";

const LAST_STEP = RD_WIZARD_STEPS.length - 1;

/** Fire-and-forget funnel breadcrumb — a failure here must never reach the UI. */
function breadcrumb(sessionId: string, eventName: string, step?: number, applicationId?: number) {
  void trackRdWizardEvent({
    sessionId,
    eventName,
    ...(step !== undefined && { step }),
    ...(applicationId !== undefined && { applicationId }),
  }).catch(() => {});
}

export function PartnerWizard() {
  const [sessionId] = useState(newRdSessionId);
  const [draft, setDraft] = useState<RdDraft>(emptyRdDraft);
  const [step, setStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<RdSubmitProblem | null>(null);
  const [submitted, setSubmitted] = useState<RdApplicationRow | null>(null);

  const errors = rdStepErrors(draft, step);
  const patch = (p: Partial<RdDraft>) => setDraft((d) => ({ ...d, ...p }));

  function next() {
    if (!canLeaveRdStep(draft, step)) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    breadcrumb(sessionId, "step_complete", step);
    setStep((s) => Math.min(s + 1, LAST_STEP));
  }

  function back() {
    setShowErrors(false);
    setProblem(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function submit() {
    if (!isRdDraftComplete(draft)) {
      setShowErrors(true);
      return;
    }
    setBusy(true);
    setProblem(null);
    breadcrumb(sessionId, "submit_attempt", step);
    try {
      const result = await submitRdApplication(toRdApplicationInput(draft, sessionId));
      setSubmitted(result.application);
      breadcrumb(sessionId, "submit_success", step, result.application.id);
    } catch (e) {
      setProblem(rdSubmitProblem(e));
      breadcrumb(sessionId, "submit_error", step);
    } finally {
      setBusy(false);
    }
  }

  // Confirmed by the server — the only path that reaches this panel.
  if (submitted) {
    return (
      <div className="rounded-3xl border border-line bg-surface p-8 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-sage-soft text-lg text-sage-text">
          ✓
        </span>
        <h2 className="mt-6 text-xl font-semibold tracking-tight text-ink">Application received</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Thanks, {submitted.fullName}. Our clinical governance team reviews credentials and will contact
          you at {submitted.email}.
        </p>
        <p className="tabular mt-4 text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
          Reference #{submitted.id}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <nav aria-label="Progress">
        <ol className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {RD_WIZARD_STEPS.map((s, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li key={s.label} className="flex items-center gap-3">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    done || current ? "bg-gold" : "border border-line bg-transparent"
                  }`}
                />
                <span
                  aria-current={current ? "step" : undefined}
                  className={`text-[10px] font-semibold uppercase tracking-widest ${
                    current ? "text-gold-text" : done ? "text-ink-muted" : "text-ink-faint"
                  }`}
                >
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>

      {problem && (
        <div role="alert" className="relative overflow-hidden rounded-2xl border border-line bg-surface p-4 pl-5">
          <span className="absolute inset-y-0 left-0 w-1 bg-[var(--danger)]" aria-hidden />
          <p className="text-sm font-medium text-ink">{problem.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">{problem.detail}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-line bg-surface">
        <div className="flex flex-col gap-8 p-6 md:p-8">
          <h2 className="text-xl font-semibold tracking-tight text-ink">{RD_WIZARD_STEPS[step]?.heading}</h2>
          <WizardStepBody
            step={step}
            draft={draft}
            errors={showErrors ? errors : {}}
            patch={patch}
            sessionId={sessionId}
          />
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-line bg-bg p-6 sm:flex-row">
          {step > 0 ? (
            <button
              type="button"
              onClick={back}
              className="order-2 text-sm text-ink-muted transition-colors hover:text-ink sm:order-1"
            >
              &larr; Back
            </button>
          ) : (
            <span className="order-2 sm:order-1" />
          )}
          <Button
            type="button"
            disabled={busy || (step === LAST_STEP && problem?.terminal === true)}
            onClick={() => void (step === LAST_STEP ? submit() : next())}
            shape="pill"
            size="fluid"
            className="order-1 w-full px-8 py-4 text-[10px] font-semibold uppercase tracking-widest disabled:opacity-40 sm:order-2 sm:w-auto"
          >
            {busy ? "Submitting…" : step === LAST_STEP ? "Submit application" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
