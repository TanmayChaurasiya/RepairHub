import { Role, RequestStatus, MechanicStatus, MechanicAvailability } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { rankMechanicsForRequest, MechanicCandidate } from '../assignment.js';
import { emitRequestUpdated, emitNotification } from '../socket.js';
import { emailService } from '../email/mailer.js';
import { logAudit } from '../audit/audit.service.js';
import { env } from '../../config/env.js';
import {
  deriveRequiredSkills,
  inferPowertrainFromVehicle,
  checkMechanicQualification,
} from '../qualification/qualification.service.js';

export interface ReassignParams {
  requestId: string;
  newMechanicId: string;
  reason: string;
  adminId: string;
  adminRole: Role;
  expectedUpdatedAt?: string;
}

export interface ReassignmentEligibilityResult {
  reassignmentAllowed: boolean;
  currentStatus: RequestStatus;
  currentMechanic: {
    id: string;
    name: string;
    email: string;
    phone: string;
    garageName: string;
  } | null;
  eligibleMechanics: any[];
  pendingReviewMechanics?: any[];
  disallowReason?: string;
  requiredSkills?: string[];
}

/**
 * Validates whether a request is currently eligible for mechanic reassignment.
 * Reassignment is strictly prohibited once the mechanic has started inspecting the vehicle.
 */
export async function getEligibleMechanicsForReassignment(
  requestId: string
): Promise<ReassignmentEligibilityResult> {
  const request = await prisma.repairRequest.findUnique({
    where: { id: requestId },
    include: {
      garage: true,
      vehicle: true,
      mechanic: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          mechanicProfile: {
            include: { garage: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!request) {
    throw new Error('Repair request not found');
  }

  const currentMechanic = request.mechanic
    ? {
        id: request.mechanic.id,
        name: request.mechanic.name,
        email: request.mechanic.email,
        phone: request.mechanic.phone,
        garageName: request.mechanic.mechanicProfile?.garage?.name || request.garage.name,
      }
    : null;

  // STRICT GUARD: Reassignment is ONLY permitted when status is ASSIGNED (or SUBMITTED).
  // Once the assigned mechanic commences inspection (INSPECTING), reassignment is blocked.
  if (request.status !== RequestStatus.ASSIGNED && request.status !== RequestStatus.SUBMITTED) {
    return {
      reassignmentAllowed: false,
      currentStatus: request.status,
      currentMechanic,
      eligibleMechanics: [],
      disallowReason: `Reassignment is strictly forbidden once vehicle inspection has commenced. Current request status is ${request.status}.`,
    };
  }

  // Derive required skills based on vehicle powertrain and issue
  const powertrain = inferPowertrainFromVehicle(request.vehicle);
  const skillAnalysis = await deriveRequiredSkills(request.category, powertrain, request.description);
  const requiredSkills =
    request.requiredSkills && request.requiredSkills.length > 0
      ? request.requiredSkills
      : skillAnalysis.requiredSkills;

  // Fetch all active, available mechanics in the platform
  const mechanics = await prisma.mechanicProfile.findMany({
    where: {
      status: MechanicStatus.ACTIVE,
      availability: MechanicAvailability.AVAILABLE,
      available: true,
    },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      garage: true,
    },
  });

  const activeStatuses: RequestStatus[] = [
    RequestStatus.ASSIGNED,
    RequestStatus.INSPECTING,
    RequestStatus.ESTIMATE_SENT,
    RequestStatus.APPROVED,
    RequestStatus.IN_PROGRESS,
    RequestStatus.QC,
  ];

  const pendingReviewMechanics: any[] = [];
  const qualifiedCandidates: any[] = [];

  for (const m of mechanics) {
    if (m.userId === request.mechanicId) continue; // Exclude currently assigned mechanic

    const qual = checkMechanicQualification(m, requiredSkills);
    if (qual.isPendingReview) {
      pendingReviewMechanics.push({
        mechanicId: m.userId,
        name: m.user.name,
        email: m.user.email,
        phone: m.user.phone,
        garageName: m.garage.name,
        garageCity: m.garage.city,
        skills: m.skills,
        skillsPendingReview: true,
      });
      continue;
    }

    if (!qual.isQualified) {
      // Unrelated/unqualified mechanic strictly excluded from eligible list
      continue;
    }

    const activeJobCount = await prisma.repairRequest.count({
      where: {
        mechanicId: m.userId,
        status: { in: activeStatuses },
      },
    });

    const score = m.rating * 1.0 - activeJobCount * 0.5;

    qualifiedCandidates.push({
      mechanicId: m.userId,
      name: m.user.name,
      email: m.user.email,
      phone: m.user.phone,
      rating: m.rating,
      skills: m.skills,
      garageId: m.garage.id,
      garageName: m.garage.name,
      garageCity: m.garage.city,
      specialization: m.specialization,
      experienceYears: m.experienceYears,
      activeJobCount,
      score,
      scoreBreakdown: { baseRating: m.rating, workloadPenalty: activeJobCount * 0.5 },
      reasons: [
        `Verified qualified in: ${requiredSkills.join(', ')}`,
        `Rating: ${m.rating.toFixed(1)} / 5.0`,
        `Active jobs: ${activeJobCount}`,
      ],
      availability: m.availability,
    });
  }

  qualifiedCandidates.sort((a, b) => b.score - a.score);

  return {
    reassignmentAllowed: true,
    currentStatus: request.status,
    currentMechanic,
    eligibleMechanics: qualifiedCandidates,
    pendingReviewMechanics,
    requiredSkills,
  };
}

/**
 * Reassigns an assigned mechanic with concurrency control, transaction safety,
 * assignment history recording, audit logging, and dual-mechanic notifications.
 */
export async function executeMechanicReassignment({
  requestId,
  newMechanicId,
  reason,
  adminId,
  adminRole,
  expectedUpdatedAt,
}: ReassignParams) {
  if (!reason || reason.trim().length < 5) {
    throw new Error('A detailed reassignment reason (minimum 5 characters) is required.');
  }

  // 1. Fetch current request state
  const request = await prisma.repairRequest.findUnique({
    where: { id: requestId },
    include: {
      garage: true,
      vehicle: true,
      customer: { select: { id: true, name: true, email: true } },
      mechanic: { select: { id: true, name: true, email: true } },
    },
  });

  if (!request) {
    throw new Error('Repair request not found.');
  }

  // 2. Strict inspection status check
  if (request.status !== RequestStatus.ASSIGNED && request.status !== RequestStatus.SUBMITTED) {
    const error: any = new Error(
      `Reassignment is strictly forbidden once vehicle inspection has commenced. Current request status: ${request.status}`
    );
    error.statusCode = 409;
    throw error;
  }

  // 3. Stale update / Concurrency prevention check
  if (expectedUpdatedAt) {
    const currentTimestamp = request.updatedAt.toISOString();
    if (currentTimestamp !== expectedUpdatedAt) {
      const error: any = new Error(
        'Concurrent modification detected: The request was updated by another user or process. Please reload and try again.'
      );
      error.statusCode = 409;
      throw error;
    }
  }

  // 4. Validate new mechanic
  if (request.mechanicId === newMechanicId) {
    const error: any = new Error('The selected mechanic is already assigned to this request.');
    error.statusCode = 400;
    throw error;
  }

  const newMechanicUser = await prisma.user.findFirst({
    where: { id: newMechanicId, role: Role.MECHANIC },
    include: { mechanicProfile: { include: { garage: true } } },
  });

  if (!newMechanicUser || !newMechanicUser.mechanicProfile) {
    const error: any = new Error('Target mechanic was not found or lacks a valid mechanic profile.');
    error.statusCode = 404;
    throw error;
  }

  if (newMechanicUser.mechanicProfile.status !== MechanicStatus.ACTIVE) {
    const error: any = new Error('Target mechanic is not in ACTIVE standing.');
    error.statusCode = 400;
    throw error;
  }

  if (newMechanicUser.mechanicProfile.availability !== MechanicAvailability.AVAILABLE) {
    const error: any = new Error(
      `Target mechanic is currently ${newMechanicUser.mechanicProfile.availability} and cannot accept new assignments.`
    );
    error.statusCode = 400;
    throw error;
  }

  // 4b. Verify mechanic qualification for the vehicle and reported problem
  const powertrain = inferPowertrainFromVehicle(request.vehicle);
  const skillAnalysis = await deriveRequiredSkills(request.category, powertrain, request.description);
  const requiredSkills =
    request.requiredSkills && request.requiredSkills.length > 0
      ? request.requiredSkills
      : skillAnalysis.requiredSkills;

  const qual = checkMechanicQualification(newMechanicUser.mechanicProfile, requiredSkills);
  if (!qual.isQualified) {
    const error: any = new Error(
      `Target mechanic does not possess the required repair skills: ${requiredSkills.join(', ')}. (Missing: ${qual.missingSkills.join(', ')})`
    );
    error.statusCode = 400;
    throw error;
  }

  const previousMechanicId = request.mechanicId;
  const previousMechanicName = request.mechanic?.name || 'Unassigned';
  const newMechanicName = newMechanicUser.name;

  // 5. Atomic database transaction
  const result = await prisma.$transaction(async (tx) => {
    // A. Update the RepairRequest
    const updatedRequest = await tx.repairRequest.update({
      where: { id: requestId },
      data: {
        mechanicId: newMechanicId,
        garageId: newMechanicUser.mechanicProfile?.garageId || request.garageId,
        status: RequestStatus.ASSIGNED, // Keep in ASSIGNED state
        eligibilityStatus: 'QUALIFIED_AND_FREE',
        unavailabilityReason: null,
      },
      include: {
        garage: true,
        vehicle: true,
        customer: { select: { id: true, name: true, email: true, phone: true } },
        mechanic: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    // B. Create complete AssignmentHistory entry
    const assignmentHistory = await tx.assignmentHistory.create({
      data: {
        requestId,
        previousMechanicId,
        newMechanicId,
        assignedById: adminId,
        assignedByRole: adminRole,
        action: 'REASSIGNED',
        checkResult: 'PASS',
        reason: reason.trim(),
      },
    });

    // C. Record StatusHistory transition
    await tx.statusHistory.create({
      data: {
        requestId,
        fromStatus: request.status,
        toStatus: RequestStatus.ASSIGNED,
        actorId: adminId,
        actorRole: adminRole,
        note: `Mechanic reassigned from ${previousMechanicName} to ${newMechanicName}. Reason: ${reason.trim()}`,
      },
    });

    // D. Log immutable system audit event
    await tx.auditLog.create({
      data: {
        actorId: adminId,
        actorRole: adminRole,
        action: 'MECHANIC_REASSIGNED',
        targetEntity: 'RepairRequest',
        targetId: requestId,
        metadata: {
          requestNumber: request.requestNumber,
          previousMechanicId,
          previousMechanicName,
          newMechanicId,
          newMechanicName,
          reason: reason.trim(),
          assignmentHistoryId: assignmentHistory.id,
        },
      },
    });

    return { updatedRequest, assignmentHistory };
  });

  // 6. Broadcast Real-Time Socket.IO events
  emitRequestUpdated(requestId, result.updatedRequest);

  // Notify Previous Mechanic
  if (previousMechanicId) {
    emitNotification(previousMechanicId, {
      type: 'MECHANIC_UNASSIGNED',
      title: 'Reassignment Notice',
      message: `You were unassigned from Request #${request.requestNumber} (${request.vehicle.make} ${request.vehicle.model}). Reason: ${reason}`,
      requestId,
    });
  }

  // Notify New Mechanic
  emitNotification(newMechanicId, {
    type: 'MECHANIC_ASSIGNED',
    title: 'New Service Job Assigned',
    message: `You have been assigned to inspect Request #${request.requestNumber} (${request.vehicle.make} ${request.vehicle.model}).`,
    requestId,
  });

  // Notify Customer
  emitNotification(request.customerId, {
    type: 'MECHANIC_ASSIGNMENT_UPDATED',
    title: 'Technician Update',
    message: `Your vehicle repair request #${request.requestNumber} has been assigned to certified technician ${newMechanicName}.`,
    requestId,
  });

  // 7. Dispatch Email Notifications asynchronously
  const frontendUrl = env.FRONTEND_URL || 'http://localhost:3000';

  // Email to previous mechanic
  if (request.mechanic?.email) {
    emailService
      .sendGenericEmail({
        to: request.mechanic.email,
        subject: `Update: Unassigned from Repair Job #${request.requestNumber}`,
        html: `
          <div style="font-family: sans-serif; background: #0B1729; color: #FFFFFF; padding: 24px; border-radius: 8px;">
            <h2 style="color: #F97316;">Assignment Update</h2>
            <p>Hello <strong>${previousMechanicName}</strong>,</p>
            <p>Master Admin has reassigned vehicle repair request <strong>#${request.requestNumber}</strong> (<em>${request.vehicle.make} ${request.vehicle.model}</em>) to another technician.</p>
            <p><strong>Reason provided:</strong></p>
            <blockquote style="background: #1E293B; border-left: 4px solid #F97316; padding: 12px; margin: 16px 0;">
              ${reason}
            </blockquote>
            <p>This booking has been removed from your active jobs list.</p>
          </div>
        `,
      })
      .catch((err) => console.error('[REASSIGNMENT EMAIL] Error emailing previous mechanic:', err?.message));
  }

  // Email to newly assigned mechanic
  if (newMechanicUser.email) {
    emailService
      .sendGenericEmail({
        to: newMechanicUser.email,
        subject: `New Job Assigned: Repair Request #${request.requestNumber}`,
        html: `
          <div style="font-family: sans-serif; background: #0B1729; color: #FFFFFF; padding: 24px; border-radius: 8px;">
            <h2 style="color: #10B981;">New Repair Assignment</h2>
            <p>Hello <strong>${newMechanicName}</strong>,</p>
            <p>You have been assigned to service vehicle repair request <strong>#${request.requestNumber}</strong>.</p>
            <p><strong>Vehicle:</strong> ${request.vehicle.year} ${request.vehicle.make} ${request.vehicle.model} (${request.vehicle.regNo})<br>
            <strong>Category:</strong> ${request.category}<br>
            <strong>Problem:</strong> ${request.description}</p>
            <div style="margin: 24px 0;">
              <a href="${frontendUrl}/mechanic/jobs/${requestId}" style="background: #F97316; color: #FFFFFF; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                View Job &amp; Begin Inspection &rarr;
              </a>
            </div>
          </div>
        `,
      })
      .catch((err) => console.error('[REASSIGNMENT EMAIL] Error emailing new mechanic:', err?.message));
  }

  return result;
}

/**
 * Returns complete assignment history for a given request
 */
export async function getRequestAssignmentHistory(requestId: string) {
  return prisma.assignmentHistory.findMany({
    where: { requestId },
    include: {
      previousMechanic: { select: { id: true, name: true, email: true, phone: true } },
      newMechanic: { select: { id: true, name: true, email: true, phone: true } },
      assignedBy: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Returns platform-wide assignment history with search and pagination
 */
export async function listAllAssignmentHistories({
  page = 1,
  limit = 20,
  search = '',
}: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  const skip = (page - 1) * limit;

  const where: any = {};
  if (search && search.trim() !== '') {
    where.OR = [
      { request: { requestNumber: { contains: search, mode: 'insensitive' } } },
      { request: { vehicle: { regNo: { contains: search, mode: 'insensitive' } } } },
      { request: { vehicle: { make: { contains: search, mode: 'insensitive' } } } },
      { request: { vehicle: { model: { contains: search, mode: 'insensitive' } } } },
      { previousMechanic: { name: { contains: search, mode: 'insensitive' } } },
      { newMechanic: { name: { contains: search, mode: 'insensitive' } } },
      { reason: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, histories] = await Promise.all([
    prisma.assignmentHistory.count({ where }),
    prisma.assignmentHistory.findMany({
      where,
      skip,
      take: limit,
      include: {
        request: {
          select: {
            id: true,
            requestNumber: true,
            category: true,
            status: true,
            vehicle: { select: { id: true, make: true, model: true, regNo: true, type: true } },
            garage: { select: { id: true, name: true, city: true } },
            customer: { select: { id: true, name: true, email: true } },
          },
        },
        previousMechanic: { select: { id: true, name: true, email: true, phone: true } },
        newMechanic: { select: { id: true, name: true, email: true, phone: true } },
        assignedBy: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    histories,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}
