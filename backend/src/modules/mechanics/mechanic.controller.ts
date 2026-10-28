import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { Role, RequestStatus } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { AuthenticatedRequest } from '../../types/index.js';

export async function listMechanics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const mechanics = await prisma.mechanicProfile.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        garage: true,
      },
      orderBy: { rating: 'desc' },
    });

    // Count active jobs for each mechanic
    const activeStatuses: RequestStatus[] = [
      RequestStatus.ASSIGNED,
      RequestStatus.INSPECTING,
      RequestStatus.ESTIMATE_SENT,
      RequestStatus.APPROVED,
      RequestStatus.IN_PROGRESS,
      RequestStatus.QC,
    ];

    const results = await Promise.all(
      mechanics.map(async (m) => {
        const activeJobCount = await prisma.repairRequest.count({
          where: {
            mechanicId: m.userId,
            status: { in: activeStatuses },
          },
        });
        return {
          id: m.id,
          userId: m.userId,
          name: m.user.name,
          email: m.user.email,
          phone: m.user.phone,
          garageId: m.garageId,
          garageName: m.garage.name,
          garageCity: m.garage.city,
          garageVerified: m.garage.isVerified,
          skills: m.skills,
          available: m.available,
          rating: m.rating,
          totalReviews: m.totalReviews,
          activeJobCount,
        };
      })
    );

    res.json({ mechanics: results });
  } catch (err) {
    next(err);
  }
}

export async function createMechanic(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, email, phone, password, garageId, skills } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'User with this email already exists.' });
      return;
    }

    const garage = await prisma.garage.findUnique({ where: { id: garageId } });
    if (!garage) {
      res.status(404).json({ error: 'Selected garage not found.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        passwordHash,
        role: Role.MECHANIC,
        mechanicProfile: {
          create: {
            garageId,
            skills,
            available: true,
            rating: 5.0,
            totalReviews: 0,
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        mechanicProfile: true,
      },
    });

    res.status(201).json({ message: 'Mechanic account created successfully', mechanic: user });
  } catch (err) {
    next(err);
  }
}

export async function toggleAvailability(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { available } = req.body;

    const profile = await prisma.mechanicProfile.findUnique({
      where: { userId: req.user.userId },
    });

    if (!profile) {
      res.status(404).json({ error: 'Mechanic profile not found.' });
      return;
    }

    const updated = await prisma.mechanicProfile.update({
      where: { id: profile.id },
      data: { available: Boolean(available) },
    });

    res.json({ message: 'Availability updated', profile: updated });
  } catch (err) {
    next(err);
  }
}

export async function updateSkills(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { skills } = req.body;

    const profile = await prisma.mechanicProfile.findUnique({
      where: { userId: req.user.userId },
    });

    if (!profile) {
      res.status(404).json({ error: 'Mechanic profile not found.' });
      return;
    }

    const updated = await prisma.mechanicProfile.update({
      where: { id: profile.id },
      data: { skills },
    });

    res.json({ message: 'Skills updated successfully', profile: updated });
  } catch (err) {
    next(err);
  }
}
