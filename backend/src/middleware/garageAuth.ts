import { Response, NextFunction } from 'express';
import { Role, GarageStatus } from '@prisma/client';
import { prisma } from '../config/db.js';
import { AuthenticatedRequest } from '../types/index.js';

/**
 * Resolves the garage owned by the authenticated GARAGE user,
 * or allows ADMIN to access any garage specified in parameters.
 * Strict isolation: GARAGE users can NEVER supply an arbitrary garageId.
 */
export async function resolveGarageOwnership(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized. Please login.' });
    return;
  }

  // Master Admin can view any garage specified by params or query
  if (req.user.role === Role.ADMIN) {
    const targetGarageId = req.params.garageId || (req.query.garageId as string);
    if (targetGarageId) {
      const garage = await prisma.garage.findUnique({
        where: { id: targetGarageId },
      });
      if (!garage) {
        res.status(404).json({ error: 'Garage not found.' });
        return;
      }
      req.garage = garage;
    }
    next();
    return;
  }

  // Garage Owner: Must lookup strictly by ownerId from verified JWT
  if (req.user.role === Role.GARAGE) {
    const garage = await prisma.garage.findUnique({
      where: { ownerId: req.user.userId },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            role: true,
          },
        },
      },
    });

    if (!garage) {
      res.status(404).json({
        error: 'No garage associated with this owner account.',
      });
      return;
    }

    req.garage = garage;
    next();
    return;
  }

  // Any other role cannot access garage-owner tenant routes
  res.status(403).json({
    error: 'Access denied. Garage owner authorization required.',
  });
}

/**
 * Enforces that the garage has status APPROVED.
 * Rejects with clear status payload if PENDING, REJECTED, or SUSPENDED.
 */
export function requireApprovedGarage(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  // Master Admin always has permission to override
  if (req.user?.role === Role.ADMIN) {
    next();
    return;
  }

  if (!req.garage) {
    res.status(404).json({ error: 'Garage not resolved.' });
    return;
  }

  if (req.garage.status === GarageStatus.PENDING) {
    res.status(403).json({
      error: 'Your garage registration is pending approval by Master Admin.',
      status: GarageStatus.PENDING,
      garage: {
        id: req.garage.id,
        name: req.garage.name,
        city: req.garage.city,
        createdAt: req.garage.createdAt,
      },
    });
    return;
  }

  if (req.garage.status === GarageStatus.REJECTED) {
    res.status(403).json({
      error: 'Your garage registration has been rejected by Master Admin.',
      status: GarageStatus.REJECTED,
      reason: req.garage.rejectionReason,
      garage: {
        id: req.garage.id,
        name: req.garage.name,
      },
    });
    return;
  }

  if (req.garage.status === GarageStatus.SUSPENDED) {
    res.status(403).json({
      error: 'Your garage account has been suspended by Master Admin. Please contact support.',
      status: GarageStatus.SUSPENDED,
      garage: {
        id: req.garage.id,
        name: req.garage.name,
      },
    });
    return;
  }

  next();
}
