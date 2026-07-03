import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { and, eq, lt, sql } from "drizzle-orm";
import { db, idempotencyKeysTable } from "@workspace/db";

/**
 * Server-managed `Idempotency-Key` middleware for write endpoints that
 * must survive client retries — primarily order create.
 *
 * Contract:
 *   - Header `Idempotency-Key` REQUIRED (8–128 url-safe chars). Missing
 *     → 400 `idempotency_key_required` so the client (and integration
 *     tests) cannot regress to "id from request body" behavior.
 *   - Same key + same body within TTL → cached status + body replayed
 *     verbatim (no duplicate handler call → no duplicate order/charge).
 *   - Same key + DIFFERENT body → 409 `idempotency_key_mismatch`. Loud
 *     so client bugs surface instead of silently dropping a real order.
 *   - Concurrent duplicate POSTs serialize: the first request inserts
 *     the placeholder row (status_code = NULL → "in flight"), the
 *     second sees the conflict, polls the row until the winner stamps
 *     it, then replays. Persistence happens BEFORE the winner's
 *     response is flushed so the loser's poll always observes the
 *     stamped row by the time the winner's caller sees the answer.
 *
 * The middleware itself is route-agnostic; mount it on each endpoint
 * that needs the guarantee. Auth must run first because the cache is
 * scoped per (user_id, key) — anonymous use would be ambiguous.
 */

const KEY_RE = /^[A-Za-z0-9._\-:]{8,128}$/;
const TTL_MS = 24 * 60 * 60 * 1000; // 24 h
const IN_FLIGHT_TIMEOUT_MS = 60_000; // 60s max in-flight duration before crash recovery
const POLL_INTERVAL_MS = 50;
const POLL_TIMEOUT_MS = 5_000;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      out[k] = canonicalize((value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return value;
}

function hashRequestBody(body: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(body ?? null)))
    .digest("hex");
}

function isExpired(row: { expiresAt: Date }): boolean {
  return row.expiresAt.getTime() <= Date.now();
}

function extractChunkAndEncoding(args: unknown[]): {
  chunk: unknown;
  encoding?: BufferEncoding;
} {
  let chunk: unknown = undefined;
  let encoding: BufferEncoding | undefined = undefined;
  for (const arg of args) {
    if (typeof arg === "function") {
      continue;
    }
    if (chunk === undefined) {
      chunk = arg;
    } else if (typeof arg === "string" && encoding === undefined) {
      encoding = arg as BufferEncoding;
    }
  }
  return { chunk, encoding };
}

function appendToChunks(
  chunks: Buffer[],
  chunk: unknown,
  encoding?: BufferEncoding,
): void {
  if (chunk === undefined || chunk === null) return;
  if (typeof chunk === "string") {
    chunks.push(Buffer.from(chunk, encoding || "utf8"));
  } else if (Buffer.isBuffer(chunk) || chunk instanceof Uint8Array) {
    chunks.push(Buffer.from(chunk));
  } else {
    chunks.push(Buffer.from(String(chunk), encoding || "utf8"));
  }
}

/**
 * Send a previously cached response. We always emit JSON because every
 * route protected by this middleware speaks JSON; if a future route
 * needs to cache a non-JSON body, extend the schema with a content-
 * type column rather than guessing here. We replay the EXACT serialized
 * bytes the original handler produced — not a re-serialization of a
 * parsed object — so byte-level equivalence holds (matters for clients
 * that hash response bodies).
 */
function replay(
  res: Response,
  row: { statusCode: number | null; responseBody: string | null },
): void {
  res
    .status(row.statusCode ?? 500)
    .setHeader("Idempotent-Replay", "true")
    .type("application/json")
    .send(row.responseBody ?? "null");
}

async function loadRow(userId: string, key: string) {
  const [row] = await db
    .select()
    .from(idempotencyKeysTable)
    .where(
      and(
        eq(idempotencyKeysTable.userId, userId),
        eq(idempotencyKeysTable.key, key),
      ),
    );
  return row;
}

async function waitForCompletion(
  userId: string,
  key: string,
): Promise<typeof idempotencyKeysTable.$inferSelect | null> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const row = await loadRow(userId, key);
    if (!row) return null; // winner deleted it (e.g. expired race)
    if (row.statusCode != null) return row;
  }
  return null;
}

export function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  void runIdempotency(req, res, next).catch(next);
}

async function runIdempotency(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId =
    req.user?.id ||
    req.header("X-Guest-ID") ||
    req.header("X-Device-ID") ||
    `guest:${req.ip || req.socket?.remoteAddress || "anonymous"}`;

  const rawKey = req.header("Idempotency-Key");
  if (!rawKey) {
    res.status(400).json({
      error: "idempotency_key_required",
      message:
        "POST to this endpoint requires an Idempotency-Key header (UUID recommended).",
    });
    return;
  }
  const key = rawKey.trim();
  if (!KEY_RE.test(key)) {
    res.status(400).json({
      error: "idempotency_key_invalid",
      message:
        "Idempotency-Key must be 8-128 chars from [A-Za-z0-9._-:].",
    });
    return;
  }

  const requestHash = hashRequestBody(req.body);
  const expiresAt = new Date(Date.now() + TTL_MS);

  // Race-free placeholder insert. ON CONFLICT DO NOTHING returns the
  // row only when WE inserted it, letting us distinguish winner from
  // loser without a separate SELECT.
  const inserted = await db
    .insert(idempotencyKeysTable)
    .values({
      userId,
      key,
      requestHash,
      statusCode: null,
      responseBody: null,
      expiresAt,
    })
    .onConflictDoNothing({
      target: [idempotencyKeysTable.userId, idempotencyKeysTable.key],
    })
    .returning();

  if (inserted.length === 0) {
    // Someone else owns this key. Either it's a true replay (already
    // stamped), an in-flight duplicate (poll), or an expired/crashed row
    // we should recover or overwrite.
    const existing = await loadRow(userId, key);
    if (!existing) {
      // Winner deleted/expired between conflict and our SELECT —
      // safest to ask client to retry rather than risk a silent
      // double-insert race.
      res.status(409).json({ error: "idempotency_state_lost" });
      return;
    }
    if (isExpired(existing)) {
      // Stale: atomically delete ONLY if still expired under contention.
      const deleted = await db
        .delete(idempotencyKeysTable)
        .where(
          and(
            eq(idempotencyKeysTable.userId, userId),
            eq(idempotencyKeysTable.key, key),
            lt(idempotencyKeysTable.expiresAt, new Date()),
          ),
        )
        .returning();
      if (deleted.length > 0) {
        return runIdempotency(req, res, next);
      }
      const refreshed = await loadRow(userId, key);
      if (!refreshed) {
        return runIdempotency(req, res, next);
      }
      if (refreshed.statusCode != null) {
        if (refreshed.requestHash !== requestHash) {
          res.status(409).json({
            error: "idempotency_key_mismatch",
            message:
              "Idempotency-Key reused with a different request body. Generate a new key for a new request.",
          });
          return;
        }
        replay(res, refreshed);
        return;
      }
      return runIdempotency(req, res, next);
    }
    if (existing.requestHash !== requestHash) {
      res.status(409).json({
        error: "idempotency_key_mismatch",
        message:
          "Idempotency-Key reused with a different request body. Generate a new key for a new request.",
      });
      return;
    }
    if (existing.statusCode == null) {
      // Check for crash lock exhaustion: if the row has been in flight longer than IN_FLIGHT_TIMEOUT_MS,
      // recover it atomically rather than locking callers out with 409.
      if (Date.now() - existing.createdAt.getTime() >= IN_FLIGHT_TIMEOUT_MS) {
        const recovered = await db
          .delete(idempotencyKeysTable)
          .where(
            and(
              eq(idempotencyKeysTable.userId, userId),
              eq(idempotencyKeysTable.key, key),
              sql`${idempotencyKeysTable.statusCode} is null`,
              lt(
                idempotencyKeysTable.createdAt,
                new Date(Date.now() - IN_FLIGHT_TIMEOUT_MS),
              ),
            ),
          )
          .returning();
        if (recovered.length > 0) {
          return runIdempotency(req, res, next);
        }
      }

      const completed = await waitForCompletion(userId, key);
      if (!completed) {
        const current = await loadRow(userId, key);
        if (
          current &&
          current.statusCode == null &&
          Date.now() - current.createdAt.getTime() >= IN_FLIGHT_TIMEOUT_MS
        ) {
          const recovered = await db
            .delete(idempotencyKeysTable)
            .where(
              and(
                eq(idempotencyKeysTable.userId, userId),
                eq(idempotencyKeysTable.key, key),
                sql`${idempotencyKeysTable.statusCode} is null`,
              ),
            )
            .returning();
          if (recovered.length > 0) {
            return runIdempotency(req, res, next);
          }
        }
        res.status(409).json({
          error: "idempotency_in_flight",
          message:
            "A prior request with this key is still being processed; retry shortly.",
        });
        return;
      }
      replay(res, completed);
      return;
    }
    replay(res, existing);
    return;
  }

  // We own the row. Capture response completion so we await db.update BEFORE
  // flushing bytes to the wire.
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);
  let captured = false;
  const chunks: Buffer[] = [];

  const persistAndFinish = async (
    status: number,
    serialized: string,
    onDone: () => void,
  ) => {
    if (captured) return;
    captured = true;
    try {
      await db
        .update(idempotencyKeysTable)
        .set({ statusCode: status, responseBody: serialized })
        .where(
          and(
            eq(idempotencyKeysTable.userId, userId),
            eq(idempotencyKeysTable.key, key),
          ),
        );
    } catch (err) {
      req.log?.error?.({ err, key }, "idempotency persist failed");
    }
    onDone();
  };

  res.json = (body: unknown) => {
    if (captured) {
      originalJson(body);
      return res;
    }
    const status = res.statusCode || 200;
    const serialized = JSON.stringify(body);
    void persistAndFinish(status, serialized, () => {
      res.type("application/json");
      originalSend(serialized);
    });
    return res;
  };

  res.send = (body?: unknown) => {
    if (captured) {
      originalSend(body);
      return res;
    }
    const status = res.statusCode || 200;
    let serialized = "";
    if (body !== undefined && body !== null) {
      serialized =
        typeof body === "object" && !Buffer.isBuffer(body)
          ? JSON.stringify(body)
          : body.toString();
    }
    void persistAndFinish(status, serialized, () => {
      originalSend(body);
    });
    return res;
  };

  res.write = ((...args: unknown[]) => {
    if (captured) {
      return (originalWrite as (...a: unknown[]) => unknown)(...args);
    }
    const { chunk, encoding } = extractChunkAndEncoding(args);
    appendToChunks(chunks, chunk, encoding);
    return (originalWrite as (...a: unknown[]) => unknown)(...args);
  }) as unknown as typeof res.write;

  res.end = ((...args: unknown[]) => {
    if (captured) {
      return (originalEnd as (...a: unknown[]) => unknown)(...args);
    }
    const { chunk, encoding } = extractChunkAndEncoding(args);
    appendToChunks(chunks, chunk, encoding);
    const status = res.statusCode || 200;
    const serialized = Buffer.concat(chunks).toString("utf8");
    void persistAndFinish(status, serialized, () => {
      (originalEnd as (...a: unknown[]) => unknown)(...args);
    });
    return res;
  }) as unknown as typeof res.end;

  res.on("finish", () => {
    if (captured) return;
    const status = res.statusCode || 200;
    void db
      .update(idempotencyKeysTable)
      .set({ statusCode: status, responseBody: "" })
      .where(
        and(
          eq(idempotencyKeysTable.userId, userId),
          eq(idempotencyKeysTable.key, key),
        ),
      )
      .catch((err) => {
        req.log?.error?.({ err, key }, "idempotency finish-stamp failed");
      });
  });

  next();
}

/**
 * Periodic sweeper. Cheap to call — the index on `expires_at` makes
 * this an O(log n) range delete. Returns the number of rows purged.
 */
export async function sweepExpiredIdempotencyKeys(): Promise<number> {
  const r = await db
    .delete(idempotencyKeysTable)
    .where(lt(idempotencyKeysTable.expiresAt, sql`now()`))
    .returning({ k: idempotencyKeysTable.key });
  return r.length;
}
