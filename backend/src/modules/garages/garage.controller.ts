import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db.js';

export async function listGarages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { city, verifiedOnly } = req.query;

    const where: any = {};
    if (city) {
      where.city = { equals: String(city), mode: 'insensitive' };
    }
    if (verifiedOnly === 'true') {
      where.isVerified = true;
    }

    const garages = await prisma.garage.findMany({
      where,
      include: {
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

export async function createGarage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, address, city, phone, isVerified } = req.body;

    const garage = await prisma.garage.create({
      data: {
        name,
        address,
        city,
        phone,
        isVerified: !!isVerified,
      },
    });

    res.status(201).json({ message: 'Garage created successfully', garage });
  } catch (err) {
    next(err);
  }
}

export async function toggleGarageVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { isVerified } = req.body;

    const garage = await prisma.garage.update({
      where: { id },
      data: { isVerified: Boolean(isVerified) },
    });

    res.json({ message: 'Garage verification updated', garage });
  } catch (err) {
    next(err);
  }
}
