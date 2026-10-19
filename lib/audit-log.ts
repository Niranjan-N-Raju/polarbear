/**
 * Structured audit logger for security-sensitive actions.
 * Logs to stdout in JSON format for easy ingestion by log aggregators.
 */

export type AuditAction =
  | "auth.login.success"
  | "auth.login.failed"
  | "auth.logout"
  | "auth.session.extended"
  | "user.created"
  | "user.updated"
  | "user.deleted"
  | "user.password.changed"
  | "store.created"
  | "store.updated"
  | "store.archived"
  | "store.restored"
  | "store.salary-cycle.updated"
  | "store.branding.updated"
  | "store.logo.uploaded"
  | "store.logo.removed"
  | "user.unarchived"
  | "user.archived";

interface AuditEntry {
  timestamp: string;
  action: AuditAction;
  actorId?: string;
  actorRole?: string;
  targetId?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
}

export function auditLog(
  action: AuditAction,
  details: Omit<AuditEntry, "timestamp" | "action">,
): void {
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    action,
    ...details,
  };

  console.log(`[AUDIT] ${JSON.stringify(entry)}`);
}
