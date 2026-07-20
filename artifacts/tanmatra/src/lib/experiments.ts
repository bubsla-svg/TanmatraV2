// Config-driven experiment bucketing — Playbook Part 8 activation item A6.
// Fills the `experiment_assignments` map that every analytics event already
// carries (previously always empty per CRO Amendment A6). No remote service:
// assignment is deterministic per device, persisted so a config edit never
// reshuffles an already-bucketed visitor, and empty until an experiment is
// explicitly enabled — shipping this module changes no user-visible behavior.

interface ExperimentConfig {
  /** Variant keys; the first entry is the control. */
  variants: readonly string[];
  /** Relative weights, same length as variants. Defaults to uniform. */
  weights?: readonly number[];
  /** Disabled experiments assign nothing and emit nothing. */
  enabled: boolean;
}

// Register experiments here. Keep entries disabled until the copy/design
// variants are approved for exposure (Playbook Part 1 hero A/B is pre-wired).
const EXPERIMENTS: Record<string, ExperimentConfig> = {
  home_hero_h1: {
    variants: ["clinical_fresh_45", "doctor_sign_off"],
    enabled: false,
  },
};

const DEVICE_KEY = "tanmatra:device-id:v1";
const ASSIGNMENTS_KEY = "tanmatra:experiments:v1";

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage full / privacy mode — assignment falls back to per-load hashing.
  }
}

function deviceId(): string {
  if (typeof window === "undefined") return "ssr";
  const existing = safeGet(DEVICE_KEY);
  if (existing) return existing;
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  safeSet(DEVICE_KEY, id);
  return id;
}

/** FNV-1a — tiny, stable, uniform enough for bucketing. */
function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function pickVariant(key: string, config: ExperimentConfig): string {
  const weights =
    config.weights && config.weights.length === config.variants.length
      ? config.weights
      : config.variants.map(() => 1);
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (total <= 0) return config.variants[0];
  let point = (hash32(`${deviceId()}::${key}`) % 10000) / 10000 * total;
  for (let i = 0; i < config.variants.length; i++) {
    point -= Math.max(0, weights[i]);
    if (point < 0) return config.variants[i];
  }
  return config.variants[config.variants.length - 1];
}

function readStoredAssignments(): Record<string, string> {
  const raw = safeGet(ASSIGNMENTS_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      );
    }
  } catch {
    // Corrupt store — reassign below.
  }
  return {};
}

/**
 * Assignments for all ENABLED experiments — the value events carry.
 * Sticky: once a device is assigned, the stored variant wins even if
 * weights change later; disabled experiments never appear.
 */
export function getExperimentAssignments(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const stored = readStoredAssignments();
  const out: Record<string, string> = {};
  let dirty = false;
  for (const [key, config] of Object.entries(EXPERIMENTS)) {
    if (!config.enabled) continue;
    const existing = stored[key];
    if (existing && config.variants.includes(existing)) {
      out[key] = existing;
      continue;
    }
    out[key] = pickVariant(key, config);
    stored[key] = out[key];
    dirty = true;
  }
  if (dirty) safeSet(ASSIGNMENTS_KEY, JSON.stringify(stored));
  return out;
}

/**
 * Variant for one experiment, for branching UI. Returns the control variant
 * when the experiment is disabled or unknown, so call sites need no guards.
 */
export function getExperimentVariant(key: string): string {
  const config = EXPERIMENTS[key];
  if (!config) return "control";
  if (!config.enabled) return config.variants[0];
  return getExperimentAssignments()[key] ?? config.variants[0];
}
