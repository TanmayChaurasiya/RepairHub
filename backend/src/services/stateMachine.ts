import { RequestStatus, Role } from '@prisma/client';

export interface TransitionRule {
  from: RequestStatus;
  to: RequestStatus;
  allowedRoles: Role[];
  description: string;
}

export const TRANSITION_RULES: TransitionRule[] = [
  // Admin assigns mechanic to submitted request
  {
    from: RequestStatus.SUBMITTED,
    to: RequestStatus.ASSIGNED,
    allowedRoles: [Role.ADMIN],
    description: 'Admin assigns a mechanic to the request',
  },
  // Customer or admin cancels before work begins
  {
    from: RequestStatus.SUBMITTED,
    to: RequestStatus.CANCELLED,
    allowedRoles: [Role.CUSTOMER, Role.ADMIN],
    description: 'Request cancelled by customer or admin',
  },
  // Mechanic starts inspecting the vehicle
  {
    from: RequestStatus.ASSIGNED,
    to: RequestStatus.INSPECTING,
    allowedRoles: [Role.MECHANIC],
    description: 'Mechanic begins vehicle inspection',
  },
  {
    from: RequestStatus.ASSIGNED,
    to: RequestStatus.CANCELLED,
    allowedRoles: [Role.CUSTOMER, Role.ADMIN],
    description: 'Request cancelled prior to inspection',
  },
  // Mechanic sends initial estimate
  {
    from: RequestStatus.INSPECTING,
    to: RequestStatus.ESTIMATE_SENT,
    allowedRoles: [Role.MECHANIC],
    description: 'Mechanic completes inspection and sends estimate',
  },
  {
    from: RequestStatus.INSPECTING,
    to: RequestStatus.CANCELLED,
    allowedRoles: [Role.CUSTOMER, Role.ADMIN],
    description: 'Request cancelled during inspection',
  },
  // Customer approves estimate
  {
    from: RequestStatus.ESTIMATE_SENT,
    to: RequestStatus.APPROVED,
    allowedRoles: [Role.CUSTOMER],
    description: 'Customer approves the estimate',
  },
  // Customer rejects estimate
  {
    from: RequestStatus.ESTIMATE_SENT,
    to: RequestStatus.REJECTED,
    allowedRoles: [Role.CUSTOMER],
    description: 'Customer rejects the estimate',
  },
  // Mechanic reopens estimate to revise
  {
    from: RequestStatus.ESTIMATE_SENT,
    to: RequestStatus.INSPECTING,
    allowedRoles: [Role.MECHANIC],
    description: 'Mechanic reopens inspection to revise estimate',
  },
  {
    from: RequestStatus.ESTIMATE_SENT,
    to: RequestStatus.CANCELLED,
    allowedRoles: [Role.CUSTOMER, Role.ADMIN],
    description: 'Request cancelled after estimate sent',
  },
  // Mechanic reopens from REJECTED to revise estimate
  {
    from: RequestStatus.REJECTED,
    to: RequestStatus.INSPECTING,
    allowedRoles: [Role.MECHANIC],
    description: 'Mechanic reopens to revise estimate after rejection',
  },
  {
    from: RequestStatus.REJECTED,
    to: RequestStatus.CANCELLED,
    allowedRoles: [Role.CUSTOMER, Role.ADMIN],
    description: 'Request cancelled after estimate rejected',
  },
  // Mechanic starts work AFTER approval (Work can NEVER start until customer approves)
  {
    from: RequestStatus.APPROVED,
    to: RequestStatus.IN_PROGRESS,
    allowedRoles: [Role.MECHANIC],
    description: 'Mechanic commences repair work following customer approval',
  },
  // Mechanic moves from IN_PROGRESS to Quality Check
  {
    from: RequestStatus.IN_PROGRESS,
    to: RequestStatus.QC,
    allowedRoles: [Role.MECHANIC],
    description: 'Repairs completed; moved to quality check',
  },
  // Mechanic marks QC as COMPLETED
  {
    from: RequestStatus.QC,
    to: RequestStatus.COMPLETED,
    allowedRoles: [Role.MECHANIC],
    description: 'Quality check passed; vehicle repair completed',
  },
  // Customer pays for completed job
  {
    from: RequestStatus.COMPLETED,
    to: RequestStatus.PAID,
    allowedRoles: [Role.CUSTOMER],
    description: 'Customer completes payment for the invoice',
  },
];

export interface TransitionValidationResult {
  valid: boolean;
  statusCode: number;
  error?: string;
  rule?: TransitionRule;
}

export function validateTransition(
  currentStatus: RequestStatus,
  targetStatus: RequestStatus,
  role: Role
): TransitionValidationResult {
  // Find rule matching from -> to
  const matchingRule = TRANSITION_RULES.find(
    (rule) => rule.from === currentStatus && rule.to === targetStatus
  );

  if (!matchingRule) {
    return {
      valid: false,
      statusCode: 409,
      error: `Illegal state transition from ${currentStatus} to ${targetStatus}.`,
    };
  }

  // Check role authorization
  if (!matchingRule.allowedRoles.includes(role)) {
    return {
      valid: false,
      statusCode: 403,
      error: `Role ${role} is not permitted to transition request from ${currentStatus} to ${targetStatus}. Allowed: ${matchingRule.allowedRoles.join(', ')}`,
    };
  }

  return {
    valid: true,
    statusCode: 200,
    rule: matchingRule,
  };
}

export function getAllowedNextStatuses(currentStatus: RequestStatus, role: Role): RequestStatus[] {
  return TRANSITION_RULES.filter(
    (rule) => rule.from === currentStatus && rule.allowedRoles.includes(role)
  ).map((rule) => rule.to);
}
