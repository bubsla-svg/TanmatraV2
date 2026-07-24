/**
 * Corporate / partnership lead capture (Wave-3). The /corporate landing form
 * POSTs a prospect's details so leads land in the sales pipeline
 * (corporate_leads → AdminSalesConsole) instead of an off-platform WhatsApp
 * handoff. Public — no auth, no money; the server owns validation and a
 * conservative 5/hour per-IP limit. Kept out of lib/api.ts for the file cap.
 */
import { apiPost, type FetchImpl } from "./apiClient";

export type CorporateLeadKind = "corporate" | "gym" | "fitness_club";
export const TEAM_SIZE_BANDS = ["1-20", "21-100", "101-500", "500+"] as const;
export type TeamSizeBand = (typeof TEAM_SIZE_BANDS)[number];

export interface CorporateLeadInput {
  kind: CorporateLeadKind;
  name: string;
  workEmail: string;
  company: string;
  teamSizeBand: TeamSizeBand;
  parkOrSector?: string;
  phone?: string;
  message?: string;
  source?: string;
}

/** Submit a corporate/gym/club lead. 201 { ok: true } on success; the server
 *  surfaces a 400 (invalid payload) or 429 (rate-limited) as a typed ApiError
 *  the form maps to an inline message. */
export function submitCorporateLead(
  input: CorporateLeadInput,
  fetchImpl?: FetchImpl,
): Promise<{ ok: true }> {
  return apiPost("/corporate-leads", input, fetchImpl);
}
