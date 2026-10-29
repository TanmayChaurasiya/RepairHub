import { Response, NextFunction } from 'express';
import { Role, RequestStatus, EstimateStatus } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { AuthenticatedRequest } from '../../types/index.js';
import { validateTransition } from '../../services/stateMachine.js';
import { rankMechanicsForRequest, MechanicCandidate } from '../../services/assignment.js';
import { emitRequestUpdated } from '../../services/socket.js';
import { storageProvider } from '../../services/storage/index.js';

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

    const newRequest = await prisma.repairRequest.create({
      data: {
        requestNumber,
        customerId: req.user.userId,
        vehicleId,
        garageId,
        category,
        description,
        photos: photos || [],
        status: RequestStatus.SUBMITTED,
        statusHistory: {
          create: {
            fromStatus: null,
            toStatus: RequestStatus.SUBMITTED,
            actorId: req.user.userId,
            actorRole: req.user.role,
            note: 'Repair request submitted by vehicle owner',
          },
        },
      },
      include: FULL_REQUEST_INCLUDE,
    });

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
      include: { garage: true },
    });

    if (!request) {
      res.status(404).json({ error: 'Repair request not found' });
      return;
    }

    // Fetch all mechanics
    const mechanics = await prisma.mechanicProfile.findMany({
      include: {
        user: { select: { id: true, name: true } },
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

    const candidates: MechanicCandidate[] = await Promise.all(
      mechanics.map(async (m) => {
        const activeJobCount = await prisma.repairRequest.count({
          where: {
            mechanicId: m.userId,
            status: { in: activeStatuses },
          },
        });

        return {
          id: m.userId,
          name: m.user.name,
          rating: m.rating,
          skills: m.skills,
          available: m.available,
          garageVerified: m.garage.isVerified,
          garageCity: m.garage.city,
          activeJobCount,
        };
      })
    );

    const suggestions = rankMechanicsForRequest(request.category, candidates, request.garage.city);

    res.json({
      requestCategory: request.category,
      city: request.garage.city,
      suggestions,
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
      include: { garage: true },
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

    let targetMechanicId = mechanicId;

    if (autoAssign) {
      // Find candidate mechanics and pick the top ranked one
      const mechanics = await prisma.mechanicProfile.findMany({
        include: {
          user: { select: { id: true, name: true } },
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

      const candidates: MechanicCandidate[] = await Promise.all(
        mechanics.map(async (m) => {
          const activeJobCount = await prisma.repairRequest.count({
            where: {
              mechanicId: m.userId,
              status: { in: activeStatuses },
            },
          });

          return {
            id: m.userId,
            name: m.user.name,
            rating: m.rating,
            skills: m.skills,
            available: m.available,
            garageVerified: m.garage.isVerified,
            garageCity: m.garage.city,
            activeJobCount,
          };
        })
      );

      const suggestions = rankMechanicsForRequest(request.category, candidates, request.garage.city);
      if (suggestions.length === 0) {
        res.status(400).json({
          error: 'No available verified mechanics matching category skills found for auto-assignment.',
        });
        return;
      }

      targetMechanicId = suggestions[0].mechanicId;
    }

    if (!targetMechanicId) {
      res.status(400).json({ error: 'mechanicId or autoAssign must be provided.' });
      return;
    }

    // Verify mechanic exists and has MECHANIC role
    const mechanicUser = await prisma.user.findFirst({
      where: { id: targetMechanicId, role: Role.MECHANIC },
    });

    if (!mechanicUser) {
      res.status(404).json({ error: 'Mechanic not found or invalid role.' });
      return;
    }

    await prisma.repairRequest.update({
      where: { id },
      data: {
        mechanicId: targetMechanicId,
        status: RequestStatus.ASSIGNED,
        statusHistory: {
          create: {
            fromStatus: request.status,
            toStatus: RequestStatus.ASSIGNED,
            actorId: req.user.userId,
            actorRole: req.user.role,
            note: note || `Assigned to mechanic ${mechanicUser.name}`,
          },
        },
      },
    });

    const fullUpdated = await prisma.repairRequest.findUnique({
      where: { id },
      include: FULL_REQUEST_INCLUDE,
    });

    if (fullUpdated) {
      emitRequestUpdated(id, fullUpdated);
    }

    res.json({
      message: `Mechanic ${mechanicUser.name} assigned successfully.`,
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
