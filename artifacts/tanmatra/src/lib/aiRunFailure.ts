/**
 * Turns a raw AI-gateway failure string into something an operator can act on.
 *
 * `/admin/ai-runs` previously rendered a red "error" badge and nothing else, so
 * the console could show every agent failing — ops, coach, support, reorder,
 * all at 0 tokens — while giving no way to tell "the API key is rejected" from
 * "we are rate-limited" from "this one prompt tripped a safety filter". Those
 * have completely different responses: rotate a secret, wait/raise quota, or
 * fix a prompt. The raw provider message distinguishes them and is now
 * returned by GET /ai/runs, so the only thing missing was reading it.
 *
 * Classification is best-effort and additive: the raw message is ALWAYS shown
 * alongside whatever this returns, so a miss here degrades to "operator reads
 * the provider's own words", never to a wrong answer stated confidently.
 */
export type AiFailureKind =
  | "auth"
  | "quota"
  | "model"
  | "timeout"
  | "safety"
  | "upstream"
  | "unknown";

export interface AiFailureSummary {
  kind: AiFailureKind;
  /** One line naming the failure in operator terms. */
  label: string;
  /** What to do about it. Empty when we genuinely don't know. */
  hint: string;
}

const UNKNOWN: AiFailureSummary = {
  kind: "unknown",
  label: "Agent run failed",
  hint: "",
};

/**
 * Order matters: the checks run top-down and the first match wins, so the
 * narrower signals (an explicit API-key rejection) sit above the broader ones
 * (any 4xx from the provider).
 */
const RULES: Array<{ kind: AiFailureKind; re: RegExp; label: string; hint: string }> = [
  {
    kind: "auth",
    re: /api[\s_-]?key|api_key_invalid|unauthenticated|permission[\s_-]?denied|\b401\b|\b403\b/i,
    label: "Provider rejected our credentials",
    hint:
      "GOOGLE_API_KEY on the api-server is missing, expired, or lacks access to the Generative Language API. Rotate it and redeploy — every agent fails until it is fixed.",
  },
  {
    kind: "quota",
    re: /quota|rate[\s_-]?limit|resource[\s_-]?exhausted|too many requests|\b429\b/i,
    label: "Provider quota or rate limit hit",
    hint:
      "Requests are being throttled upstream. Check the project's quota for the model below; the gateway already retries with backoff, so sustained failures mean the ceiling, not a blip.",
  },
  {
    kind: "model",
    re: /model.*(not found|not supported|does not exist)|no such model|\b404\b/i,
    label: "Model unavailable",
    hint:
      "The model id below was refused by the provider — usually a retired or renamed model. Update DEFAULT_MODEL_ID in api-server lib/ai/model.ts, or the agent's own defaultModel.",
  },
  {
    kind: "timeout",
    re: /timeout|timed out|abort|deadline/i,
    label: "Timed out before the model replied",
    hint:
      "The gateway aborts an attempt at 30s. A few of these are normal under load; a run of them points at upstream latency.",
  },
  {
    kind: "safety",
    re: /safety|blocked|content[\s_-]?filter|recitation|prohibited/i,
    label: "Blocked by a content filter",
    hint:
      "The provider refused this specific exchange. This is prompt-shaped, not infrastructure — inspect the input on this run rather than the deployment.",
  },
  {
    kind: "upstream",
    re: /\b5\d{2}\b|internal error|unavailable|bad gateway|overloaded/i,
    label: "Provider-side error",
    hint:
      "Upstream returned a server error. Transient by nature — if it persists across several minutes check the provider's status page.",
  },
];

/**
 * Classify a stored `ai_runs.error`. Returns a generic summary for an empty or
 * unrecognised message rather than guessing.
 */
export function summariseAiFailure(
  error: string | null | undefined,
): AiFailureSummary {
  if (!error || !error.trim()) return UNKNOWN;
  for (const rule of RULES) {
    if (rule.re.test(error)) {
      return { kind: rule.kind, label: rule.label, hint: rule.hint };
    }
  }
  return UNKNOWN;
}

/**
 * True when a whole page of runs is failing the same way — the signal that
 * this is a deployment/config problem rather than one bad request. Worth
 * calling out at the top of the console, because that is the case where an
 * operator is otherwise left scrolling a list of identical red badges.
 */
export function dominantFailure(
  rows: Array<{ status: string; error?: string | null }>,
): { summary: AiFailureSummary; failed: number; total: number } | null {
  const total = rows.length;
  if (total === 0) return null;
  const failed = rows.filter((r) => r.status === "error");
  // Two thresholds, deliberately: a single failure is noise, and a minority of
  // failures is normal operation. A majority is an outage.
  if (failed.length < 2 || failed.length * 2 <= total) return null;

  const counts = new Map<AiFailureKind, { n: number; summary: AiFailureSummary }>();
  for (const row of failed) {
    const summary = summariseAiFailure(row.error);
    const entry = counts.get(summary.kind);
    if (entry) entry.n += 1;
    else counts.set(summary.kind, { n: 1, summary });
  }

  let best: { n: number; summary: AiFailureSummary } | null = null;
  for (const entry of counts.values()) {
    if (!best || entry.n > best.n) best = entry;
  }
  // An "unknown" plurality tells the operator nothing they can act on, and
  // claiming a shared cause we cannot name would be worse than staying quiet.
  if (!best || best.summary.kind === "unknown") return null;
  return { summary: best.summary, failed: failed.length, total };
}
