/**
 * Scan resolution + logging, called SERVER-SIDE from `app/q/[src]/route.ts`.
 *
 * One round trip does both halves of a scan: it resolves the printed code to a
 * destination (so a poster can be repointed without a reprint) and writes the
 * `qr_scans` row that is the denominator of every placement's scans-to-paid
 * number. Both are the api-server's job — the destination table and the scan
 * log live there.
 *
 * THIS FUNCTION NEVER THROWS AND NEVER REJECTS. A scan is a person standing in
 * front of a poster with their phone out; if the API is down, the correct
 * outcome is the generic landing (which sells the same offer), not an error
 * page. Losing the attribution row is a reporting cost. Losing the visit is a
 * customer.
 *
 * NO "@/" ALIAS IMPORTS (storefront lib rule).
 */
import { GENERIC_LANDING, normalizeQrCode } from "./qrPlacement";

export interface ScanResolution {
  /** The resolved placement code, or null when nothing matched. */
  src: string | null;
  /** False for a misprint, a typo, or a placement retired while posters are
   *  still on walls — all of which still get a landing, never a 404. */
  known: boolean;
  /** App-relative path to send the scanner to. */
  destination: string;
}

export interface ScanInput {
  code: string;
  ref?: string | null;
  /** The visit id the funnel's later steps will carry, so scan → pincode →
   *  phone → paid is one joinable row set rather than four unrelated counts. */
  sessionId?: string | null;
}

/** Bounded so a slow or hanging api-server cannot hold the redirect open. A
 *  scanner staring at a spinner is a lost scan; 2s then fall through. */
const SCAN_TIMEOUT_MS = 2000;

export async function resolveScan(
  input: ScanInput,
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ScanResolution> {
  const fallback: ScanResolution = {
    src: normalizeQrCode(input.code),
    known: false,
    destination: GENERIC_LANDING,
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${baseUrl}/api/qr/scan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({
        code: input.code,
        ...(input.ref ? { ref: input.ref } : {}),
        ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      }),
    });
    if (!res.ok) return fallback;
    const body = (await res.json()) as Partial<ScanResolution>;
    return {
      // The server's answer wins for `src` when it gave one, because it is the
      // value it actually wrote to the scan row — a disagreement here would
      // split one placement across two rows in the scoreboard.
      src: typeof body.src === "string" ? body.src : fallback.src,
      known: body.known === true,
      destination:
        typeof body.destination === "string" && body.destination
          ? body.destination
          : GENERIC_LANDING,
    };
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
