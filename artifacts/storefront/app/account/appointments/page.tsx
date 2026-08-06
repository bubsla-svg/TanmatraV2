import type { Metadata } from "next";
import { AccountNav } from "@/components/account/AccountNav";
import { AppointmentsList } from "@/components/account/AppointmentsList";

export const metadata: Metadata = {
  title: "Your consultations",
  robots: { index: false },
};

/**
 * Account → Consultations (Route Parity healing for legacy /appointments and /checkout-appointment).
 * RSC shell hosting the session-gated consultation list against /api/rd/appointments.
 */
export default function AppointmentsPage() {
  return (
    <section className="mx-auto max-w-md px-4 py-10">
      <AccountNav active="appointments" />
      <h1 className="text-lg font-semibold text-ink">Your consultations</h1>
      <p className="mt-1 mb-5 text-sm text-ink-muted">
        Your scheduled advisory video sessions and chat consultations with Registered Dietitians.
      </p>
      <AppointmentsList />
    </section>
  );
}
