import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Role, RequestStatus, MechanicStatus } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { AuthenticatedRequest, TokenPayload } from '../../types/index.js';
import { generateTokens } from '../auth/auth.controller.js';
import { logAudit } from '../../services/audit/audit.service.js';
import { env } from '../../config/env.js';

export async function listMechanics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { garageId } = req.query;

    const where: any = {};
    if (garageId) {
      where.garageId = String(garageId);
    }

    const mechanics = await prisma.mechanicProfile.findMany({
      where,
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
          specialization: m.specialization,
          experienceYears: m.experienceYears,
          available: m.available,
          status: m.status,
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
    const { name, email, phone, password, garageId, skills, specialization, experienceYears } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    // The Master Admin identity is reserved exclusively and cannot be assigned as a mechanic
    if (normalizedEmail === env.MASTER_ADMIN_EMAIL.toLowerCase().trim()) {
      res.status(403).json({
        error: 'This email address is reserved for system administration and cannot be assigned the mechanic role.',
      });
      return;
    }

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { mechanicProfile: true, ownedGarage: true },
    });

    if (existing) {
      if (existing.role === Role.MECHANIC || existing.mechanicProfile) {
        res.status(409).json({ error: 'A technician with this email already exists on the platform.' });
        return;
      }
      if (existing.role === Role.ADMIN) {
        res.status(409).json({ error: 'This email belongs to an Admin account.' });
        return;
      }
      if (existing.role === Role.GARAGE || existing.ownedGarage) {
        res.status(409).json({ error: 'This email belongs to a Garage Owner account.' });
        return;
      }
    }

    const garage = await prisma.garage.findUnique({ where: { id: garageId } });
    if (!garage) {
      res.status(404).json({ error: 'Selected garage not found.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    let user;
    if (existing) {
      // Existing customer promoted/onboarded to technician by Master Admin
      user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          name,
          phone,
          passwordHash,
          role: Role.MECHANIC,
          mechanicProfile: {
            create: {
              garageId,
              skills,
              specialization: specialization || undefined,
              experienceYears: experienceYears ? Number(experienceYears) : 0,
              available: true,
              status: MechanicStatus.ACTIVE,
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
    } else {
      user = await prisma.user.create({
        data: {
          name,
          email: normalizedEmail,
          phone,
          passwordHash,
          role: Role.MECHANIC,
          mechanicProfile: {
            create: {
              garageId,
              skills,
              specialization: specialization || undefined,
              experienceYears: experienceYears ? Number(experienceYears) : 0,
              available: true,
              status: MechanicStatus.ACTIVE,
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
    }

    if (req.user) {
      await logAudit({
        actorId: req.user.userId,
        actorRole: req.user.role,
        action: 'MECHANIC_CREATED',
        targetEntity: 'MechanicProfile',
        targetId: user.mechanicProfile!.id,
        metadata: { name: user.name, garageId, wasExistingAccount: !!existing },
      });
    }

    res.status(201).json({ message: 'Mechanic account created successfully', mechanic: user });
  } catch (err) {
    next(err);
  }
}

export async function getInvitationDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token } = req.params;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const invitation = await prisma.mechanicInvitation.findUnique({
      where: { tokenHash },
      include: {
        garage: {
          select: {
            id: true,
            name: true,
            city: true,
            address: true,
            phone: true,
          },
        },
      },
    });

    if (!invitation) {
      res.status(404).json({ error: 'Invitation not found or link is invalid.' });
      return;
    }

    if (invitation.acceptedAt) {
      res.status(400).json({ error: 'This invitation has already been accepted. Please proceed to login.' });
      return;
    }

    if (invitation.expiresAt < new Date()) {
      res.status(400).json({ error: 'This invitation link has expired. Please contact your garage owner.' });
      return;
    }

    res.json({
      invitation: {
        email: invitation.email,
        name: invitation.name,
        phone: invitation.phone,
        skills: invitation.skills,
        garage: invitation.garage,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function acceptInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token, password, specialization, experienceYears } = req.body;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const invitation = await prisma.mechanicInvitation.findUnique({
      where: { tokenHash },
      include: { garage: true },
    });

    if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
      res.status(400).json({ error: 'Invalid, used, or expired invitation token.' });
      return;
    }

    if (invitation.email.toLowerCase().trim() === env.MASTER_ADMIN_EMAIL.toLowerCase().trim()) {
      res.status(403).json({ error: 'This email address is reserved for system administration.' });
      return;
    }

    const existing = await prisma.user.findUnique({
      where: { email: invitation.email },
      include: { mechanicProfile: true, ownedGarage: true },
    });

    if (existing) {
      if (existing.role === Role.MECHANIC || existing.mechanicProfile) {
        res.status(409).json({ error: 'This email is already associated with an active technician account.' });
        return;
      }
      if (existing.role === Role.ADMIN || existing.role === Role.GARAGE || existing.ownedGarage) {
        res.status(409).json({ error: 'This email belongs to an administrative or garage owner account.' });
        return;
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      let user;

      if (existing) {
        // Upgrade existing user account to MECHANIC
        user = await tx.user.update({
          where: { id: existing.id },
          data: {
            name: invitation.name || existing.name,
            phone: invitation.phone || existing.phone,
            passwordHash,
            role: Role.MECHANIC,
            mechanicProfile: {
              create: {
                garageId: invitation.garageId,
                skills: invitation.skills,
                specialization: specialization || undefined,
                experienceYears: experienceYears ? Number(experienceYears) : 0,
                available: true,
                status: MechanicStatus.ACTIVE,
              },
            },
          },
          include: {
            mechanicProfile: {
              include: { garage: true },
            },
          },
        });
      } else {
        user = await tx.user.create({
          data: {
            email: invitation.email,
            name: invitation.name,
            phone: invitation.phone,
            passwordHash,
            role: Role.MECHANIC,
            mechanicProfile: {
              create: {
                garageId: invitation.garageId,
                skills: invitation.skills,
                specialization: specialization || undefined,
                experienceYears: experienceYears ? Number(experienceYears) : 0,
                available: true,
                status: MechanicStatus.ACTIVE,
              },
            },
          },
          include: {
            mechanicProfile: {
              include: { garage: true },
            },
          },
        });
      }

      await tx.mechanicInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorRole: Role.MECHANIC,
          action: 'MECHANIC_INVITATION_ACCEPTED',
          targetEntity: 'MechanicProfile',
          targetId: user.mechanicProfile!.id,
          metadata: {
            garageId: invitation.garageId,
            garageName: invitation.garage.name,
          },
        },
      });

      const tokenPayload: TokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const { accessToken, refreshToken } = generateTokens(tokenPayload);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      await tx.refreshToken.create({
        data: {
          userId: user.id,
          token: refreshToken,
          expiresAt,
        },
      });

      return { user, accessToken, refreshToken };
    });

    res.status(201).json({
      message: 'Mechanic account created and activated successfully! Welcome to RepairHub.',
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
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
