import { Response, NextFunction } from 'express';
import { Role, ComplaintStatus } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { AuthenticatedRequest } from '../../types/index.js';

export async function listComplaints(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { status } = req.query;
    const where: any = {};

    if (req.user.role === Role.CUSTOMER) {
      where.customerId = req.user.userId;
    }

    if (status && (status === 'OPEN' || status === 'RESOLVED')) {
      where.status = status;
    }

    const complaints = await prisma.complaint.findMany({
      where,
      include: {
        request: {
          include: {
            vehicle: true,
            garage: true,
            mechanic: { select: { id: true, name: true } },
          },
        },
        customer: { select: { id: true, name: true, email: true, phone: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ complaints });
  } catch (err) {
    next(err);
  }
}

export async function createComplaint(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { requestId, subject, description } = req.body;

    const request = await prisma.repairRequest.findUnique({ where: { id: requestId } });
    if (!request) {
      res.status(404).json({ error: 'Repair request not found' });
      return;
    }

    if (request.customerId !== req.user.userId) {
      res.status(403).json({ error: 'You can only raise complaints for your own repair request.' });
      return;
    }

    const complaint = await prisma.complaint.create({
      data: {
        requestId,
        customerId: req.user.userId,
        subject,
        description,
        status: ComplaintStatus.OPEN,
      },
      include: {
        request: {
          include: {
            vehicle: true,
            garage: true,
          },
        },
        customer: true,
      },
    });

    res.status(201).json({ message: 'Complaint raised successfully', complaint });
  } catch (err) {
    next(err);
  }
}

export async function resolveComplaint(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { resolutionNote } = req.body;

    const complaint = await prisma.complaint.findUnique({ where: { id } });
    if (!complaint) {
      res.status(404).json({ error: 'Complaint not found' });
      return;
    }

    const updated = await prisma.complaint.update({
      where: { id },
      data: {
        status: ComplaintStatus.RESOLVED,
        resolutionNote,
        resolvedAt: new Date(),
        resolvedById: req.user.userId,
      },
      include: {
        request: true,
        customer: true,
        resolvedBy: { select: { id: true, name: true } },
      },
    });

    res.json({ message: 'Complaint marked as resolved', complaint: updated });
  } catch (err) {
    next(err);
  }
}
