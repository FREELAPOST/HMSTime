import { prisma } from "../prisma.js";

type AuditInput = {
  actorId?: string | null;
  targetUserId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: unknown;
};

export async function audit(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      targetUserId: input.targetUserId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      details: input.details === undefined ? undefined : (input.details as object)
    }
  });
}
