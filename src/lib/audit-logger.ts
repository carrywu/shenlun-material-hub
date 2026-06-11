import { db } from "./db";

export type AuditAction =
  | "login"
  | "logout"
  | "create"
  | "update"
  | "delete"
  | "export"
  | "import"
  | "sync"
  | "assess"
  | "review"
  | "upgrade"
  | "generate_card"
  | "change_password"
  | "role_change"
  | "user_disable"
  | "user_enable";

export type AuditResource =
  | "User"
  | "ContentItem"
  | "MaterialCard"
  | "Source"
  | "AiConfig"
  | "Invitation"
  | "Backup"
  | "Session"
  | "AsyncTask";

export async function auditLog(params: {
  userId?: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  detail?: Record<string, unknown>;
  ip?: string;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        detail: params.detail ? JSON.stringify(params.detail) : null,
        ip: params.ip ?? null,
      },
    });
  } catch (error) {
    // Audit logging should never crash the app
    console.error("[AuditLog] Failed to write audit log:", error);
  }
}
