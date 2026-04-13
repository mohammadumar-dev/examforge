import { prisma } from "./prisma";

interface AuditLogOptions {
  actorType: "admin" | "system";
  actorId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export async function writeAuditLog(opts: AuditLogOptions): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorType: opts.actorType,
        actorId: opts.actorId,
        action: opts.action,
        targetType: opts.targetType,
        targetId: opts.targetId,
        metadata: opts.metadata as object,
        ipAddress: opts.ipAddress,
      },
    });
  } catch (err) {
    // Audit log failure is non-fatal
    console.error("[audit] Failed to write audit log:", err);
  }
}
