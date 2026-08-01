import { db, auditLogTable } from "@workspace/db";

export async function recordAdminAction(params: {
  operatorId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  beforeState?: any;
  afterState?: any;
  reason?: string;
}) {
  const metaObj: any = {};
  if (params.reason) metaObj.reason = params.reason;
  if (params.beforeState) metaObj.before = params.beforeState;
  if (params.afterState) metaObj.after = params.afterState;

  await db.insert(auditLogTable).values({
    actorId: params.operatorId,
    actorRole: "admin",
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    ipAddress: params.ipAddress,
    meta: Object.keys(metaObj).length > 0 ? JSON.stringify(metaObj) : null,
  });
}
