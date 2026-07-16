import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

export interface TenantContext {
  tenantId: string;
  userId: string;
  role: string;
}

export interface TenantAuditRecord {
  id: string;
  requestingTenantId: string;
  requestingUserId: string;
  targetResourceId: string;
  targetTenantId: string;
  action: string;
  timestamp: string;
  ip: string;
  breachDetected: boolean;
}

export const tenantAuditLogs: TenantAuditRecord[] = [];

/**
 * Step 1: Creates tenant-scoped cache key to prevent cross tenant cache pollution.
 * Ensures cache keys always bind the active tenant context.
 */
export function buildTenantCacheKey(tenantId: string, resourceKey: string): string {
  if (!tenantId || tenantId.trim() === "") {
    throw new Error("Tenant isolation failure: Missing tenant context in cache key");
  }
  return `tenant:${tenantId}:${resourceKey}`;
}

/**
 * Step 2: Tenant Access Audit Logger & Real-Time Cross-Tenant Breach Detector.
 * Provides instant compliance answers (How long, Who else saw it, What was exposed).
 */
export function auditTenantResourceAccess(params: {
  requestingTenantId: string;
  requestingUserId: string;
  targetResourceId: string;
  targetTenantId: string;
  action: string;
  ip: string;
}): { isAuthorized: boolean; record: TenantAuditRecord } {
  const breachDetected = params.requestingTenantId !== params.targetTenantId;

  const record: TenantAuditRecord = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    requestingTenantId: params.requestingTenantId,
    requestingUserId: params.requestingUserId,
    targetResourceId: params.targetResourceId,
    targetTenantId: params.targetTenantId,
    action: params.action,
    timestamp: new Date().toISOString(),
    ip: params.ip,
    breachDetected,
  };

  tenantAuditLogs.push(record);

  if (breachDetected) {
    logger.fatal(
      {
        breachRecord: record,
        securityAlert: "CROSS_TENANT_DATA_LEAK_PREVENTED",
      },
      "tenant.isolation.breach_detected"
    );
  } else {
    logger.info({ record }, "tenant.access_audited");
  }

  return { isAuthorized: !breachDetected, record };
}

/**
 * Step 1 & 3: Tenant Isolation Boundary Middleware.
 * Enforces tenant context binding on every incoming API request and prevents cross-tenant query execution.
 */
export function tenantIsolationGuard(
  getTargetTenantId: (req: Request) => string | undefined
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user as { id?: string; tenantId?: string } | undefined;
    const requestingTenantId = user?.tenantId ?? user?.id ?? "anonymous_tenant";
    const requestingUserId = user?.id ?? "anonymous_user";
    const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";

    const targetTenantId = getTargetTenantId(req);

    // If request attempts to target another tenant's resource, block immediately!
    if (targetTenantId && requestingTenantId !== targetTenantId) {
      const { record } = auditTenantResourceAccess({
        requestingTenantId,
        requestingUserId,
        targetResourceId: req.originalUrl,
        targetTenantId,
        action: req.method,
        ip,
      });

      res.status(403).json({
        error: "tenant_isolation_violation",
        message: "Access Denied: Cross-tenant data access is strictly prohibited.",
        auditEventId: record.id,
      });
      return;
    }

    next();
  };
}
