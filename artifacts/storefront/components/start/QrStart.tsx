"use client";
// Client: two decisions and nothing else — a PIN code, then veg or non-veg.
// Everything above it on the page is server-rendered proof.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { NotifyMeForm } from "@/components/onboarding/NotifyMeForm";
import { emitFunnel } from "@/lib/funnel";
import { formatPaise } from "@/lib/format";
import { formatDeliveryDate } from "@/lib/deliveryCutoff";
import { recallDiet, rememberDiet } from "@/lib/dietMemory";
import { nextWeekdayISO } from "@/lib/planCheckout";
import {
  checkServiceability,
  loadServiceabilityState,
  saveServiceabilityState,
  type ServiceabilityState,
} from "@/lib/serviceabilityApi";
import { TRIAL_COPY } from "@/lib/trial";
import type { TrialTrack } from "@/lib/trialTrio";

/**
 * The two-screen half of the scan-to-paid landing (screens 1 and 2).
 *
 * ONE ASK PER SCREEN, and the order is not cosmetic. The PIN code decides
 * whether any of the rest is possible, so it comes before the diet question and
 * a long way before anything personal — the same ordering `PlanServiceabilityGate`
 * enforces inside checkout, for the same reason.
 *
 * NO MENU. The next screen is a single toggle, not the catalogue: a cold
 * scanner who is handed 95 dishes to browse is a cold scanner who leaves. The
 * trio is fixed (02e §3.5) and the price is the spine's.
 *
 * BACK KEEPS STATE, structurally rather than by wiring: the verdict lives in
 * the shared `tnm_serviceability_state` key and the diet in `tnm_diet_memory`,
 * both read at mount. Someone who backs out of checkout returns to this screen
 * already past the PIN gate with their choice still selected, and someone who
 * answered the PIN in the header bar on a previous visit never sees it at all
 * (Law 4).
 */
export function QrStart({ pricePaise }: { pricePaise: number }) {
  const router = useRouter();
  const [pincode, setPincode] = useState("");
  const [state, setState] = useState<ServiceabilityState>({ verdict: "unknown", pincode: "" });
  const [track, setTrack] = useState<TrialTrack>("veg");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadServiceabilityState();
    setState(stored);
    if (stored.pincode) setPincode(stored.pincode);
    const diet = recallDiet();
    if (diet) setTrack(diet.chip === "non_veg" ? "nonveg" : "veg");
    emitFunnel("qr_landing_view");
  }, []);

  const pinDigits = pincode.replace(/\D/g, "");
  const pinValid = pinDigits.length === 6;

  async function check() {
    if (!pinValid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await checkServiceability(pinDigits);
      saveServiceabilityState(next);
      setState(next);
      emitFunnel(
        next.verdict === "serviceable" ? "qr_pincode_serviceable" : "qr_pincode_unserviceable",
        { pincode_prefix: next.pincode.slice(0, 3) },
      );
    } catch {
      // Law 9: name the next action, never just the failure.
      setError("We couldn't check that PIN code just now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  function chooseTrack(next: TrialTrack) {
    setTrack(next);
    rememberDiet({ chip: next === "nonveg" ? "non_veg" : "veg", source: "filtered" });
    emitFunnel("cuj_track_selected", { track: next, plan_id: "trial_3day" });
  }

  function start() {
    emitFunnel("cuj_checkout_start", { planId: "trial_3day", track });
    router.push(`/checkout?plan=trial_3day&track=${track}`);
  }

  // NO HYDRATION GATE — deliberately the opposite of PlanServiceabilityGate,
  // which renders nothing until localStorage has been read so a customer who
  // already answered never sees the field flash.
  //
  // That trade is correct inside checkout, where most arrivals HAVE answered.
  // It is backwards here. This page is where a scan lands, so essentially every
  // visitor is new, has nothing in storage, and needs the one field on the page
  // to be in the first HTML chunk — gating it behind hydration put an empty box
  // where the only ask should be, on the one screen whose whole job is to get
  // that ask answered. The cost is that a RETURNING visitor may see the field
  // for a frame before the effect promotes them past it, which is the cheaper
  // of the two mistakes by a wide margin.
  if (state.verdict === "serviceable") {
    // `nextWeekdayISO` is the SAME call `buildSubscriptionInput` books the
    // first delivery with, so this date cannot promise a day the create route
    // would not schedule. Computed here, after an interaction, rather than at
    // render time on the server — a date derived from "now" on both sides of
    // hydration is a mismatch waiting to happen.
    const earliest = formatDeliveryDate(nextWeekdayISO(new Date()));
    return (
      <section className="flex flex-col gap-5" aria-label="Start your taste test">
        <div className="rounded-2xl border border-line bg-surface p-5 text-center">
          <p className="font-display text-lg font-semibold leading-tight text-primary">
            We deliver to <span className="font-data tabular">{state.pincode}</span>
          </p>
          <p className="tabular mt-1 text-xs text-ink-muted">
            {earliest ? `Earliest box: ${earliest}` : null}
          </p>
          <button
            type="button"
            onClick={() => {
              setState({ verdict: "unknown", pincode: "" });
              setPincode("");
            }}
            className="mt-1 inline-flex min-h-11 items-center text-xs font-medium text-ink-muted underline underline-offset-4 hover:text-ink"
          >
            Change PIN code
          </button>
        </div>

        <div className="flex flex-col items-center gap-2">
          <p id="qr-diet-label" className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted">
            How do you eat?
          </p>
          <div
            role="group"
            aria-labelledby="qr-diet-label"
            className="flex flex-wrap justify-center gap-2"
          >
            {([
              { id: "veg" as const, label: "Veg" },
              { id: "nonveg" as const, label: "Non-veg" },
            ]).map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={track === t.id}
                onClick={() => chooseTrack(t.id)}
                className={`inline-flex min-h-11 items-center rounded-full border px-6 text-sm font-medium transition-colors active:scale-[0.98] ${
                  track === t.id ? "border-gold bg-primary/10 text-primary" : "border-transparent bg-secondary text-ink-muted hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <Button
          type="button"
          onClick={start}
          shape="pill"
          size="fluid"
          className="w-full min-h-12 px-8 py-3.5 text-center text-base font-semibold"
        >
          Get my 3 boxes · {formatPaise(pricePaise)}
        </Button>
        <p className="text-center text-xs text-ink-muted">{TRIAL_COPY.noAutoConvert}</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3" aria-label="Delivery availability">
      <label htmlFor="qr-pincode" className="font-display text-xl font-semibold leading-tight text-primary">
        Do we deliver to you?
      </label>
      <div className="flex gap-2">
        <input
          id="qr-pincode"
          inputMode="numeric"
          autoComplete="postal-code"
          value={pincode}
          onChange={(e) => setPincode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void check();
          }}
          placeholder="201301"
          aria-invalid={pincode.length > 0 && !pinValid}
          className="min-w-0 min-h-[50px] flex-1 rounded-2xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none placeholder:text-ink-faint focus-visible:border-primary"
        />
        <Button
          shape="pill"
          onClick={() => void check()}
          disabled={!pinValid || busy}
          className="min-h-12 shrink-0 px-5 py-3 font-semibold"
        >
          {busy ? "Checking…" : "Check"}
        </Button>
      </div>

      {error && <p role="alert" className="text-xs font-medium text-danger">{error}</p>}

      {state.verdict === "unserviceable" && (
        // Never a dead end (Law 10): an unserved PIN ends in a captured lead
        // and a way to correct a typo, not in an apology. The {" "} is
        // load-bearing — a literal space written after an interpolation is
        // swallowed here (F-8).
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <p className="text-sm leading-relaxed text-ink-muted">
            Not in {state.pincode}{" "}yet — we currently serve Noida sectors only. Leave
            your number and we&rsquo;ll message you the day we reach you.
          </p>
          <NotifyMeForm
            pincode={state.pincode}
            onReset={() => {
              setState({ verdict: "unknown", pincode: "" });
              setPincode("");
            }}
          />
        </div>
      )}
    </section>
  );
}
