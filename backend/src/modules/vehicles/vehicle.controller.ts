import { Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { AuthenticatedRequest } from '../../types/index.js';
import { checkAndSendVehicleAvailabilityEmail } from '../../services/email/vehicleAvailabilityEmail.service.js';

export async function listVehicles(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const where = req.user.role === Role.ADMIN ? {} : { customerId: req.user.userId };

    const vehicles = await prisma.vehicle.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { requests: true },
        },
      },
    });

    res.json({ vehicles });
  } catch (err) {
    next(err);
  }
}

export async function getVehicleById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        requests: {
          orderBy: { createdAt: 'desc' },
          include: {
            garage: true,
            mechanic: { select: { id: true, name: true } },
            estimates: { where: { status: 'APPROVED' } },
            payment: true,
          },
        },
      },
    });

    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    // Role ownership check: customer can only view their own vehicle
    if (req.user.role === Role.CUSTOMER && vehicle.customerId !== req.user.userId) {
      res.status(403).json({ error: 'Access denied. You do not own this vehicle.' });
      return;
    }

    res.json({ vehicle });
  } catch (err) {
    next(err);
  }
}

export async function createVehicle(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { type, make, model, year, regNo } = req.body;

    // Check unique regNo
    const existing = await prisma.vehicle.findUnique({ where: { regNo } });
    if (existing) {
      res.status(409).json({ error: `Vehicle with registration number ${regNo} is already registered.` });
      return;
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        customerId: req.user.userId,
        type,
        make,
        model,
        year,
        regNo,
      },
    });

    // Asynchronously trigger automated vehicle availability notification (non-blocking)
    checkAndSendVehicleAvailabilityEmail(vehicle.id, req.user.userId).catch((err) => {
      console.error('[VEHICLE REGISTRATION] Background availability email error:', err?.message);
    });

    res.status(201).json({ message: 'Vehicle added successfully', vehicle });
  } catch (err) {
    next(err);
  }
}

export async function updateVehicle(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { type, make, model, year, regNo } = req.body;

    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    if (req.user.role === Role.CUSTOMER && vehicle.customerId !== req.user.userId) {
      res.status(403).json({ error: 'Access denied. You do not own this vehicle.' });
      return;
    }

    if (regNo && regNo !== vehicle.regNo) {
      const existing = await prisma.vehicle.findUnique({ where: { regNo } });
      if (existing) {
        res.status(409).json({ error: `Registration number ${regNo} already registered.` });
        return;
      }
    }

    const updated = await prisma.vehicle.update({
      where: { id },
      data: {
        ...(type ? { type } : {}),
        ...(make ? { make } : {}),
        ...(model ? { model } : {}),
        ...(year ? { year } : {}),
        ...(regNo ? { regNo } : {}),
      },
    });

    res.json({ message: 'Vehicle updated successfully', vehicle: updated });
  } catch (err) {
    next(err);
  }
}
