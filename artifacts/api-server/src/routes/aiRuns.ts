import { Router, type IRouter, type Request, type Response } from "express";
import { db, aiRunsTable } from "@workspace/db";
import { desc, eq, and, lt, type SQL } from "drizzle-orm";
import { listAgents } from "../lib/ai";
import { isOpsRequest } from "../lib/adminGate";

const router: IRouter = Router();

router.get("/ai/agents", async (req: Request, res: Response) => {
  // Internal telemetry endpoint: exposes agent + tool metadata. Gated to
  // authenticated users or admin to reduce reconnaissance surface.
  if (!(await isOpsRequest(req)).allowed && !req.isAuthenticated()) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  res.json({
    agents: listAgents().map((a) => ({
      name: a.name,
      description: a.description,
      defaultModel: a.defaultModel ?? null,
      promptVersion: a.systemPrompt.version,
      tools: a.tools.map((t) => ({
        name: t.name,
        description: t.description,
        authScope: t.authScope,
      })),
    })),
  });
});

router.get("/ai/runs", async (req: Request, res: Response) => {
  const admin = (await isOpsRequest(req)).allowed;
  if (!admin && !req.isAuthenticated()) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const limit = Math.min(
    100,
    Math.max(1, parseInt(String(req.query.limit ?? "25"), 10) || 25),
  );
  const agent =
    typeof req.query.agent === "string" ? req.query.agent : undefined;
  const userIdFilter =
    typeof req.query.userId === "string" ? req.query.userId : undefined;
  const beforeId =
    typeof req.query.beforeId === "string"
      ? parseInt(req.query.beforeId, 10) || undefined
      : undefined;

  const conditions: SQL[] = [];

  if (admin) {
    // Admin can view all runs across users; optional userId filter narrows.
    if (userIdFilter) conditions.push(eq(aiRunsTable.userId, userIdFilter));
  } else {
    // Non-admin authenticated users only see their own runs and may not
    // request another user's runs even via query param.
    conditions.push(eq(aiRunsTable.userId, req.user!.id));
  }

  if (agent) conditions.push(eq(aiRunsTable.agent, agent));
  if (beforeId) conditions.push(lt(aiRunsTable.id, beforeId));

  const baseQuery = db
    .select({
      id: aiRunsTable.id,
      agent: aiRunsTable.agent,
      userId: aiRunsTable.userId,
      model: aiRunsTable.model,
      promptVersion: aiRunsTable.promptVersion,
      status: aiRunsTable.status,
      escalated: aiRunsTable.escalated,
      refusalReason: aiRunsTable.refusalReason,
      inputTokens: aiRunsTable.inputTokens,
      outputTokens: aiRunsTable.outputTokens,
      totalTokens: aiRunsTable.totalTokens,
      costMicroUsd: aiRunsTable.costMicroUsd,
      latencyMs: aiRunsTable.latencyMs,
      attempts: aiRunsTable.attempts,
      timedOut: aiRunsTable.timedOut,
      createdAt: aiRunsTable.createdAt,
      output: aiRunsTable.output,
      toolCalls: aiRunsTable.toolCalls,
      // The gateway writes the upstream failure message here on every failed
      // run (lib/ai/gateway.ts → persistRun), and this projection used to drop
      // it. The consequence was that /admin/ai-runs could show a wall of red
      // "error" badges — 0 tokens, ~600 ms, every agent — while telling an
      // operator NOTHING about the cause, even though the cause was sitting in
      // the row being read. Diagnosing "all agents are dead" then required
      // shell access to the database. Admin-scoped only, see below.
      error: aiRunsTable.error,
    })
    .from(aiRunsTable);

  const rows = await (conditions.length > 0
    ? baseQuery.where(and(...conditions))
    : baseQuery
  )
    .orderBy(desc(aiRunsTable.id))
    .limit(limit);

  const nextCursor =
    rows.length === limit ? rows[rows.length - 1]!.id : null;

  // `error` is a raw upstream/provider string — it can carry request ids,
  // internal endpoints and quota detail. Useful to an operator, disclosure to
  // anyone else, and this endpoint also serves scope:"self" to any signed-in
  // customer looking at their own runs. Strip it for them.
  const payload = admin
    ? rows
    : rows.map(({ error: _error, ...rest }) => rest);

  res.json({ scope: admin ? "admin" : "self", runs: payload, nextCursor });
});

export default router;
