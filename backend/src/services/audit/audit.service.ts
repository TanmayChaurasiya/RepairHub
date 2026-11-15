import { prisma } from '../../config/db.js';
import { Role } from '@prisma/client';

export interface AuditLogParams {
  actorId: string;
  actorRole: Role;
  action: string;
  targetEntity: string;
  targetId: string;
  metadata?: Record<string, any>;
}

export async function logAudit(params: AuditLogParams) {
  try {
    return await prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        actorRole: params.actorRole,
        action: params.action,
        targetEntity: params.targetEntity,
        targetId: params.targetId,
        metadata: params.metadata || {},
      },
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
