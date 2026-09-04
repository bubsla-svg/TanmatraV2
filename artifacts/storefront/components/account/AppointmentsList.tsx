"use client";
// Client: loads the signed-in user's RD consultation schedule against live API.
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ApiError } from "@/lib/apiClient";
import { getMyAppointments } from "@/lib/rdBookingApi";
import { formatPaise } from "@/lib/format";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";

function formatApptTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AppointmentsList() {
  const { data: appts, isPending, isError, error, refetch } = useQuery({
    queryKey: ["account", "appointments"],
    queryFn: () => getMyAppointments(),
  });

  if (isError) {
    if (error instanceof ApiError && error.status === 401) {
      return (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-muted">Sign in to view your consultation appointments.</p>
          <PhoneAuth startExpanded onVerified={() => void refetch()} />
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-line bg-surface p-5 text-center">
        <p className="text-sm font-semibold text-[var(--danger)]">
          {error instanceof ApiError ? error.message : "Couldn't load consultations."}
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-4 min-h-11 rounded-full border border-line-strong bg-surface px-4 text-sm font-bold text-ink"
        >
          Try again
        </button>
      </div>
    );
  }

  if (isPending) {
    return <p className="text-sm text-ink-muted">Loading your consultation schedule…</p>;
  }

  if (appts.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        No consultations booked yet.{" "}
        <Link href="/rd" className="font-semibold text-primary underline-offset-4 hover:underline">
          Browse Registered Dietitians
        </Link>
        .
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {appts.map((a) => (
        <li key={a.id} className="flex flex-col gap-1.5 rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted">
              {a.kind.replace(/_/g, " ")}
            </span>
            <span className="rounded-full bg-sage-soft px-2.5 py-0.5 text-xs font-medium text-sage-text">
              {a.status}
            </span>
          </div>
          <p className="font-data text-sm font-bold text-primary">
            {formatApptTime(a.startAt)} &mdash; {new Date(a.endAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
          </p>
          <div className="mt-1 flex items-center justify-between border-t border-line pt-2.5">
            <span className="text-xs text-ink-muted">
              Dietitian Specialist: {a.rdSlug.replace("rd-", "").replace(/-/g, " ")}
            </span>
            {a.pricePaise === 0 ? (
              <span className="inline-flex items-center rounded-full border border-gold bg-primary/10 px-2.5 py-0.5 text-3xs font-bold uppercase tracking-wide text-primary">
                Free Intro
              </span>
            ) : (
              <span className="font-data text-sm font-bold text-primary">{formatPaise(a.pricePaise)}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
