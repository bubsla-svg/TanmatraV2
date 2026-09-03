"use client";
// Client island: RD consult booking (Wave D money path). Pick a session + slot,
// book (auth-gated), and — for paid consults — settle via Razorpay. The client
// NEVER authors a price: booking is server-priced, the Razorpay order comes from
// the server, and /verify flips the status. Free 15-min intros skip payment.
// Slot loading is a useQuery for the shared cache/retry infra — key extends the
// ["rd","booking"] convention with rd.slug + kind (both required for a correct
// cache entry: a static key would serve stale slots across RDs/session kinds).
// getSlots' own error handling is untouched: any failure still resolves to []
// ("No open slots… check back soon"), matching its pre-migration behavior.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/apiClient";
import { formatPaise } from "@/lib/format";
import { createRazorpayAdapter, RazorpayDismissed } from "@/lib/razorpayAdapter";
import {
  getSlots, bookAppointment, payForAppointment,
  type Slot, type SessionKind, type Appointment,
} from "@/lib/rdBookingApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";
import type { RdPricing } from "@/lib/rdApi";

const KINDS: { kind: SessionKind; label: string; priceKey: keyof RdPricing }[] = [
  { kind: "intro_15m", label: "15-min intro", priceKey: "intro_15m" },
  { kind: "follow_up_30m", label: "30-min consult", priceKey: "follow_up_30m" },
  { kind: "follow_up_45m", label: "45-min consult", priceKey: "follow_up_45m" },
];
const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata",
  });

export function RdBooking({ rd }: { rd: { slug: string; name: string; pricing: RdPricing; bookable: boolean } }) {
  const [kind, setKind] = useState<SessionKind>("intro_15m");
  const [sel, setSel] = useState<Slot | null>(null);
  const [booked, setBooked] = useState<Appointment | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const price = rd.pricing[KINDS.find((k) => k.kind === kind)!.priceKey];

  const { data: slots, refetch: reloadSlots } = useQuery({
    queryKey: ["rd", "booking", rd.slug, kind],
    queryFn: async () => {
      try { return await getSlots(rd.slug, kind); } catch { return []; }
    },
  });
  // Clears the previous kind's selection the moment either input changes —
  // mirrors the old loadSlots()'s explicit setSel(null) on every reload.
  useEffect(() => setSel(null), [rd.slug, kind]);

  const razorpay = createRazorpayAdapter({ name: "Tanmatra", description: `Consult · ${rd.name}` });
  const pending = booked?.paymentStatus === "pending" ? booked : null;

  async function run() {
    if (busy || (!pending && !sel)) return;
    setBusy(true); setError(null);
    try {
      const appt = pending ?? (await bookAppointment({ rdSlug: rd.slug, kind, startAt: sel!.startAt, endAt: sel!.endAt }));
      setBooked(appt);
      if (appt.paymentStatus !== "free") setBooked(await payForAppointment(appt.id, razorpay));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setNeedsAuth(true);
      else if (e instanceof RazorpayDismissed) setError("Payment cancelled — your slot is held; tap Pay to finish.");
      else if (e instanceof ApiError && e.status === 409) { setError("That slot was just taken — pick another."); void reloadSlots(); }
      else setError(e instanceof ApiError ? e.message : "Couldn't complete that — please try again.");
    } finally { setBusy(false); }
  }

  if (!rd.bookable) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-5">
        <p className="font-display text-lg font-semibold leading-tight text-primary">Not currently accepting bookings</p>
        <p className="mt-2 text-sm leading-6 text-ink-muted">{rd.name} isn&rsquo;t taking new consults right now — check back soon.</p>
      </div>
    );
  }

  if (needsAuth) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-5">
        <p className="font-display text-lg font-semibold leading-tight text-primary">Sign in to book your consult</p>
        <p className="mb-4 mt-2 text-sm leading-6 text-ink-muted">We hold your slot the moment you&rsquo;re verified.</p>
        <PhoneAuth startExpanded onVerified={() => { setNeedsAuth(false); void run(); }} />
      </div>
    );
  }

  if (booked && booked.paymentStatus !== "pending") {
    return (
      <div className="rounded-2xl border border-line bg-sage-soft p-5">
        <p className="font-display text-lg font-semibold leading-tight text-ink">You&rsquo;re booked with {rd.name}.</p>
        <p className="font-data mt-2 text-sm text-ink-muted">{fmt(booked.startAt)} · {booked.paymentStatus === "free" ? "Free intro" : `Paid ${formatPaise(booked.pricePaise)}`}</p>
      </div>
    );
  }

  return (
    <div data-ui-generation="stitch-74" data-screen-id="11.6" data-screen-state="booking-active" className="rounded-2xl border border-line bg-surface p-5">
      <p className="font-display text-lg font-semibold leading-tight text-primary">Book a consult</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {KINDS.map((k) => {
          const on = k.kind === kind;
          const p = rd.pricing[k.priceKey];
          return (
            <button key={k.kind} type="button" aria-pressed={on} disabled={!!pending}
              onClick={() => { setKind(k.kind); setBooked(null); }}
              className={`inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-xs font-bold transition-colors disabled:opacity-40 ${on ? "border-gold bg-primary/10 text-primary" : "border-line text-ink-muted hover:border-line-strong hover:text-primary"}`}>
              {k.label} · {p === 0 ? "Free" : formatPaise(p)}
            </button>
          );
        })}
      </div>

      {!pending && (
        <div className="mt-5">
          <h3 className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted">Available times (IST)</h3>
          <div className="mt-3">
            {slots === undefined ? <p className="text-sm text-ink-muted">Loading slots…</p>
              : slots.length === 0 ? <p className="text-sm text-ink-muted">No open slots in the next two weeks — check back soon.</p>
              : (
                <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto">
                  {slots.slice(0, 24).map((s) => {
                    const on = sel?.startAt === s.startAt;
                    return (
                      <button key={s.startAt} type="button" aria-pressed={on} onClick={() => setSel(s)}
                        className={`font-data inline-flex min-h-10 items-center rounded-xl border px-3 py-1.5 text-2xs transition-colors ${on ? "border-gold bg-primary/10 text-primary" : "border-line text-ink-muted hover:border-line-strong hover:text-primary"}`}>
                        {fmt(s.startAt)}
                      </button>
                    );
                  })}
                </div>
              )}
          </div>
        </div>
      )}
      {pending && (
        <p className="font-data mt-5 rounded-xl bg-secondary px-4 py-3 text-xs text-ink-muted">
          Slot held: {fmt(pending.startAt)} — complete your payment to confirm.
        </p>
      )}

      {error && <p role="alert" className="mt-3 text-xs font-medium text-[var(--danger)]">{error}</p>}

      <Button type="button" onClick={() => void run()} disabled={busy || (!pending && !sel)}
        aria-busy={busy} aria-live="polite"
        shape="pill" size="fluid" className="mt-5 min-h-12 w-full px-5 text-sm font-bold disabled:opacity-40">
        {busy ? "Working…" : pending ? `Pay ${formatPaise(price)}` : price === 0 ? "Book free intro" : `Book & pay ${formatPaise(price)}`}
      </Button>
    </div>
  );
}
