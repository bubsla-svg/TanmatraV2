"use client";
// Client island: the paid-consult money path, hosted on /checkout. "use client"
// because the appointment is a session-gated read and the runner beneath owns
// the Razorpay modal.
import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/apiClient";
import { formatPaise } from "@/lib/format";
import { getMyAppointments } from "@/lib/rdBookingApi";
import { consultSteps } from "@/lib/purchaseSteps";
import { PhoneAuth } from "../PhoneAuth";
import { PurchaseRunner } from "../PurchaseRunner";
import { PurchaseSummary } from "./PurchaseSummary";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });

/**
 * Paying for a consult whose slot is ALREADY held. Booking stays on the RD's
 * page — it reserves time, not money — and the pay leg lands here, where it
 * gets the recovery the booking card never had (a verify blip there surfaced
 * as an ordinary error over a real charge).
 *
 * The appointment is re-read from the server rather than passed through the
 * URL: a query string is not evidence of what was booked, or of who booked it.
 */
export function ConsultPurchase({ appointmentId }: { appointmentId: number }) {
  const mine = useQuery({
    queryKey: ["rd", "appointments"],
    queryFn: () => getMyAppointments(),
  });
  const appointment = mine.data?.find((a) => a.id === appointmentId) ?? null;
  const steps = useMemo(
    () =>
      appointment
        ? consultSteps(appointment, `Pay ${formatPaise(appointment.pricePaise)}`)
        : null,
    [appointment],
  );

  if (mine.error instanceof ApiError && mine.error.status === 401) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
        <p className="text-sm text-ink-muted">Sign in to pay for your consult.</p>
        <PhoneAuth startExpanded onVerified={() => void mine.refetch()} />
      </div>
    );
  }

  if (mine.isPending) {
    return (
      <div aria-busy className="rounded-2xl border border-line bg-surface p-5">
        <p className="sr-only">Loading your consult…</p>
        <div aria-hidden className="h-24 animate-pulse rounded-lg bg-secondary" />
      </div>
    );
  }

  // No such appointment for this account — a stale link, or someone else's id.
  // Say so plainly; never invent a bookable slot from a query string.
  if (!appointment || !steps) {
    return (
      <PurchaseSummary title="We couldn't find that consult" lines={[]}>
        <p className="text-sm text-ink-muted">
          The booking may have expired, or it belongs to another account.{" "}
          <Link href="/rd" className="font-semibold text-primary hover:underline">
            Book a new consult
          </Link>
          .
        </p>
      </PurchaseSummary>
    );
  }

  if (appointment.paymentStatus !== "pending") {
    return (
      <PurchaseSummary
        title="This consult is already confirmed"
        lines={[{ label: when(appointment.startAt) }]}
      >
        <Link
          href="/account/appointments"
          className="text-sm font-semibold text-primary hover:underline"
        >
          See your consults
        </Link>
      </PurchaseSummary>
    );
  }

  return (
    <>
      <PurchaseSummary
        title="Confirm your consult"
        lines={[
          { label: when(appointment.startAt) },
          { label: "Consult fee", value: formatPaise(appointment.pricePaise) },
        ]}
        note="Your slot is held until you pay."
      />
      <PurchaseRunner
        steps={steps}
        description="Dietitian consult"
        amountPaise={appointment.pricePaise}
        kind="consult"
        authPrompt="Sign in to pay for your consult."
      />
    </>
  );
}
