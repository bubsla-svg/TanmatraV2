"use client";
// Client: loads the signed-in user's RD consultation schedule against live API.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/apiClient";
import { getMyAppointments, type Appointment } from "@/lib/rdBookingApi";
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
  const [appts, setAppts] = useState<Appointment[] | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const rows = await getMyAppointments();
      setAppts(rows);
      setNeedsAuth(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setNeedsAuth(true);
      else setError(e instanceof ApiError ? e.message : "Couldn't load consultations.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (needsAuth) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">Sign in to view your consultation appointments.</p>
        <PhoneAuth onVerified={() => void load()} />
      </div>
    );
  }

  if (appts === null) {
    return <p className="text-sm text-ink-muted">{error ?? "Loading your consultation schedule…"}</p>;
  }

  if (appts.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        No consultations booked yet.{" "}
        <Link href="/rd" className="font-medium text-gold-text hover:underline">
          Browse Registered Dietitians
        </Link>
        .
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {appts.map((a) => (
        <li key={a.id} className="rounded-xl border border-line bg-surface p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-ink capitalize">
              {a.kind.replace(/_/g, " ")}
            </span>
            <span className="rounded-full bg-sage-100 px-2.5 py-0.5 text-xs font-medium text-sage-800">
              {a.status}
            </span>
          </div>
          <p className="text-sm text-ink-muted">
            {formatApptTime(a.startAt)} &mdash; {new Date(a.endAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
          </p>
          <div className="flex items-center justify-between border-t border-line pt-2 mt-1 text-xs text-ink-muted">
            <span>Dietitian Specialist: {a.rdSlug.replace("rd-", "").replace(/-/g, " ")}</span>
            <span className="font-medium text-ink">
              {a.pricePaise === 0 ? "Free Intro" : formatPaise(a.pricePaise)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
