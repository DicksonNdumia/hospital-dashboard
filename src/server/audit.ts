import type { Prisma } from '@prisma/client';
import { prisma } from './db.ts';
import type { AuthUser } from './auth.ts';

interface AuditInput {
  actor?: AuthUser | null;
  action: string;
  entityType: string;
  entityId: string;
  details?: string;
}

export async function writeAuditLog(
  input: AuditInput,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx ?? prisma;
  await client.auditLog.create({
    data: {
      actorId: input.actor?.id ?? null,
      actorEmail: input.actor?.email ?? 'system@northfieldclinic.org',
      actorRole: input.actor?.role ?? 'SYSTEM',
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      details: input.details ?? '',
    },
  });
}
