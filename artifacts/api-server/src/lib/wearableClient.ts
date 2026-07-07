import crypto from "node:crypto";
import type { Request } from "express";
import type { WearableMetricType } from "@workspace/db";

/**
 * Wearable (Terra/Vital-style cloud aggregator) INBOUND webhook client +
 * normalizer + sanitizer + rollup.
 *
 * Mirrors the Petpooja integration's shape exactly:
 *   - config gated entirely behind WEARABLE_* / TERRA_* env
 *   - inert when unconfigured (isWearableEnabled() === false)
 *   - never throws on bad input — returns typed results
 *   - unit-testable pure functions (no DB, no Express coupling here)
 *
 * SCOPE: ACTIVITY metrics only (steps, active energy, resting HR, sleep). The
 * normalizer + sanitizer are written to be glucose-ready for phase 2, but
 * glucose is NOT ingested here.
 */

// ── Config ──────────────────────────────────────────────────────────────────

export type WearableProviderName = "terra" | "vital" | "mock";

export interface WearableConfig {
  provider: WearableProviderName;
  // The aggregator developer/account id (Terra: dev-id; Vital: not required).
  devId: string | null;
  apiKey: string;
  // Shared secret used to verify inbound webhook HMAC signatures.
  signingSecret: string;
}

/**
 * Returns the fully-configured wearable config, or null if the minimum set of
 * env vars is absent. Provider-specific vars (TERRA_*) are accepted as well as
 * generic (WEARABLE_*) so either aggregator can be wired without code changes.
 *
 * Minimum to be "on":
 *   - WEARABLE_PROVIDER ∈ {terra, vital, mock}
 *   - an API key      (TERRA_API_KEY      | WEARABLE_API_KEY)
 *   - a signing secret(TERRA_SIGNING_SECRET | WEARABLE_SIGNING_SECRET)
 */
export function wearableConfig(): WearableConfig | null {
  const providerRaw = (process.env.WEARABLE_PROVIDER || "").trim().toLowerCase();
  if (
    providerRaw !== "terra" &&
    providerRaw !== "vital" &&
    providerRaw !== "mock"
  ) {
    return null;
  }
  const provider = providerRaw as WearableProviderName;

  const apiKey = (
    process.env.TERRA_API_KEY ||
    process.env.WEARABLE_API_KEY ||
    ""
  ).trim();
  const signingSecret = (
    process.env.TERRA_SIGNING_SECRET ||
    process.env.WEARABLE_SIGNING_SECRET ||
    ""
  ).trim();
  const devId = (process.env.TERRA_DEV_ID || "").trim() || null;

  if (!apiKey || !signingSecret) return null;

  return { provider, devId, apiKey, signingSecret };
}

export function isWearableEnabled(): boolean {
  return wearableConfig() !== null;
}

// ── Webhook signature verification ───────────────────────────────────────────

interface Logger {
  info?: (obj: unknown, msg?: string) => void;
  warn?: (obj: unknown, msg?: string) => void;
  error?: (obj: unknown, msg?: string) => void;
}

/**
 * Get the raw request body as a string for HMAC. Express with a JSON body
 * parser configured to keep `rawBody` (Buffer) gives byte-exact input; if it's
 * absent we fall back to a canonical JSON.stringify of req.body. Verifiers on
 * both sides must agree — tests exercise the rawBody path.
 */
function rawBodyString(req: Request): string {
  const raw = (req as unknown as { rawBody?: Buffer | string }).rawBody;
  if (Buffer.isBuffer(raw)) return raw.toString("utf8");
  if (typeof raw === "string") return raw;
  try {
    return JSON.stringify(req.body ?? {});
  } catch {
    return "";
  }
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  try {
    return crypto.timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

/**
 * Parse Terra's `terra-signature: t=<ts>,v1=<hex>` header into its parts.
 */
function parseTerraSignatureHeader(
  header: string,
): { t: string | null; v1: string | null } {
  let t: string | null = null;
  let v1: string | null = null;
  for (const part of header.split(",")) {
    const [k, v] = part.split("=");
    if (!k || v === undefined) continue;
    const key = k.trim();
    const val = v.trim();
    if (key === "t") t = val;
    else if (key === "v1") v1 = val;
  }
  return { t, v1 };
}

/**
 * Verify an inbound aggregator webhook signature. Never throws — returns a
 * boolean. Behaviour by provider:
 *
 *   - terra/vital: HMAC-SHA256 of the raw request body (Terra prefixes the
 *     signed payload with `<t>.` when a timestamp is present) keyed by the
 *     signing secret, compared against the `v1` value in `terra-signature`.
 *   - mock: accepts a shared-secret header (`x-wearable-secret`) equal to the
 *     signing secret — keeps route/integration tests simple without needing to
 *     hand-compute HMACs.
 *
 * Returns false when the integration is unconfigured (caller decides the
 * disabled-path behaviour; the webhook route no-ops when disabled).
 */
export function verifyWebhookSignature(
  req: Request,
  cfg: WearableConfig | null,
  log?: Logger,
): boolean {
  if (!cfg) return false;

  try {
    // Mock mode: shared-secret header, for tests / local dev.
    if (cfg.provider === "mock") {
      const presented = (req.get("x-wearable-secret") || "").trim();
      if (!presented) return false;
      return timingSafeEqualStr(presented, cfg.signingSecret);
    }

    // Terra/Vital: HMAC-SHA256 over the raw body.
    const header = (
      req.get("terra-signature") ||
      req.get("x-vital-signature") ||
      req.get("x-wearable-signature") ||
      ""
    ).trim();
    if (!header) {
      log?.warn?.({ path: req.path }, "wearable webhook missing signature header");
      return false;
    }

    const raw = rawBodyString(req);
    const { t, v1 } = parseTerraSignatureHeader(header);
    // A bare hex header (no t=/v1=) is treated as v1 for non-Terra providers.
    const expectedSig = v1 ?? (header.includes("=") ? null : header);
    if (!expectedSig) {
      log?.warn?.({ path: req.path }, "wearable webhook signature header unparseable");
      return false;
    }

    const signedPayload = t ? `${t}.${raw}` : raw;
    const computed = crypto
      .createHmac("sha256", cfg.signingSecret)
      .update(signedPayload, "utf8")
      .digest("hex");

    const ok = timingSafeEqualStr(computed, expectedSig.toLowerCase());
    if (!ok) log?.warn?.({ path: req.path }, "wearable webhook signature mismatch");
    return ok;
  } catch (err) {
    log?.error?.({ err }, "wearable webhook signature verify threw (treated as reject)");
    return false;
  }
}

/**
 * Compute the header a sender would attach, given a raw body + optional
 * timestamp. Exposed so tests (and a future outbound simulator) can produce a
 * valid `terra-signature` without duplicating the HMAC logic.
 */
export function signWebhookBody(
  rawBody: string,
  signingSecret: string,
  t?: string,
): string {
  const signedPayload = t ? `${t}.${rawBody}` : rawBody;
  const v1 = crypto
    .createHmac("sha256", signingSecret)
    .update(signedPayload, "utf8")
    .digest("hex");
  return t ? `t=${t},v1=${v1}` : `v1=${v1}`;
}

// ── Normalization ────────────────────────────────────────────────────────────

/** Flat, provider-agnostic metric produced by the normalizer. */
export interface NormalizedMetric {
  // The aggregator's user id — resolved to our internal userId by the route.
  providerUserId: string;
  provider: WearableProviderName;
  metricType: WearableMetricType;
  // Scaled integer value (see wearable.ts schema comment for units).
  value: number;
  unit: string;
  // ALWAYS a UTC instant. The normalizer guarantees this — never a naive/local
  // date. This addresses a known timezone bug class.
  recordedAt: Date;
  source: string;
  dedupeKey: string;
}

const UNIT_BY_TYPE: Record<WearableMetricType, string> = {
  steps: "count",
  active_energy_kcal: "kcal",
  resting_hr: "bpm",
  sleep_minutes: "min",
  // glucose_mgdl: "mg/dL",  // PHASE 2
};

/**
 * Parse any timestamp representation the aggregator might send into a UTC
 * instant. Accepts ISO-8601 strings (with or without offset — an offset like
 * `+05:30` IST or `+00:00`/`Z` WET is honoured and converted to the correct
 * UTC instant), epoch seconds, and epoch milliseconds. Returns null on garbage.
 *
 * TIMEZONE SAFETY: an ISO string WITHOUT an offset is interpreted as UTC (we
 * append `Z`) rather than as server-local time — naive local parsing is the
 * bug class this guards against.
 */
export function toUtcInstant(input: unknown): Date | null {
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }
  if (typeof input === "number" && isFinite(input)) {
    // Heuristic: 10-digit → seconds, 13-digit → ms.
    const ms = input < 1e12 ? input * 1000 : input;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof input === "string") {
    const s = input.trim();
    if (!s) return null;
    // Numeric string → epoch.
    if (/^\d+$/.test(s)) return toUtcInstant(Number(s));
    // Has explicit offset or trailing Z? Date parses it as a real instant.
    const hasZone = /[zZ]$/.test(s) || /[+-]\d{2}:?\d{2}$/.test(s);
    const normalized = hasZone ? s : `${s}Z`;
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function scaleInt(n: unknown): number | null {
  const v = typeof n === "string" ? Number(n) : n;
  if (typeof v !== "number" || !isFinite(v)) return null;
  return Math.round(v);
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function makeDedupeKey(
  provider: string,
  providerUserId: string,
  metricType: string,
  recordedAt: Date,
): string {
  // Deterministic + idempotent. Truncated to fit varchar(120).
  return `${provider}:${providerUserId}:${metricType}:${recordedAt.toISOString()}`.slice(
    0,
    120,
  );
}

// Terra-shaped payload we understand: { type, user:{user_id}, data:[ … ] }.
// The `data` entries are daily/activity summaries carrying the metrics we want.
interface TerraLikePayload {
  type?: string;
  user?: { user_id?: string; reference_id?: string; provider?: string };
  data?: unknown[];
}

/**
 * Extract our four activity metrics from one Terra "daily"/"activity" data
 * entry. Terra nests values under known keys; we read defensively and skip
 * anything missing. GLUCOSE would be added here in phase 2 (from the
 * `glucose_data` block) — intentionally omitted now.
 */
function extractTerraMetrics(
  entry: Record<string, unknown>,
): Array<{ metricType: WearableMetricType; value: number; when: unknown }> {
  const out: Array<{
    metricType: WearableMetricType;
    value: number;
    when: unknown;
  }> = [];

  const meta = (entry.metadata ?? {}) as Record<string, unknown>;
  // Terra daily summaries commonly key the day off metadata.end_time (or
  // start_time). Fall back to a top-level timestamp.
  const when =
    meta.end_time ?? meta.start_time ?? entry.timestamp ?? entry.date ?? null;

  const distance = (entry.distance_data ?? {}) as Record<string, unknown>;
  const steps = scaleInt(distance.steps);
  if (steps != null) out.push({ metricType: "steps", value: steps, when });

  const calories = (entry.calories_data ?? {}) as Record<string, unknown>;
  const active = scaleInt(
    calories.net_activity_calories ?? calories.total_burned_calories,
  );
  if (active != null)
    out.push({ metricType: "active_energy_kcal", value: active, when });

  const heart = (entry.heart_rate_data ?? {}) as Record<string, unknown>;
  const summary = (heart.summary ?? {}) as Record<string, unknown>;
  const restingHr = scaleInt(summary.resting_hr_bpm);
  if (restingHr != null)
    out.push({ metricType: "resting_hr", value: restingHr, when });

  // Sleep can arrive as a dedicated sleep summary or a duration field.
  const sleep = (entry.sleep_durations_data ?? {}) as Record<string, unknown>;
  const asleep = (sleep.asleep ?? {}) as Record<string, unknown>;
  const sleepSeconds = scaleInt(
    asleep.duration_asleep_state_seconds ?? entry.sleep_duration_seconds,
  );
  if (sleepSeconds != null)
    out.push({
      metricType: "sleep_minutes",
      value: Math.round(sleepSeconds / 60),
      when,
    });

  return out;
}

/**
 * Map a raw aggregator payload into NormalizedMetric[]. Never throws — returns
 * [] on anything it can't understand. userId resolution (providerUserId → our
 * internal id) happens later in the route.
 *
 * Handles Terra-shaped payloads today. Vital uses the same normalized field
 * names via Terra-compat mapping; unknown providers fall through to [].
 */
export function normalizeProviderPayload(
  raw: unknown,
  provider: WearableProviderName,
): NormalizedMetric[] {
  if (!raw || typeof raw !== "object") return [];
  const payload = raw as TerraLikePayload;

  const providerUserId =
    payload.user?.user_id || payload.user?.reference_id || "";
  if (!providerUserId) return [];
  if (!Array.isArray(payload.data)) return [];

  const sourceProvider = payload.user?.provider
    ? `${provider}:${String(payload.user.provider).toLowerCase()}`
    : provider;

  const out: NormalizedMetric[] = [];
  for (const entryRaw of payload.data) {
    if (!entryRaw || typeof entryRaw !== "object") continue;
    const extracted = extractTerraMetrics(entryRaw as Record<string, unknown>);
    for (const m of extracted) {
      const recordedAt = toUtcInstant(m.when);
      if (!recordedAt) continue; // never store a metric with an unknown instant
      out.push({
        providerUserId,
        provider,
        metricType: m.metricType,
        value: m.value,
        unit: UNIT_BY_TYPE[m.metricType],
        recordedAt,
        source: sourceProvider,
        dedupeKey: makeDedupeKey(
          provider,
          providerUserId,
          m.metricType,
          recordedAt,
        ),
      });
    }
  }
  return out;
}

// ── Sanitization ─────────────────────────────────────────────────────────────

/**
 * Hard physiological bounds per metric type (inclusive). Values outside these
 * are physically impossible and get FLAGGED (stored, excluded from rollup) —
 * never silently dropped. Glucose bounds are present for phase 2 but glucose is
 * not ingested now.
 */
export const METRIC_BOUNDS: Record<
  string,
  { min: number; max: number }
> = {
  steps: { min: 0, max: 100_000 }, // per day
  active_energy_kcal: { min: 0, max: 10_000 }, // per day
  resting_hr: { min: 25, max: 220 }, // bpm
  sleep_minutes: { min: 0, max: 1_440 }, // 24h
  glucose_mgdl: { min: 20, max: 600 }, // PHASE 2 — mg/dL (bounds ready, NOT ingested now)
};

// Metric types accepted for INGESTION right now. `glucose_mgdl` is deliberately
// absent: its bounds live in METRIC_BOUNDS (phase-2 ready) but a glucose metric
// is flagged (never counted) in increment 1.
const SUPPORTED_METRIC_TYPES: ReadonlySet<string> = new Set([
  "steps",
  "active_energy_kcal",
  "resting_hr",
  "sleep_minutes",
]);

export interface SanitizeResult {
  ok: boolean;
  flagged: boolean;
  reason: string | null;
}

/**
 * Rolling baseline for the optional Z-score / sudden-jump check. Callers pass a
 * recent mean+stddev for the same metric; a value many standard deviations away
 * is flagged as an impossible jump even if within hard bounds.
 */
export interface MetricBaseline {
  mean: number;
  stdDev: number;
  // Flag when |value - mean| > zThreshold * stdDev. Default 6 (very lenient —
  // only catches truly wild jumps, not normal day-to-day variation).
  zThreshold?: number;
}

/**
 * Validate one metric. Never throws.
 *   - ok=true, flagged=false → clean, include in rollup
 *   - ok=false, flagged=true → out of bounds or impossible jump; STORE with
 *     flagged=true, EXCLUDE from rollup
 */
export function sanitizeMetric(
  metric: Pick<NormalizedMetric, "metricType" | "value">,
  recentBaseline?: MetricBaseline,
): SanitizeResult {
  const { metricType, value } = metric;

  if (typeof value !== "number" || !isFinite(value)) {
    return { ok: false, flagged: true, reason: "value is not a finite number" };
  }

  if (!SUPPORTED_METRIC_TYPES.has(metricType)) {
    // Unknown OR not-yet-ingested type (e.g. glucose in increment 1). Flag so it
    // is never counted, but keep the record for auditing.
    return {
      ok: false,
      flagged: true,
      reason: `metric type "${metricType}" is not ingested in this increment`,
    };
  }

  const bounds = METRIC_BOUNDS[metricType];
  if (!bounds) {
    return {
      ok: false,
      flagged: true,
      reason: `no bounds defined for metric type "${metricType}"`,
    };
  }

  if (value < bounds.min || value > bounds.max) {
    return {
      ok: false,
      flagged: true,
      reason: `${metricType}=${value} out of bounds [${bounds.min}, ${bounds.max}]`,
    };
  }

  // Optional rolling / Z-score check for sudden impossible jumps.
  if (recentBaseline && recentBaseline.stdDev > 0) {
    const z = Math.abs(value - recentBaseline.mean) / recentBaseline.stdDev;
    const threshold = recentBaseline.zThreshold ?? 6;
    if (z > threshold) {
      return {
        ok: false,
        flagged: true,
        reason: `${metricType}=${value} is a ${z.toFixed(1)}σ jump vs baseline (mean=${recentBaseline.mean})`,
      };
    }
  }

  return { ok: true, flagged: false, reason: null };
}

// ── Rollup ───────────────────────────────────────────────────────────────────

export interface DailyRollup {
  day: string; // YYYY-MM-DD (UTC)
  provider: string;
  activeEnergyKcal: number;
  steps: number;
  restingHr: number | null; // average
  sleepMinutes: number;
}

type RollupInput = Pick<
  NormalizedMetric,
  "metricType" | "value" | "recordedAt" | "provider"
> & { flagged?: boolean };

/**
 * Aggregate one day's metrics into the daily rollup shape.
 *   - steps / active_energy / sleep → summed
 *   - resting_hr → averaged
 * Dedupes by (metricType, recordedAt instant) so a re-delivered webhook can't
 * double-count. FLAGGED metrics are excluded (defensive — the route excludes
 * them too, but callers may pass a mixed set).
 *
 * Returns null when there are no usable metrics.
 */
export function rollupForDay(metrics: RollupInput[]): DailyRollup | null {
  const clean = metrics.filter((m) => !m.flagged);
  if (clean.length === 0) return null;

  // Dedupe by metricType + exact instant.
  const seen = new Set<string>();
  const deduped: RollupInput[] = [];
  for (const m of clean) {
    const key = `${m.metricType}:${m.recordedAt.toISOString()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(m);
  }

  let steps = 0;
  let activeEnergyKcal = 0;
  let sleepMinutes = 0;
  let hrSum = 0;
  let hrCount = 0;
  let provider = deduped[0]!.provider as string;
  const day = dayKey(deduped[0]!.recordedAt);

  for (const m of deduped) {
    provider = m.provider as string;
    switch (m.metricType) {
      case "steps":
        steps += m.value;
        break;
      case "active_energy_kcal":
        activeEnergyKcal += m.value;
        break;
      case "sleep_minutes":
        sleepMinutes += m.value;
        break;
      case "resting_hr":
        hrSum += m.value;
        hrCount += 1;
        break;
      default:
        break;
    }
  }

  return {
    day,
    provider,
    activeEnergyKcal,
    steps,
    restingHr: hrCount > 0 ? Math.round(hrSum / hrCount) : null,
    sleepMinutes,
  };
}

/** Group normalized metrics by their UTC calendar day (YYYY-MM-DD). */
export function groupMetricsByDay<T extends { recordedAt: Date }>(
  metrics: T[],
): Map<string, T[]> {
  const byDay = new Map<string, T[]>();
  for (const m of metrics) {
    const key = dayKey(m.recordedAt);
    const arr = byDay.get(key);
    if (arr) arr.push(m);
    else byDay.set(key, [m]);
  }
  return byDay;
}
