import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  wearableLinksTable,
  wearableMetricsTable,
  wearableDailyRollupTable,
  type WearableProvider,
} from "@workspace/db";
import { requireAuthUser as requireAuth } from "../middlewares/requireAuth";
import {
  wearableConfig,
  isWearableEnabled,
  verifyWebhookSignature,
  normalizeProviderPayload,
  sanitizeMetric,
  rollupForDay,
  groupMetricsByDay,
  type NormalizedMetric,
} from "../lib/wearableClient";
import { processBiometricAnomaly, getPatientIngredientLockouts } from "../lib/clinicalGuardrailEngine";

const router: IRouter = Router();

// 401 in the aggregator's expected envelope (mirrors petpooja `unauthorized`).
function unauthorized(res: Response) {
  res
    .status(401)
    .json({ success: "0", message: "unauthorized: invalid wearable signature" });
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function todayStr(): string {
  return dayKey(new Date());
}

/**
 * Recompute + persist the daily rollup for a set of CLEAN (non-flagged)
 * normalized metrics for one internal user, and refresh the wearable_links row
 * so the existing effectiveCalorieTarget() path (which reads
 * lastActivityKcal/lastSyncedAt) immediately reflects today's activity.
 */
async function persistRollups(
  userId: string,
  provider: WearableProvider,
  cleanMetrics: NormalizedMetric[],
): Promise<void> {
  const byDay = groupMetricsByDay(cleanMetrics);
  const today = todayStr();
  let todaysActivityKcal: number | null = null;
  let todaysSteps: number | null = null;

  for (const [day, dayMetrics] of byDay) {
    const rollup = rollupForDay(dayMetrics);
    if (!rollup) continue;
    await db
      .insert(wearableDailyRollupTable)
      .values({
        userId,
        day,
        provider,
        activeEnergyKcal: rollup.activeEnergyKcal,
        steps: rollup.steps,
        restingHr: rollup.restingHr,
        sleepMinutes: rollup.sleepMinutes,
      })
      .onConflictDoUpdate({
        target: [wearableDailyRollupTable.userId, wearableDailyRollupTable.day],
        set: {
          provider,
          activeEnergyKcal: rollup.activeEnergyKcal,
          steps: rollup.steps,
          restingHr: rollup.restingHr,
          sleepMinutes: rollup.sleepMinutes,
          updatedAt: new Date(),
        },
      });
    if (day === today) {
      todaysActivityKcal = rollup.activeEnergyKcal;
      todaysSteps = rollup.steps;
    }
  }

  // Feed the value hook: effectiveCalorieTarget() reads lastActivityKcal +
  // lastSyncedAt (== today) off the link row.
  await db
    .update(wearableLinksTable)
    .set({
      lastSyncedAt: new Date(),
      status: "connected",
      connected: true,
      ...(todaysActivityKcal != null
        ? { lastActivityKcal: todaysActivityKcal }
        : {}),
      ...(todaysSteps != null ? { lastSteps: todaysSteps } : {}),
    })
    .where(
      and(
        eq(wearableLinksTable.userId, userId),
        eq(wearableLinksTable.provider, provider),
      ),
    );
}

// ── Inbound webhook ──────────────────────────────────────────────────────────

router.post(
  "/integrations/wearable/webhook",
  async (req: Request, res: Response) => {
    const cfg = wearableConfig();

    // DISABLED: inert no-op (mirrors Petpooja "unconfigured = allow + warn",
    // but for an inbound aggregator we simply acknowledge and drop).
    if (!cfg) {
      req.log?.info(
        { path: req.path },
        "wearable webhook received but integration is OFF — no-op (set WEARABLE_* to enable)",
      );
      res.status(200).json({ success: "1", message: "wearable integration disabled — ignored" });
      return;
    }

    // ENABLED: authenticate.
    if (!verifyWebhookSignature(req, cfg, req.log)) {
      return unauthorized(res);
    }

    const provider = cfg.provider as WearableProvider;

    try {
      const normalized = normalizeProviderPayload(req.body, cfg.provider);
      if (normalized.length === 0) {
        req.log?.info({ provider }, "wearable webhook: no recognizable metrics");
        res.status(200).json({ success: "1", message: "no metrics", ingested: 0, flagged: 0 });
        return;
      }

      // Resolve providerUserId → internal userId via wearable_links.
      const providerUserId = normalized[0]!.providerUserId;
      const [link] = await db
        .select()
        .from(wearableLinksTable)
        .where(
          and(
            eq(wearableLinksTable.provider, provider),
            eq(wearableLinksTable.providerUserId, providerUserId),
          ),
        )
        .limit(1);

      if (!link) {
        req.log?.warn(
          { provider, providerUserId },
          "wearable webhook: no linked user for providerUserId — ignoring",
        );
        // 200 so the aggregator doesn't retry forever for an unknown user.
        res.status(200).json({ success: "1", message: "no linked user", ingested: 0, flagged: 0 });
        return;
      }
      const userId = link.userId;

      // Sanitize + insert per-record. Never 500 on a single bad record —
      // collect and continue.
      const cleanMetrics: NormalizedMetric[] = [];
      let ingested = 0;
      let flaggedCount = 0;
      let errored = 0;

      for (const m of normalized) {
        const check = sanitizeMetric(m);
        try {
          await db
            .insert(wearableMetricsTable)
            .values({
              userId,
              provider: m.provider,
              metricType: m.metricType,
              value: m.value,
              unit: m.unit,
              recordedAt: m.recordedAt,
              source: m.source,
              dedupeKey: m.dedupeKey,
              flagged: check.flagged,
            })
            .onConflictDoNothing({
              target: [
                wearableMetricsTable.userId,
                wearableMetricsTable.dedupeKey,
              ],
              // Matches the PARTIAL unique index predicate (dedupe_key not null).
              where: sql`dedupe_key is not null`,
            });
          ingested += 1;
          if (check.flagged) {
            flaggedCount += 1;
            req.log?.warn(
              { userId, metricType: m.metricType, value: m.value, reason: check.reason },
              "wearable metric flagged as outlier (stored, excluded from rollup)",
            );
          } else {
            cleanMetrics.push(m);
          }
        } catch (err) {
          errored += 1;
          req.log?.error(
            { err, metricType: m.metricType },
            "wearable metric insert failed — skipping record",
          );
        }
      }

      // Recompute affected days' rollups from the clean metrics + refresh link.
      if (cleanMetrics.length > 0) {
        await persistRollups(userId, provider, cleanMetrics).catch((err) => {
          req.log?.error({ err }, "wearable rollup recompute failed");
        });
      }

      req.log?.info(
        { userId, provider, ingested, flagged: flaggedCount, errored },
        "wearable webhook ingest complete",
      );
      res.status(200).json({
        success: "1",
        message: "ingested",
        ingested,
        flagged: flaggedCount,
        errored,
      });
    } catch (err) {
      // Defensive: the whole batch failed unexpectedly. Still avoid a 500 loop
      // with the aggregator — acknowledge and log.
      req.log?.error({ err }, "wearable webhook processing failed");
      res.status(200).json({ success: "0", message: "processing error (logged)" });
    }
  },
);

// ── Authenticated user endpoints ─────────────────────────────────────────────

const aggregatorProviders = ["terra", "vital", "mock"] as const;

const connectSchema = z.object({
  // DPDPA: explicit consent is required to create an aggregator link.
  consent: z.literal(true, { message: "consent is required" }),
  provider: z.enum(aggregatorProviders).optional(),
});

router.post("/wearable/connect", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const cfg = wearableConfig();

  // DISABLED: keep the existing "web preview" stub behavior — mark connected so
  // nothing in the UI breaks. No consent gating in stub mode (matches the
  // legacy /wellness/wearable/connect stub).
  if (!cfg) {
    const provider: WearableProvider = "mock";
    const [row] = await db
      .insert(wearableLinksTable)
      .values({ userId, provider, connected: true, status: "connected" })
      .onConflictDoUpdate({
        target: [wearableLinksTable.userId, wearableLinksTable.provider],
        set: { connected: true, status: "connected" },
      })
      .returning();
    res.json({ enabled: false, preview: true, link: row });
    return;
  }

  // ENABLED: require consent, create an aggregator widget/auth session and a
  // `pending` link row.
  const parsed = connectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "consent is required to connect a wearable" });
    return;
  }

  const provider = (parsed.data.provider ?? cfg.provider) as WearableProvider;
  const now = new Date();
  // reference_id we hand the aggregator so its webhook maps back to this user.
  const referenceId = userId;

  const [row] = await db
    .insert(wearableLinksTable)
    .values({
      userId,
      provider,
      connected: false,
      status: "pending",
      providerUserId: referenceId,
      scopes: ["activity"],
      consentAt: now,
    })
    .onConflictDoUpdate({
      target: [wearableLinksTable.userId, wearableLinksTable.provider],
      set: {
        status: "pending",
        providerUserId: referenceId,
        scopes: ["activity"],
        consentAt: now,
      },
    })
    .returning();

  // Widget/auth session URL. A real integration exchanges cfg.apiKey for a
  // one-time widget session via the aggregator's API; we return a deterministic
  // URL carrying the reference_id so the flow is wired end-to-end.
  const widgetUrl =
    provider === "terra"
      ? `https://widget.tryterra.co/session?reference_id=${encodeURIComponent(referenceId)}`
      : provider === "vital"
        ? `https://link.tryvital.io/?reference_id=${encodeURIComponent(referenceId)}`
        : `about:blank#mock-wearable-connect?reference_id=${encodeURIComponent(referenceId)}`;

  res.json({ enabled: true, provider, widgetUrl, link: row });
});

router.get("/wearable/status", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const links = await db
    .select()
    .from(wearableLinksTable)
    .where(eq(wearableLinksTable.userId, userId))
    .orderBy(desc(wearableLinksTable.id));

  const today = todayStr();
  const [rollup] = await db
    .select()
    .from(wearableDailyRollupTable)
    .where(
      and(
        eq(wearableDailyRollupTable.userId, userId),
        eq(wearableDailyRollupTable.day, today),
      ),
    )
    .limit(1);

  res.json({
    enabled: isWearableEnabled(),
    links,
    lastSync: links.find((l) => l.lastSyncedAt)?.lastSyncedAt ?? null,
    todayRollup: rollup ?? null,
  });
});

const disconnectSchema = z.object({
  provider: z.enum(aggregatorProviders).optional(),
});

router.post("/wearable/disconnect", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const parsed = disconnectSchema.safeParse(req.body ?? {});
  const provider = parsed.success ? parsed.data.provider : undefined;

  const where = provider
    ? and(
        eq(wearableLinksTable.userId, userId),
        eq(wearableLinksTable.provider, provider as WearableProvider),
      )
    : eq(wearableLinksTable.userId, userId);

  await db
    .update(wearableLinksTable)
    .set({ status: "disconnected", connected: false })
    .where(where);

  res.json({ ok: true });
});

const biometricAnomalySchema = z.object({
  glucoseReadingMgDl: z.number().int().positive(),
});

// Phase 3: Automated Wearable Biometric Target Calibration & RD Alerting
router.post("/wearable/biometric-anomaly", async (req: Request, res: Response) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const parsed = biometricAnomalySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "malformed glucoseReadingMgDl parameter" });
    return;
  }
  try {
    const result = await processBiometricAnomaly(userId, parsed.data.glucoseReadingMgDl);
    res.json({ ok: true, anomalyResult: result });
  } catch (err) {
    res.status(500).json({ error: "Failed to evaluate biometric anomaly profile" });
  }
});

// Phase 3: Retrieve patient dietary ingredient exclusions forced by biometric anomalies
router.get("/wearable/patient-lockouts", async (req: Request, res: Response) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  try {
    const lockouts = await getPatientIngredientLockouts(userId);
    res.json(lockouts);
  } catch {
    res.status(500).json({ error: "Failed to resolve patient ingredient lockouts" });
  }
});

export default router;
