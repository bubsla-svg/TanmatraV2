/**
 * RD consult booking client (route-parity Wave D, money path). Consumes the
 * api-server RD endpoints from the client via the same-origin `/api` proxy with
 * the session cookie (`credentials:"include"`, in apiClient):
 *   GET  /rd/slots            — public: server-generated open slots
 *   POST /rd/appointments     — AUTH: books; server owns the price + validation
 *   POST /rd/appointments/:id/checkout — opens a Razorpay order (server amount)
 *   POST /rd/appointments/:id/verify   — HMAC-verifies the payment → paid
 *
 * MONEY: the client NEVER authors a price. Booking is server-priced; the free
 * 15-min intro settles at booking (paymentStatus "free"); paid consults stay
 * "pending" until /verify. checkout + verify ship on the `583df88`
 * (rd-appointment-order) api-server branch — the free-intro path works on main;
 * the paid path requires that branch deployed.
 */
import { apiGet, apiPost, type FetchImpl } from "./apiClient";
import type { RazorpayAdapter } from "./moneyPath";

export type SessionKind = "intro_15m" | "follow_up_30m" | "follow_up_45m";

export interface Slot {
  startAt: string;
  endAt: string;
}

export interface Appointment {
  id: number;
  rdSlug: string;
  kind: string;
  startAt: string;
  endAt: string;
  pricePaise: number;
  paymentStatus: "free" | "pending" | "paid";
  status: string;
}

/** Server response from /checkout — the exact shape RazorpayAdapter.open() takes. */
export interface CheckoutOrder {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export interface BookInput {
  rdSlug: string;
  kind: SessionKind;
  startAt: string;
  endAt: string;
  userQuestion?: string;
}

/** Open slots for an RD + session kind (public). [] on any failure. */
export async function getSlots(
  rdSlug: string,
  kind: SessionKind,
  fetchImpl?: FetchImpl,
): Promise<Slot[]> {
  const q = `?rdSlug=${encodeURIComponent(rdSlug)}&kind=${kind}`;
  const data = await apiGet<{ slots?: Slot[] }>(`/rd/slots${q}`, fetchImpl);
  return data.slots ?? [];
}

/** Book a consult (auth). Throws ApiError (401 → sign in; 409 → slot taken). */
export async function bookAppointment(input: BookInput, fetchImpl?: FetchImpl): Promise<Appointment> {
  const data = await apiPost<{ appointment: Appointment }>("/rd/appointments", input, fetchImpl);
  return data.appointment;
}

/** Open a Razorpay order for a pending paid appointment (server amount). */
export function checkoutAppointment(id: number, fetchImpl?: FetchImpl): Promise<CheckoutOrder> {
  return apiPost<CheckoutOrder>(`/rd/appointments/${id}/checkout`, {}, fetchImpl);
}

/** Verify a completed Razorpay payment → flips the appointment to paid. */
export async function verifyAppointment(
  id: number,
  payment: { razorpayPaymentId: string; razorpayOrderId: string; razorpaySignature: string },
  fetchImpl?: FetchImpl,
): Promise<Appointment> {
  const data = await apiPost<{ appointment: Appointment }>(`/rd/appointments/${id}/verify`, payment, fetchImpl);
  return data.appointment;
}

/**
 * The PAID flow, in the verified order: server order → Razorpay modal → server
 * verify. `razorpay` is injectable so the sequence is testable with a fake and
 * no real gateway. Returns the verified (paid) appointment.
 */
export async function payForAppointment(
  id: number,
  razorpay: RazorpayAdapter,
  fetchImpl?: FetchImpl,
): Promise<Appointment> {
  const order = await checkoutAppointment(id, fetchImpl);
  const paid = await razorpay.open(order);
  return verifyAppointment(id, paid, fetchImpl);
}

/** Fetch all RD appointments for the authenticated user. Throws ApiError on
 *  failure (401 → sign in) — callers branch on it, most recently
 *  AppointmentsList.tsx's 401→PhoneAuth / else→error-with-retry split. */
export async function getMyAppointments(fetchImpl?: FetchImpl): Promise<Appointment[]> {
  const data = await apiGet<{ appointments?: Appointment[] }>("/rd/appointments", fetchImpl);
  return data.appointments ?? [];
}

export interface ExtractedBiomarker {
  name: string;
  value: number | string;
  unit: string;
  referenceRange?: string;
  isAbnormal: boolean;
  category?: string;
}

export interface PatientBiomarkerRecord {
  id: number;
  reportName: string;
  biomarkers: ExtractedBiomarker[];
  summary: string;
  flaggedCount: number;
  createdAt: string;
}

export async function uploadBloodReportOcr(
  fileName: string,
  rawContent: string = "",
  appointmentId?: number,
  fetchImpl?: FetchImpl
): Promise<{ biomarkerRecord: PatientBiomarkerRecord }> {
  return apiPost("/rd/labs/ocr", { fileName, rawContent, appointmentId }, fetchImpl);
}

export async function getPatientBiomarkers(fetchImpl?: FetchImpl): Promise<PatientBiomarkerRecord[]> {
  try {
    const data = await apiGet<{ biomarkers?: PatientBiomarkerRecord[] }>("/rd/labs/biomarkers", fetchImpl);
    return data.biomarkers ?? [];
  } catch {
    return [];
  }
}

