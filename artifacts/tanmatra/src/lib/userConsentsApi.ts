import { API_BASE } from "./apiBase";
import type { DpdpaConsentState } from "@/components/DpdpaConsentCapture";

export interface UserConsentRecord {
  id: string;
  userId: string;
  purposeClinicalDelivery: boolean;
  purposeMarketing: boolean;
  purposeAiPersonalization: boolean;
  consentVersion: string;
  status: string;
  grantedAt: string | null;
  revokedAt: string | null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const userConsentsApi = {
  get: () => request<{ consent: UserConsentRecord | null }>("/user-consents"),
  update: (state: Partial<DpdpaConsentState> & { status?: string }) =>
    request<{ consent: UserConsentRecord }>("/user-consents", {
      method: "PUT",
      body: JSON.stringify(state),
    }),
};
