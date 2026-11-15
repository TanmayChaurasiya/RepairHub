import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { Role, GarageStatus } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { generateTokens } from '../auth/auth.controller.js';
import { logAudit } from '../../services/audit/audit.service.js';
import { AuthenticatedRequest, TokenPayload } from '../../types/index.js';
import { env } from '../../config/env.js';

export async function listGarages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { city, verifiedOnly, status, search } = req.query;

    const where: any = {};
    if (city) {
      where.city = { equals: String(city), mode: 'insensitive' };
    }
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { city: { contains: String(search), mode: 'insensitive' } },
        { address: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    // If explicit status provided (e.g. Master Admin or query filter)
    if (status && status !== 'ALL') {
      where.status = status as GarageStatus;
    } else if (!status) {
      // By default public listing only shows APPROVED garages
      where.status = GarageStatus.APPROVED;
    }

    if (verifiedOnly === 'true') {
      where.isVerified = true;
    }

    const garages = await prisma.garage.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
          },
        },
        _count: {
          select: { mechanics: true, requests: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ garages });
  } catch (err) {
    next(err);
  }
}

export async function getGarageDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const garage = await prisma.garage.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            createdAt: true,
          },
        },
        mechanics: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        _count: {
          select: { mechanics: true, requests: true },
        },
      },
    });

    if (!garage) {
      res.status(404).json({ error: 'Garage not found.' });
      return;
    }

    res.json({ garage });
  } catch (err) {
    next(err);
  }
}

export async function registerGarage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      ownerName,
      email,
      phone,
      password,
      garageName,
      address,
      city,
      state,
      pinCode,
      garagePhone,
      description,
      operatingHours,
      services,
    } = req.body;

    const normalizedEmail = email.toLowerCase().trim();

    // Master Admin email is reserved exclusively for platform administration
    if (normalizedEmail === env.MASTER_ADMIN_EMAIL.toLowerCase().trim()) {
      res.status(403).json({
        error: 'This email address is reserved for system administration and cannot register as a garage owner.',
      });
      return;
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      res.status(409).json({ error: 'An account with this email address already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create user and garage in transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: ownerName,
          email: normalizedEmail,
          phone,
          passwordHash,
          role: Role.GARAGE,
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          createdAt: true,
        },
      });

      const garage = await tx.garage.create({
        data: {
          name: garageName,
          address,
          city,
          state: state || 'Uttar Pradesh',
          pinCode,
          phone: garagePhone || phone,
          description,
          operatingHours: operatingHours || '09:00 AM - 08:00 PM (Mon - Sat)',
          services: services || [],
          status: GarageStatus.PENDING,
          isVerified: false,
          ownerId: user.id,
        },
      });

      // Issue tokens
      const tokenPayload: TokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };
      const { accessToken, refreshToken } = generateTokens(tokenPayload);

      // Save refresh token
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      await tx.refreshToken.create({
        data: {
          userId: user.id,
          token: refreshToken,
          expiresAt,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorRole: Role.GARAGE,
          action: 'GARAGE_REGISTERED',
          targetEntity: 'Garage',
          targetId: garage.id,
          metadata: {
            garageName: garage.name,
            city: garage.city,
            ownerEmail: user.email,
          },
        },
      });

      return { user, garage, accessToken, refreshToken };
    });

    res.status(201).json({
      message: 'Garage registered successfully! Your account is pending approval by Master Admin.',
      user: {
        ...result.user,
        ownedGarage: result.garage,
      },
      garage: result.garage,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (err) {
    next(err);
  }
}

export async function createGarage(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, address, city, state, pinCode, phone, description, operatingHours, services, isVerified, ownerEmail } = req.body;

    let ownerId: string | undefined;
    if (ownerEmail) {
      const normalizedOwnerEmail = String(ownerEmail).toLowerCase().trim();
      if (normalizedOwnerEmail === env.MASTER_ADMIN_EMAIL.toLowerCase().trim()) {
        res.status(403).json({
          error: 'The Master Admin identity is reserved and cannot be assigned as a garage owner.',
        });
        return;
      }

      const ownerUser = await prisma.user.findUnique({
        where: { email: normalizedOwnerEmail },
      });
      if (ownerUser) {
        ownerId = ownerUser.id;
        if (ownerUser.role === Role.CUSTOMER) {
          await prisma.user.update({
            where: { id: ownerUser.id },
            data: { role: Role.GARAGE },
          });
        }
      }
    }

    const garage = await prisma.garage.create({
      data: {
        name,
        address,
        city,
        state: state || 'Uttar Pradesh',
        pinCode,
        phone,
        description,
        operatingHours,
        services: services || [],
        isVerified: !!isVerified,
        status: isVerified ? GarageStatus.APPROVED : GarageStatus.PENDING,
        ownerId,
      },
    });

    if (req.user) {
      await logAudit({
        actorId: req.user.userId,
        actorRole: req.user.role,
        action: 'GARAGE_CREATED_BY_ADMIN',
        targetEntity: 'Garage',
        targetId: garage.id,
        metadata: { name: garage.name, city: garage.city },
      });
    }

    res.status(201).json({ message: 'Garage created successfully', garage });
  } catch (err) {
    next(err);
  }
}

export async function toggleGarageVerification(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { isVerified } = req.body;

    const garage = await prisma.garage.update({
      where: { id },
      data: {
        isVerified: Boolean(isVerified),
        status: Boolean(isVerified) ? GarageStatus.APPROVED : GarageStatus.PENDING,
      },
    });

    if (req.user) {
      await logAudit({
        actorId: req.user.userId,
        actorRole: req.user.role,
        action: Boolean(isVerified) ? 'GARAGE_VERIFIED' : 'GARAGE_UNVERIFIED',
        targetEntity: 'Garage',
        targetId: garage.id,
      });
    }

    res.json({ message: 'Garage verification updated', garage });
  } catch (err) {
    next(err);
  }
}
