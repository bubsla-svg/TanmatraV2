// Wizard-state contract (playbook R1 — docs/e2e-master-playbook-noida-ncr.md).
//
// Every multi-step flow MUST persist:
//   (a) the step index in the URL (`?step=`),
//   (b) draft state in sessionStorage under a versioned key
//       (`tanmatra:<flow>-draft:v1`),
//   (c) rehydrate-once-on-mount,
//   (d) popstate walks steps (browser Back walks the wizard, not out of it),
//   (e) clear-on-success.
//
// Extracted from the remediation proven in tanmatra-v2/Subscribe.tsx (the
// State-Amnesia fix). The storage key format, flat JSON payload shape
// ({ ...draftFields, step }) and step-parsing semantics are byte-compatible
// with the drafts that page already wrote, so in-flight v1 drafts survive
// the extraction.
//
// Drafts are scoped to the tab session (sessionStorage, never localStorage)
// and cleared by the flow on success. NEVER put payment identifiers, OTP
// codes, card/UPI data or any other secret in a wizard draft — only benign,
// re-enterable form state belongs here.
//
// SSR-safe (all window access is guarded) and storage-exception-safe (every
// sessionStorage touch is wrapped in try/catch, same discipline as
// SoftGate.tsx — private mode or quota exhaustion degrades to in-memory).

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";

/**
 * Reserved payload field: the step index is serialized alongside the draft
 * fields in one flat JSON object (the historical Subscribe draft shape).
 * Draft types must not declare their own `step` — it would be overwritten.
 */
const STEP_FIELD = "step";

// ---------------------------------------------------------------------------
// Pure helpers — exported separately so they are unit-testable without React
// or a DOM (see useWizardState.test.ts).
// ---------------------------------------------------------------------------

/** Versioned sessionStorage key for a flow's draft: `tanmatra:<flow>-draft:v1`. */
export function wizardDraftKey(flow: string): string {
  return `tanmatra:${flow}-draft:v1`;
}

/**
 * Clamp a PROGRAMMATIC step change into [0, totalSteps - 1]. Used by
 * `goToStep`, where the caller's intent is "move as far as allowed".
 */
export function boundWizardStep(next: number, totalSteps: number): number {
  const max = Math.max(0, Math.trunc(totalSteps) - 1);
  if (!Number.isFinite(next)) return 0;
  return Math.min(Math.max(0, Math.trunc(next)), max);
}

/**
 * Interpret an UNTRUSTED step value (URL `?step=` param or a stored draft).
 * A valid integer inside [0, totalSteps - 1] is kept; anything else falls
 * back to 0 — the flow start — and deliberately never clamps into range, so
 * a hand-edited `?step=99` restarts the wizard instead of jumping to the
 * final (payment/success) step. Matches the proven Subscribe semantics.
 */
export function parseWizardStep(value: unknown, totalSteps: number): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  return Number.isInteger(n) && n >= 0 && n < totalSteps ? n : 0;
}

/**
 * JSON-decode a stored draft payload. Returns null for missing/blank input,
 * invalid JSON, or any value that is not a plain object — a corrupt draft
 * must degrade to "no draft", never throw.
 */
export function decodeWizardDraftRecord(
  raw: string | null | undefined,
): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Serialize draft fields + step into the flat storage payload
 * (`{ ...fields, step }`) — the exact shape Subscribe.tsx has always written
 * under `tanmatra:subscribe-draft:v1`.
 */
export function serializeWizardDraft(
  draft: Record<string, unknown>,
  step: number,
): string {
  return JSON.stringify({ ...draft, [STEP_FIELD]: step });
}

// ---------------------------------------------------------------------------
// The hook
// ---------------------------------------------------------------------------

export interface WizardStateOptions<T extends Record<string, unknown>> {
  /** Flow name — becomes the storage key `tanmatra:<flow>-draft:v1`. */
  flow: string;
  /** Number of step states; valid steps are 0 … totalSteps - 1. */
  totalSteps: number;
  /** Draft used when nothing (valid) is stored. */
  initialDraft: T;
  /**
   * Validate/shape the stored payload (step field included, alongside the
   * draft fields) into a draft. Return null to discard it and fall back to
   * `initialDraft`. When omitted, stored fields (minus `step`) are shallow-
   * merged over `initialDraft` as-is — pass `parse` whenever field types
   * matter.
   */
  parse?: (stored: Record<string, unknown>) => T | null;
  /**
   * Mirror the step into the URL (`?step=`) and walk it on popstate.
   * Default true. Single-scroll flows that only want draft persistence
   * (e.g. Checkout on desktop) can pass false.
   */
  mirrorStepInUrl?: boolean;
  /** URL query param name for the step. Default "step". */
  stepParam?: string;
}

export interface WizardStateApi<T extends Record<string, unknown>> {
  /** Current step, always within [0, totalSteps - 1]. */
  step: number;
  /** Move to a step (bounded into range). Pushes a history entry when URL
   * mirroring is on, so the browser Back button walks back through steps. */
  goToStep: (next: number) => void;
  /** The draft. On first render this is the rehydrated stored draft (or
   * `initialDraft`) — read it once on mount to restore field state. */
  draft: T;
  /** Shallow-merge a partial (or updater-returned partial) into the draft;
   * the hook re-serializes to sessionStorage on change. No-ops (all patched
   * values already identical) skip the state update entirely. */
  patchDraft: (patch: Partial<T> | ((prev: T) => Partial<T>)) => void;
  /** Clear-on-success: remove the persisted draft. In-memory draft state is
   * left untouched (the flow is about to unmount or show its success view);
   * any later step/draft change re-persists, same as the original flow. */
  clearDraft: () => void;
}

export function useWizardState<T extends Record<string, unknown>>(
  options: WizardStateOptions<T>,
): WizardStateApi<T> {
  const {
    flow,
    totalSteps,
    initialDraft,
    parse,
    mirrorStepInUrl = true,
    stepParam = "step",
  } = options;
  const storageKey = wizardDraftKey(flow);
  const [, setSearchParams] = useSearchParams();

  // (c) Rehydrate ONCE per mount. Lazy (ref-guarded, computed during the
  // first render only) so storage is never re-read on re-renders. SSR-safe:
  // without window we start at step 0 with `initialDraft` — exactly what the
  // pre-extraction Subscribe implementation did.
  const initialRef = useRef<{ step: number; draft: T } | null>(null);
  if (initialRef.current === null) {
    let stored: Record<string, unknown> | null = null;
    if (typeof window !== "undefined") {
      try {
        stored = decodeWizardDraftRecord(window.sessionStorage.getItem(storageKey));
      } catch {
        stored = null; // storage disabled / private mode — run in-memory
      }
    }
    let draft = initialDraft;
    if (stored) {
      if (parse) {
        draft = parse(stored) ?? initialDraft;
      } else {
        const { [STEP_FIELD]: _step, ...fields } = stored;
        draft = { ...initialDraft, ...fields } as T;
      }
    }
    initialRef.current = {
      step: parseWizardStep(stored?.[STEP_FIELD], totalSteps),
      draft,
    };
  }

  const [step, setStep] = useState<number>(initialRef.current.step);
  const [draft, setDraft] = useState<T>(initialRef.current.draft);

  const goToStep = useCallback(
    (next: number) => {
      setStep(boundWizardStep(next, totalSteps));
    },
    [totalSteps],
  );

  const patchDraft = useCallback(
    (patch: Partial<T> | ((prev: T) => Partial<T>)) => {
      setDraft((prev) => {
        const partial = typeof patch === "function" ? patch(prev) : patch;
        let changed = false;
        for (const key of Object.keys(partial)) {
          if (!Object.is(prev[key as keyof T], partial[key as keyof T])) {
            changed = true;
            break;
          }
        }
        return changed ? { ...prev, ...partial } : prev;
      });
    },
    [],
  );

  const clearDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(storageKey);
    } catch {
      // non-fatal — nothing persisted means nothing to leak
    }
  }, [storageKey]);

  // (b) Serialize-on-change: any step or draft change rewrites the payload.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(storageKey, serializeWizardDraft(draft, step));
    } catch {
      // private mode / quota — non-fatal, the flow still works in-memory
    }
  }, [storageKey, step, draft]);

  // (a) Mirror `step` into the URL so the browser Back button walks back
  // through the wizard instead of dropping the buyer out of the money flow.
  // `goToStep` is the single source of truth; this effect only reflects it
  // into history (push, one entry per step), and the popstate listener below
  // reflects history back into `step` — no loop because each side guards on
  // equality (the address-bar check here also prevents the duplicate push a
  // popstate-triggered step change would otherwise cause).
  const urlSyncedRef = useRef(false);
  useEffect(() => {
    if (!mirrorStepInUrl) return;
    if (typeof window === "undefined") return;
    if (!urlSyncedRef.current) {
      urlSyncedRef.current = true; // skip the initial mount push
      return;
    }
    const inUrl = new URLSearchParams(window.location.search).get(stepParam);
    if (inUrl === String(step)) return;
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set(stepParam, String(step));
        return p;
      },
      { replace: false },
    );
    // Only `step` may trigger a push — setSearchParams identity churns per
    // render and must not re-fire this (same discipline as the original).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // (d) popstate walks steps.
  useEffect(() => {
    if (!mirrorStepInUrl) return;
    if (typeof window === "undefined") return;
    const onPop = () => {
      const raw = new URLSearchParams(window.location.search).get(stepParam);
      setStep(parseWizardStep(raw, totalSteps));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [mirrorStepInUrl, stepParam, totalSteps]);

  return { step, goToStep, draft, patchDraft, clearDraft };
}
