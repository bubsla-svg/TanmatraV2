import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { rdAdvisoryApi } from "@/lib/rdAdvisoryApi";
import {
  APPOINTMENT_KIND_META,
  formatRupees,
  type AppointmentKind,
} from "@/lib/rdBookingData";

/* Full-parity re-port of the System-A CheckoutAppointment (git 2507084) into v2.
 * The payment handler, API call (rdAdvisoryApi.book), paymentStatus branching,
 * redirect and error/auth handling are preserved VERBATIM — only the chrome
 * is restyled to the .tnm2 dark design. */

interface BookingState {
  rdSlug: string;
  kind: AppointmentKind;
  startAt: string;
  endAt: string;
  pricePaise: number;
  userQuestion?: string;
  rdName?: string;
}

function fmtSlot(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function V2CheckoutAppointment() {
  const navigate = useNavigate();
  const location = useLocation();
  const booking = location.state as BookingState | null;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  if (!booking || !booking.rdSlug) {
    return (
      <div className="tnm2 nn min-h-screen bg-[var(--tnm-surface-ink)] text-white antialiased">
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div className="appbar">
            <button className="iconbtn" onClick={() => navigate("/rd")}><i className="ph-bold ph-arrow-left" /></button>
            <div className="abt">Confirm & pay</div>
          </div>
          <div className="padx tc" style={{ paddingTop: 60 }}>
            <div className="avatar big" style={{ margin: "0 auto" }}><i className="ph-bold ph-calendar-x" /></div>
            <div className="tt mt20">No booking in progress</div>
            <div className="fine mt6">Start a booking from an RD's profile to review and pay for a consultation.</div>
            <button className="btn btn-p btn-blk mt20" onClick={() => navigate("/rd")}><i className="ph-bold ph-users-three" /> Back to RDs</button>
          </div>
        </div>
      </div>
    );
  }

  const meta = APPOINTMENT_KIND_META[booking.kind];

  async function pay() {
    if (!booking) return;
    setLastError(null);
    setProcessing(true);
    // Mock payment processing UI delay — same pattern as the meal
    // checkout flow. The actual payment is settled server-side via the
    // HMAC-signed internal webhook when /rd/appointments resolves.
    await new Promise((r) => setTimeout(r, 1200));
    try {
      const { appointment } = await rdAdvisoryApi.book({
        rdSlug: booking.rdSlug,
        kind: booking.kind,
        startAt: booking.startAt,
        endAt: booking.endAt,
        userQuestion: booking.userQuestion,
      });
      setConfirmOpen(false);
      if (appointment.paymentStatus === "paid") {
        toast.success("Payment received", {
          description: `${meta.label} confirmed with ${booking.rdName ?? "your RD"}.`,
        });
      } else if (appointment.paymentStatus === "pending") {
        toast.error("Booking held — payment not configured", {
          description:
            "Server's payment processor is not set up. Booking saved as pending.",
        });
      } else {
        toast.success("Booking confirmed");
      }
      navigate("/appointments");
    } catch (e) {
      const msg = String(e);
      if (msg.includes("409")) {
        toast.error("Slot just taken", {
          description: "Please pick another time.",
        });
        navigate(`/rd/${booking.rdSlug}`);
      } else if (msg.includes("401")) {
        toast.error("Sign in to confirm", {
          description: "Please sign in to complete your booking.",
          action: {
            label: "Sign in",
            onClick: () =>
              navigate(
                `/login?next=${encodeURIComponent(
                  window.location.pathname + window.location.search,
                )}`,
              ),
          },
        });
        setLastError("Sign-in required to complete this booking.");
      } else {
        toast.error("Could not book", { description: msg });
        setLastError(msg);
      }
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="tnm2 nn min-h-screen bg-[var(--tnm-surface-ink)] text-white antialiased">
      <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div className="appbar">
          <button className="iconbtn" onClick={() => navigate(-1)}><i className="ph-bold ph-arrow-left" /></button>
          <div className="abt">Review your booking</div>
          <span className="pill sg"><i className="ph-bold ph-lock-simple" /> Confirm & pay</span>
        </div>

        <div className="content padx" style={{ paddingTop: 4, paddingBottom: 120 }}>
          <div className="fine mb10">Reusing the same secure checkout as your meal orders. Your RD confirms and shares a join link in your appointments.</div>

          {/* Session / RD / When summary */}
          <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4 mb10">
            <div className="lab mb10"><i className="ph-bold ph-calendar-check" /> Session</div>
            <div className="tt">{meta.label}</div>
            <div className="fine mt4">{meta.description}</div>

            <div className="billrow" style={{ borderTop: "1px solid var(--ln)", marginTop: 12, paddingTop: 12 }}>
              <span><i className="ph-bold ph-user-circle" /> With</span>
              <span style={{ color: "var(--tx)", fontWeight: 500 }}>{booking.rdName ?? booking.rdSlug}</span>
            </div>
            <div className="billrow">
              <span><i className="ph-bold ph-clock" /> When</span>
              <span style={{ color: "var(--tx)", fontWeight: 500 }}>{fmtSlot(booking.startAt)}</span>
            </div>

            {booking.userQuestion ? (
              <div className="note mt10" style={{ background: "var(--s2)", borderColor: "var(--ln2)", color: "var(--mut)" }}>
                <i className="ph-bold ph-note-pencil" />
                <div>
                  <div className="lab mb4">Note for RD</div>
                  <div style={{ whiteSpace: "pre-line", color: "var(--tx)" }}>{booking.userQuestion}</div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Price breakdown */}
          <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4">
            <div className="lab mb10"><i className="ph-bold ph-receipt" /> Payment</div>
            <div className="billrow"><span>Session fee</span><span className="mono" style={{ color: "var(--tx)" }}>{formatRupees(booking.pricePaise)}</span></div>
            <div className="billrow tot"><span>Total to pay</span><span className="price" style={{ fontSize: 17, color: "var(--safb)" }}>{formatRupees(booking.pricePaise)}</span></div>
            <div className="note mt10">
              <i className="ph-fill ph-shield-check" />
              <span>Payment settled server-side via signed webhook.</span>
            </div>
          </div>

          {/* Failure recovery block */}
          {lastError && (
            <div className="note mt10" style={{ background: "color-mix(in srgb, var(--color-nn-error) 12%, transparent)", borderColor: "color-mix(in srgb, var(--color-nn-error) 35%, transparent)", color: "var(--color-nn-error)" }} role="alert">
              <i className="ph-fill ph-warning-circle" />
              <div>
                <div style={{ fontWeight: 600 }}>Booking didn't go through</div>
                <div className="mt2">{lastError}</div>
                <div className="fx ac gap8 wrap mt10">
                  <button
                    className="btn btn-p"
                    style={{ height: 36, fontSize: 13 }}
                    onClick={() => { setLastError(null); setConfirmOpen(true); }}
                  >
                    Retry payment
                  </button>
                  <a
                    className="btn btn-g"
                    style={{ height: 36, fontSize: 13 }}
                    href="mailto:care@tanmatra.health?subject=RD%20appointment%20booking%20issue"
                  >
                    Contact support
                  </a>
                </div>
              </div>
            </div>
          )}

          <div className="fine tc mt10"><i className="ph-bold ph-lock-simple" /> Secured payment · SSL encrypted</div>
        </div>

        {/* Sticky checkout dock */}
        <div className="dock bg-[var(--tnm-surface-ink)] border-t border-white/[0.08]">
          <div className="fx ac jb gap12">
            <div style={{ flex: "none" }}>
              <div className="lab">Total to pay</div>
              <div className="price" style={{ fontSize: 19, color: "var(--safb)" }}>{formatRupees(booking.pricePaise)}</div>
            </div>
            <button className="btn btn-p btn-lg" onClick={() => setConfirmOpen(true)}>
              <i className="ph-bold ph-credit-card" /> Confirm and pay
            </button>
          </div>
        </div>
      </div>

      {/* Confirm-payment modal (v2 bottom-sheet) */}
      {confirmOpen && (
        <div
          className="tnm2 nn fx bg-[color-mix(in srgb,var(--tnm-surface-ink)_95%,transparent)] backdrop-blur-md"
          style={{ position: "fixed", inset: 0, zIndex: 90, alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => { if (!processing) setConfirmOpen(false); }}
        >
          <div
            className="rounded-t-2xl bg-[var(--tnm-surface-ink-2)] border-x border-t border-white/[0.08] shadow-[0_-8px_32px_color-mix(in_srgb,black_40%,transparent)] p-5"
            style={{ width: "100%", maxWidth: 480, animation: "scr 220ms var(--e)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tt"><i className="ph-bold ph-credit-card" /> Confirm payment</div>
            <div className="fine mt6">
              You're paying <span style={{ color: "var(--safb)", fontWeight: 600 }}>{formatRupees(booking.pricePaise)}</span> for {meta.label} with {booking.rdName ?? "your RD"} on {fmtSlot(booking.startAt)}.
            </div>
            <div className="fx ac gap12 mt20">
              <button className="btn btn-g f1" onClick={() => setConfirmOpen(false)} disabled={processing}>Cancel</button>
              <button className={processing ? "btn btn-p f1 dis" : "btn btn-p f1"} onClick={pay} disabled={processing}>
                {processing ? "Processing…" : "Pay now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
