import { Response, NextFunction } from 'express';
import { Role, RequestStatus, EstimateStatus, MechanicAvailability } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { AuthenticatedRequest } from '../../types/index.js';
import { validateTransition } from '../../services/stateMachine.js';
import { rankMechanicsForRequest, MechanicCandidate } from '../../services/assignment.js';
import { emitRequestUpdated, emitMechanicAvailabilityUpdated, emitRequestLocationUpdated } from '../../services/socket.js';
import { storageProvider } from '../../services/storage/index.js';
import {
  deriveRequiredSkills,
  inferPowertrainFromVehicle,
  verifyGarageEligibility,
  findBestEligibleGarageAndMechanic,
  assignMechanicTransactionally,
  sendVerifiedServiceOutcomeEmail,
} from '../../services/qualification/qualification.service.js';

export async function createRequest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { vehicleId, garageId, category, description, photos } = req.body;

    // Verify vehicle belongs to customer (unless admin creating on behalf)
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    if (req.user.role === Role.CUSTOMER && vehicle.customerId !== req.user.userId) {
      res.status(403).json({ error: 'Access denied. You do not own this vehicle.' });
      return;
    }

    // Verify garage exists
    const garage = await prisma.garage.findUnique({ where: { id: garageId } });
    if (!garage) {
      res.status(404).json({ error: 'Selected garage not found.' });
      return;
    }

    // Generate requestNumber: REQ-2026-XXXX
    const count = await prisma.repairRequest.count();
    const requestNumber = `REQ-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    // 1. Intake: Infer powertrain and derive required skills dynamically from editable table
    const powertrain = inferPowertrainFromVehicle(vehicle);
    const skillAnalysis = await deriveRequiredSkills(category, powertrain, description);
    const requiredSkills = skillAnalysis.requiredSkills;

    // 2. Initial verification of target garage (status, vehicle support, skill match, availability)
    const garageVerification = await verifyGarageEligibility({
      garageId,
      vehicleType: vehicle.type,
      powertrain,
      requiredSkills,
    });

    let assignedMechanicId: string | null = null;
    let initialStatus: RequestStatus = RequestStatus.SUBMITTED;
    let eligibilityStatus = garageVerification.eligibilityStatus;
    let unavailabilityReason: string | null = garageVerification.unavailabilityReason || null;
    let effectiveGarageId = garageId;
    let estimatedWaitMinutes = 0;

    // 3. Fallback search if target garage is closed, unapproved, unsupported, or has no qualified free mechanics
    if (
      garageVerification.eligibilityStatus === 'QUALIFIED_AND_FREE' &&
      garageVerification.qualifiedFreeMechanics.length > 0
    ) {
      assignedMechanicId = garageVerification.qualifiedFreeMechanics[0].mechanicId;
      initialStatus = RequestStatus.ASSIGNED;
      unavailabilityReason = null;
    } else {
      // Execute fallback search across network
      const fallback = await findBestEligibleGarageAndMechanic({
        vehicleType: vehicle.type,
        powertrain,
        requiredSkills,
        preferredGarageId: garageId,
      });

      if (fallback.overallStatus === 'QUALIFIED_AND_FREE' && fallback.selectedMechanic) {
        effectiveGarageId = fallback.selectedMechanic.garageId;
        assignedMechanicId = fallback.selectedMechanic.mechanicId;
        initialStatus = RequestStatus.ASSIGNED;
        eligibilityStatus = 'QUALIFIED_AND_FREE';
        unavailabilityReason = null;
      } else {
        eligibilityStatus = fallback.overallStatus;
        unavailabilityReason = fallback.unavailabilityReason;
        if (fallback.overallStatus === 'CURRENTLY_BUSY') {
          estimatedWaitMinutes = 45;
        }
      }
    }

    const newRequest = await prisma.repairRequest.create({
      data: {
        requestNumber,
        customerId: req.user.userId,
        vehicleId,
        garageId: effectiveGarageId,
        mechanicId: assignedMechanicId,
        category,
        description,
        photos: photos || [],
        status: initialStatus,
        eligibilityStatus,
        unavailabilityReason,
        requiredSkills,
        estimatedWaitMinutes: estimatedWaitMinutes > 0 ? estimatedWaitMinutes : null,
        statusHistory: {
          create: {
            fromStatus: null,
            toStatus: initialStatus,
            actorId: req.user.userId,
            actorRole: req.user.role,
            note: assignedMechanicId
              ? `Repair request submitted and allocated to qualified specialist`
              : `Repair request submitted (${eligibilityStatus}: ${unavailabilityReason})`,
          },
        },
      },
      include: FULL_REQUEST_INCLUDE,
    });

    // If a mechanic was assigned, atomically update mechanic state & log assignment history
    if (assignedMechanicId) {
      await prisma.mechanicProfile.updateMany({
        where: { userId: assignedMechanicId },
        data: { availability: MechanicAvailability.BUSY, available: false },
      });

      await prisma.assignmentHistory.create({
        data: {
          requestId: newRequest.id,
          previousMechanicId: null,
          newMechanicId: assignedMechanicId,
          assignedById: req.user.userId,
          assignedByRole: req.user.role,
          action: 'ASSIGNED',
          checkResult: 'PASS',
          reason: `Initial verified qualified allocation for skills: ${requiredSkills.join(', ')}`,
        },
      });

      // Send Template 1: MECHANIC_AVAILABLE
      sendVerifiedServiceOutcomeEmail({
        requestId: newRequest.id,
        customerId: req.user.userId,
        status: 'QUALIFIED_AND_FREE',
        assignedMechanic: {
          name: newRequest.mechanic?.name || 'Assigned Specialist',
          garageName: newRequest.garage.name,
          skills: requiredSkills,
        },
      }).catch((e) => console.error('[EMAIL ERROR]', e));
    } else {
      // Log check result in AssignmentHistory
      await prisma.assignmentHistory.create({
        data: {
          requestId: newRequest.id,
          previousMechanicId: null,
          newMechanicId: null,
          assignedById: req.user.userId,
          assignedByRole: req.user.role,
          action: 'UNAVAILABILITY_LOGGED',
          checkResult: eligibilityStatus === 'CURRENTLY_BUSY' ? 'FAIL_BUSY' : 'FAIL_NO_QUALIFIED',
          reason: unavailabilityReason || 'No qualified specialist currently available',
        },
      });

      // Send Template 2 (Currently Busy) or Template 3 (No Qualified Mechanic Available)
      sendVerifiedServiceOutcomeEmail({
        requestId: newRequest.id,
        customerId: req.user.userId,
        status: eligibilityStatus === 'CURRENTLY_BUSY' ? 'CURRENTLY_BUSY' : 'NO_QUALIFIED_MECHANIC',
        unavailabilityReason: unavailabilityReason || undefined,
        estimatedWaitMinutes: 45,
      }).catch((e) => console.error('[EMAIL ERROR]', e));
    }

    emitRequestUpdated(newRequest.id, newRequest);

    res.status(201).json({
      message: 'Repair request created successfully',
      request: newRequest,
    });
  } catch (err) {
    next(err);
  }
}

export async function listRequests(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { status, category, search } = req.query;

    const where: any = {};

    // Role-based visibility isolation:
    if (req.user.role === Role.CUSTOMER) {
      where.customerId = req.user.userId;
    } else if (req.user.role === Role.MECHANIC) {
      where.mechanicId = req.user.userId;
    }

    if (status && Object.values(RequestStatus).includes(status as RequestStatus)) {
      where.status = status as RequestStatus;
    }

    if (category) {
      where.category = category;
    }

    if (search) {
      const q = String(search).trim();
      where.OR = [
        { requestNumber: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { vehicle: { regNo: { contains: q, mode: 'insensitive' } } },
        { vehicle: { make: { contains: q, mode: 'insensitive' } } },
        { vehicle: { model: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const requests = await prisma.repairRequest.findMany({
      where,
      include: {
        vehicle: true,
        garage: true,
        mechanic: { select: { id: true, name: true, phone: true } },
        customer: { select: { id: true, name: true, phone: true, email: true } },
        estimates: {
          orderBy: { version: 'desc' },
          take: 1,
        },
        invoice: true,
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ requests });
  } catch (err) {
    next(err);
  }
}

export const FULL_REQUEST_INCLUDE = {
  vehicle: true,
  garage: true,
  customer: { select: { id: true, name: true, email: true, phone: true } },
  mechanic: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      mechanicProfile: true,
    },
  },
  statusHistory: {
    orderBy: { createdAt: 'asc' as const },
    include: { actor: { select: { id: true, name: true, role: true } } },
  },
  estimates: {
    orderBy: { version: 'desc' as const },
    include: {
      items: { orderBy: { kind: 'asc' as const } },
    },
  },
  invoice: {
    include: { payment: true },
  },
  payment: true,
  review: true,
  complaints: {
    orderBy: { createdAt: 'desc' as const },
    include: { resolvedBy: { select: { id: true, name: true } } },
  },
  assignmentHistories: {
    orderBy: { createdAt: 'desc' as const },
    include: {
      previousMechanic: { select: { id: true, name: true, email: true } },
      newMechanic: { select: { id: true, name: true, email: true } },
      assignedBy: { select: { id: true, name: true, role: true } },
    },
  },
};

export async function getRequestById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    const request = await prisma.repairRequest.findUnique({
      where: { id },
      include: FULL_REQUEST_INCLUDE,
    });

    if (!request) {
      res.status(404).json({ error: 'Repair request not found' });
      return;
    }

    // Role-based authorization & ownership check:
    if (req.user.role === Role.CUSTOMER && request.customerId !== req.user.userId) {
      res.status(403).json({ error: 'Access denied. You cannot view another customer’s request.' });
      return;
    }

    if (req.user.role === Role.MECHANIC && request.mechanicId !== req.user.userId) {
      res.status(403).json({ error: 'Access denied. This job is not assigned to you.' });
      return;
    }

    res.json({ request });
  } catch (err) {
    next(err);
  }
}

export async function getMechanicSuggestions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const request = await prisma.repairRequest.findUnique({
      where: { id },
      include: { garage: true, vehicle: true },
    });

    if (!request) {
      res.status(404).json({ error: 'Repair request not found' });
      return;
    }

    const powertrain = inferPowertrainFromVehicle(request.vehicle);
    const skillAnalysis = await deriveRequiredSkills(request.category, powertrain, request.description);
    const requiredSkills =
      request.requiredSkills && request.requiredSkills.length > 0
        ? request.requiredSkills
        : skillAnalysis.requiredSkills;

    // Verify selected garage
    const targetGarageVerification = await verifyGarageEligibility({
      garageId: request.garageId,
      vehicleType: request.vehicle.type,
      powertrain,
      requiredSkills,
    });

    // Run fallback search across other approved garages
    const fallbackAnalysis = await findBestEligibleGarageAndMechanic({
      vehicleType: request.vehicle.type,
      powertrain,
      requiredSkills,
      preferredGarageId: request.garageId,
    });

    // Format suggestions
    const suggestions = targetGarageVerification.qualifiedFreeMechanics.map((m, idx) => ({
      mechanicId: m.mechanicId,
      name: m.name,
      rating: m.rating,
      activeJobCount: m.activeJobCount,
      score: m.rating * 1.0 - m.activeJobCount * 0.5,
      scoreBreakdown: { baseRating: m.rating, workloadPenalty: m.activeJobCount * 0.5 },
      reasons: [
        `Verified qualified in: ${requiredSkills.join(', ')}`,
        `Rating: ${m.rating.toFixed(1)} / 5.0`,
        `Active jobs: ${m.activeJobCount}`,
      ],
      garageName: m.garageName,
    }));

    res.json({
      requestId: request.id,
      requestCategory: request.category,
      powertrain,
      requiredSkills,
      city: request.garage.city,
      eligibilityStatus: targetGarageVerification.eligibilityStatus,
      unavailabilityReason:
        targetGarageVerification.unavailabilityReason || fallbackAnalysis.unavailabilityReason,
      targetGarage: {
        id: request.garage.id,
        name: request.garage.name,
        verification: targetGarageVerification,
      },
      suggestions,
      qualifiedFreeMechanics: targetGarageVerification.qualifiedFreeMechanics,
      qualifiedBusyMechanics: targetGarageVerification.qualifiedBusyMechanics,
      allGarageResults: fallbackAnalysis.allGarageResults,
    });
  } catch (err) {
    next(err);
  }
}

export async function assignMechanic(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { mechanicId, autoAssign, note } = req.body;

    const request = await prisma.repairRequest.findUnique({
      where: { id },
      include: { garage: true, vehicle: true },
    });

    if (!request) {
      res.status(404).json({ error: 'Repair request not found' });
      return;
    }

    // Transition validation
    const validation = validateTransition(request.status, RequestStatus.ASSIGNED, req.user.role);
    if (!validation.valid) {
      res.status(validation.statusCode).json({ error: validation.error });
      return;
    }

    const powertrain = inferPowertrainFromVehicle(request.vehicle);
    const skillAnalysis = await deriveRequiredSkills(request.category, powertrain, request.description);
    const requiredSkills =
      request.requiredSkills && request.requiredSkills.length > 0
        ? request.requiredSkills
        : skillAnalysis.requiredSkills;

    let targetMechanicId = mechanicId;

    if (autoAssign) {
      const fallbackAnalysis = await findBestEligibleGarageAndMechanic({
        vehicleType: request.vehicle.type,
        powertrain,
        requiredSkills,
        preferredGarageId: request.garageId,
      });

      if (fallbackAnalysis.overallStatus !== 'QUALIFIED_AND_FREE' || !fallbackAnalysis.selectedMechanic) {
        res.status(400).json({
          error:
            fallbackAnalysis.unavailabilityReason ||
            'No qualified, free technician matching required skills found for auto-assignment.',
          eligibilityStatus: fallbackAnalysis.overallStatus,
        });
        return;
      }

      targetMechanicId = fallbackAnalysis.selectedMechanic.mechanicId;
    }

    if (!targetMechanicId) {
      res.status(400).json({ error: 'mechanicId or autoAssign must be provided.' });
      return;
    }

    // Execute transactional assignment with atomic recheck (double-booking prevention)
    const assignmentResult = await assignMechanicTransactionally({
      requestId: id,
      targetMechanicId,
      garageId: request.garageId,
      assignedById: req.user.userId,
      assignedByRole: req.user.role,
      reason: note || 'Master Admin manual mechanic allocation',
      requiredSkills,
    });

    if (!assignmentResult.success) {
      res.status(409).json({
        error:
          assignmentResult.unavailabilityReason ||
          'Mechanic could not be assigned due to concurrent booking or capacity constraints.',
        eligibilityStatus: assignmentResult.eligibilityStatus,
      });
      return;
    }

    const fullUpdated = await prisma.repairRequest.findUnique({
      where: { id },
      include: FULL_REQUEST_INCLUDE,
    });

    if (fullUpdated) {
      emitRequestUpdated(id, fullUpdated);
    }

    // Send Template 1: MECHANIC_AVAILABLE email after verified assignment
    sendVerifiedServiceOutcomeEmail({
      requestId: id,
      customerId: request.customerId,
      status: 'QUALIFIED_AND_FREE',
      assignedMechanic: {
        name: fullUpdated?.mechanic?.name || 'Assigned Specialist',
        garageName: fullUpdated?.garage?.name || request.garage.name,
        skills: requiredSkills,
      },
    }).catch((e) => console.error('[EMAIL ERROR]', e));

    res.json({
      message: `Mechanic assigned successfully.`,
      request: fullUpdated,
    });
  } catch (err) {
    next(err);
  }
}



export async function transitionStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { targetStatus, note } = req.body;

    const request = await prisma.repairRequest.findUnique({
      where: { id },
      include: {
        estimates: {
          orderBy: { version: 'desc' },
        },
      },
    });

    if (!request) {
      res.status(404).json({ error: 'Repair request not found' });
      return;
    }

    // Ownership check for transitions
    if (req.user.role === Role.MECHANIC && request.mechanicId !== req.user.userId) {
      res.status(403).json({ error: 'You can only update status for jobs assigned to you.' });
      return;
    }
    if (req.user.role === Role.CUSTOMER && request.customerId !== req.user.userId) {
      res.status(403).json({ error: 'You can only update status for your own vehicle requests.' });
      return;
    }

    // Validate state machine rule
    const validation = validateTransition(request.status, targetStatus, req.user.role);
    if (!validation.valid) {
      res.status(validation.statusCode).json({ error: validation.error });
      return;
    }

    // Strict Rule: Work (IN_PROGRESS) can NEVER start until customer approves the estimate
    if (targetStatus === RequestStatus.IN_PROGRESS) {
      const approvedEstimate = request.estimates.find((e) => e.status === EstimateStatus.APPROVED);
      if (!approvedEstimate) {
        res.status(409).json({
          error: 'Work cannot begin until the customer approves the estimate.',
        });
        return;
      }
    }

    // If moving to COMPLETED, ensure an Invoice is generated if not already existing
    let invoiceCreated = false;
    const approvedEstimate = request.estimates.find((e) => e.status === EstimateStatus.APPROVED);

    const updated = await prisma.repairRequest.update({
      where: { id },
      data: {
        status: targetStatus,
        statusHistory: {
          create: {
            fromStatus: request.status,
            toStatus: targetStatus,
            actorId: req.user.userId,
            actorRole: req.user.role,
            note: note || `Status transitioned to ${targetStatus}`,
          },
        },
      },
      include: {
        invoice: true,
      },
    });

    if (targetStatus === RequestStatus.COMPLETED && !updated.invoice && approvedEstimate) {
      const invCount = await prisma.invoice.count();
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invCount + 1).padStart(4, '0')}`;

      await prisma.invoice.create({
        data: {
          requestId: updated.id,
          invoiceNumber,
          totalPaise: approvedEstimate.totalPaise,
        },
      });
      invoiceCreated = true;
    }

    const finalRequest = await prisma.repairRequest.findUnique({
      where: { id },
      include: FULL_REQUEST_INCLUDE,
    });

    // Lifecycle Availability Automation:
    // 1. If mechanic began INSPECTING or IN_PROGRESS, mark mechanic BUSY
    if (
      (targetStatus === RequestStatus.INSPECTING || targetStatus === RequestStatus.IN_PROGRESS) &&
      finalRequest?.mechanicId
    ) {
      const mechProfile = await prisma.mechanicProfile.findUnique({
        where: { userId: finalRequest.mechanicId },
      });
      if (mechProfile && mechProfile.availability === MechanicAvailability.AVAILABLE) {
        await prisma.mechanicProfile.update({
          where: { id: mechProfile.id },
          data: {
            availability: MechanicAvailability.BUSY,
            available: false,
            lastActiveAt: new Date(),
          },
        });
        emitMechanicAvailabilityUpdated({
          mechanicId: finalRequest.mechanicId,
          availability: MechanicAvailability.BUSY,
          available: false,
        });
      }
    }

    // 2. If request reached COMPLETED, PAID, or CANCELLED, check if mechanic has other active jobs
    if (
      (targetStatus === RequestStatus.COMPLETED ||
        targetStatus === RequestStatus.PAID ||
        targetStatus === RequestStatus.CANCELLED) &&
      finalRequest?.mechanicId
    ) {
      const remainingActiveJobs = await prisma.repairRequest.count({
        where: {
          mechanicId: finalRequest.mechanicId,
          id: { not: finalRequest.id },
          status: {
            in: [
              RequestStatus.ASSIGNED,
              RequestStatus.INSPECTING,
              RequestStatus.ESTIMATE_SENT,
              RequestStatus.APPROVED,
              RequestStatus.IN_PROGRESS,
              RequestStatus.QC,
            ],
          },
        },
      });

      if (remainingActiveJobs === 0) {
        const mechProfile = await prisma.mechanicProfile.findUnique({
          where: { userId: finalRequest.mechanicId },
        });
        // Only auto-revert if they were marked BUSY (do not override explicit ON_BREAK or OFFLINE)
        if (mechProfile && mechProfile.availability === MechanicAvailability.BUSY) {
          await prisma.mechanicProfile.update({
            where: { id: mechProfile.id },
            data: {
              availability: MechanicAvailability.AVAILABLE,
              available: true,
              lastActiveAt: new Date(),
            },
          });
          emitMechanicAvailabilityUpdated({
            mechanicId: finalRequest.mechanicId,
            availability: MechanicAvailability.AVAILABLE,
            available: true,
          });
        }
      }
    }

    if (finalRequest) {
      emitRequestUpdated(id, finalRequest);
    }

    res.json({
      message: `Status updated to ${targetStatus}${invoiceCreated ? ' (Invoice generated)' : ''}`,
      request: finalRequest,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateDiagnosis(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { diagnosis } = req.body;

    const request = await prisma.repairRequest.findUnique({ where: { id } });
    if (!request) {
      res.status(404).json({ error: 'Repair request not found' });
      return;
    }

    if (request.mechanicId !== req.user.userId) {
      res.status(403).json({ error: 'Only the assigned mechanic can record diagnosis.' });
      return;
    }

    await prisma.repairRequest.update({
      where: { id },
      data: { diagnosis },
    });

    const fullRequest = await prisma.repairRequest.findUnique({
      where: { id },
      include: FULL_REQUEST_INCLUDE,
    });

    if (fullRequest) {
      emitRequestUpdated(id, fullRequest);
    }

    res.json({
      message: 'Diagnosis recorded successfully',
      diagnosis,
      request: fullRequest,
    });
  } catch (err) {
    next(err);
  }
}

export async function uploadRequestPhotos(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No files provided for upload.' });
      return;
    }

    const uploadedUrls: string[] = [];
    for (const file of files) {
      const url = await storageProvider.uploadFile(file);
      uploadedUrls.push(url);
    }

    const request = await prisma.repairRequest.findUnique({ where: { id } });
    if (!request) {
      res.status(404).json({ error: 'Repair request not found' });
      return;
    }

    const updated = await prisma.repairRequest.update({
      where: { id },
      data: {
        photos: [...request.photos, ...uploadedUrls],
      },
    });

    res.json({ message: 'Photos uploaded successfully', photos: updated.photos });
  } catch (err) {
    next(err);
  }
}

export async function updateMechanicLocation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { latitude, longitude } = req.body;

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      res.status(400).json({ error: 'Valid numeric latitude and longitude are required.' });
      return;
    }

    const request = await prisma.repairRequest.findUnique({
      where: { id },
      include: {
        garage: true,
        mechanic: { select: { id: true, name: true, phone: true } },
      },
    });

    if (!request) {
      res.status(404).json({ error: 'Repair request not found' });
      return;
    }

    if (req.user.role !== Role.ADMIN && request.mechanicId !== req.user.userId) {
      res.status(403).json({ error: 'Only the assigned mechanic or admin can update location.' });
      return;
    }

    // Update mechanic profile location
    if (request.mechanicId) {
      await prisma.mechanicProfile.updateMany({
        where: { userId: request.mechanicId },
        data: {
          latitude,
          longitude,
          lastActiveAt: new Date(),
        },
      });
    }

    // Calculate distance and ETA to garage
    const gLat = request.garage.latitude ?? 26.4735;
    const gLon = request.garage.longitude ?? 80.3075;

    const R = 6371;
    const dLat = ((gLat - latitude) * Math.PI) / 180;
    const dLon = ((gLon - longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((latitude * Math.PI) / 180) *
        Math.cos((gLat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const remainingDistanceKm = Math.round(R * c * 10) / 10;
    const etaMinutes = Math.max(2, Math.round((remainingDistanceKm / 30) * 60));

    emitRequestLocationUpdated(id, {
      requestId: id,
      latitude,
      longitude,
      remainingDistanceKm,
      etaMinutes,
      updatedAt: new Date(),
    });

    res.json({
      success: true,
      latitude,
      longitude,
      remainingDistanceKm,
      etaMinutes,
    });
  } catch (err) {
    next(err);
  }
}
