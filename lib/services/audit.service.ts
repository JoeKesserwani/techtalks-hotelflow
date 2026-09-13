import { Prisma } from '../../app/generated/prisma/client';

type AuditInput = {
  hotelId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  metadata?: Record<string, unknown>;
};

/**
 * Writes an audit log row. Pass `tx` (a Prisma transaction client) when called
 * inside a $transaction so the log is committed atomically with the change it records.
 */
export async function writeAuditLog(
  tx: { auditLog: { create: Function } },
  input: AuditInput
) {
  await tx.auditLog.create({
    data: {
      hotelId: input.hotelId,
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      metadataJson: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}
