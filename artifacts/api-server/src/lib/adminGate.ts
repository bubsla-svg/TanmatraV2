import type { Request, Response } from "express";
import crypto from "crypto";
import { hasAdminSession } from "./adminAuth";
import { db, adminRolesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

/**
 * Constant-time comparison for shared-secret tokens. Both inputs must be
 * the same length to be considered equal; never log either side.
 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function envList(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** True iff the request carries a valid `x-admin-token` header. */
export function hasAdminToken(req: Request): boolean {
  const expected = process.env["RD_ADMIN_TOKEN"];
  if (!expected) return false;
  const got = req.header("x-admin-token");
  if (!got) return false;
  return safeEqual(got, expected);
}

export interface GateResult {
  allowed: boolean;
  operatorId: string | null;
}

export async function isRoleRequest(req: Request, role: string | string[]): Promise<GateResult> {
  const targetRoles = Array.isArray(role) ? role : [role];

  if (hasAdminToken(req)) {
    return { allowed: true, operatorId: req.user?.id ?? "admin-token" };
  }
  const adminSession = hasAdminSession(req);
  if (adminSession) {
    return { allowed: true, operatorId: `admin:${adminSession.username}` };
  }

  if (req.isAuthenticated()) {
    // 1. Check database for ANY roles this user has
    const dbRows = await db
      .select()
      .from(adminRolesTable)
      .where(eq(adminRolesTable.userId, req.user.id));
      
    const roles = dbRows.map(r => r.role);
    if (
      roles.includes("owner") || 
      targetRoles.some(r => roles.includes(r)) || 
      (req.method === "GET" && roles.includes("readonly"))
    ) {
      return { allowed: true, operatorId: req.user.id };
    }

    // 2. Legacy fallback
    if (targetRoles.includes("kitchen")) {
      const allowlist = envList("OPS_USER_IDS");
      if (allowlist.includes(req.user.id)) {
        return { allowed: true, operatorId: req.user.id };
      }
    }
    if (targetRoles.includes("catalog")) {
      const allow = [...envList("CATALOG_USER_IDS"), ...envList("OPS_USER_IDS")];
      if (allow.includes(req.user.id)) {
        return { allowed: true, operatorId: req.user.id };
      }
    }
  }

  return { allowed: false, operatorId: null };
}

/** Ops scope: x-admin-token OR signed admin cookie OR user in OPS_USER_IDS. */
export async function isOpsRequest(req: Request): Promise<GateResult> {
  return isRoleRequest(req, "kitchen");
}

/** Catalog scope: x-admin-token OR signed admin cookie OR user in CATALOG_USER_IDS/OPS_USER_IDS. */
export async function isCatalogRequest(req: Request): Promise<GateResult> {
  return isRoleRequest(req, "catalog");
}

/** Helper: gate a handler with a generic role. Returns operatorId or null (after sending 403). */
export async function requireRole(
  req: Request,
  res: Response,
  role: string | string[]
): Promise<{ operatorId: string | null } | null> {
  const r = await isRoleRequest(req, role);
  if (!r.allowed) {
    const roleStr = Array.isArray(role) ? role.join(" or ") : role;
    res.status(403).json({ error: `${roleStr} scope required` });
    return null;
  }
  return { operatorId: r.operatorId };
}

/** Helper: gate a handler with ops scope. Returns operatorId or null (after sending 403). */
export async function requireOps(
  req: Request,
  res: Response,
): Promise<{ operatorId: string | null } | null> {
  const r = await isOpsRequest(req);
  if (!r.allowed) {
    res.status(403).json({ error: "ops scope required" });
    return null;
  }
  return { operatorId: r.operatorId };
}

/** Helper: gate a handler with catalog scope. */
export async function requireCatalog(
  req: Request,
  res: Response,
): Promise<{ operatorId: string | null } | null> {
  const r = await isCatalogRequest(req);
  if (!r.allowed) {
    res.status(403).json({ error: "catalog scope required" });
    return null;
  }
  return { operatorId: r.operatorId };
}
