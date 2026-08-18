import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { HealthCheckResponse } from "@workspace/api-zod";
import { isRedisConfigured, probeRedis } from "../lib/queue";

const router: IRouter = Router();

// Liveness probe: returns 200 as long as the event loop is responsive.
// Intentionally has NO external dependencies (no DB, no Redis) so Cloud Run /
// k8s startup + liveness probes never fail because of a downstream blip and
// recycle the container. Use /healthz for readiness (deep dependency check).
router.get("/livez", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

/**
 * Deploy-truth probe. Reports the commit this process was built from.
 *
 * /livez proves the service is UP. It cannot prove the service is the one that
 * was just deployed — a revision from two days ago answers it exactly as
 * happily, so a deploy that never actually rolled looks identical to one that
 * did. The storefront and the legacy SPA both already close that hole with an
 * /api/build endpoint their deploy jobs poll until the sha matches; this is the
 * money-path service and it was the only one of the three without one, so its
 * deploy step verified liveness and nothing else.
 *
 * Deliberately unauthenticated and dependency-free, matching /livez: it is
 * polled by the deploy job before traffic is trusted, and a commit sha is not
 * a secret (the storefront has served the same field publicly since cutover).
 */
router.get("/build", (_req: Request, res: Response) => {
  res.json({
    app: "tanmatra-api",
    // Set at deploy time by the cloud-run job, not baked into the image, so
    // this reflects the running revision rather than whatever was compiled.
    sha: process.env["BUILD_SHA"] ?? "unknown",
    builtAt: process.env["BUILT_AT"] ?? null,
  });
});

const DB_PROBE_TIMEOUT_MS = 1500;
const REDIS_PROBE_TIMEOUT_MS = 1500;

async function probeDb(): Promise<"ok" | "down"> {
  const client = await pool.connect();
  try {
    await client.query({ text: "select 1", values: [] });
    return "ok";
  } finally {
    client.release();
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} probe timed out`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

router.get("/healthz", async (req: Request, res: Response) => {
  const failures: string[] = [];

  let dbOk = false;
  try {
    const r = await withTimeout(probeDb(), DB_PROBE_TIMEOUT_MS, "db");
    dbOk = r === "ok";
  } catch (err) {
    req.log.error({ err }, "healthz db probe failed");
  }
  if (!dbOk) failures.push("db");

  if (isRedisConfigured()) {
    let redisOk = false;
    try {
      const r = await withTimeout(probeRedis(), REDIS_PROBE_TIMEOUT_MS, "redis");
      redisOk = r === "ok";
    } catch (err) {
      req.log.error({ err }, "healthz redis probe failed");
    }
    if (!redisOk) failures.push("redis");
  } else if (process.env["NODE_ENV"] === "production") {
    failures.push("redis");
  }

  if (failures.length > 0) {
    res
      .status(503)
      .json(HealthCheckResponse.parse({ status: `degraded:${failures.join(",")}` }));
    return;
  }
  res.json(HealthCheckResponse.parse({ status: "ok" }));
});

export default router;
