import { Response, NextFunction } from 'express';
import { Role, GarageStatus, MechanicStatus, RequestStatus, PaymentStatus } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { AuthenticatedRequest } from '../../types/index.js';
import { logAudit } from '../../services/audit/audit.service.js';
import { emailService } from '../../services/email/mailer.js';

/**
 * 1. List all garages with multi-status filters, search, and metrics
 */
export async function listGaragesAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, city, search } = req.query;

    const where: any = {};
    if (status && status !== 'ALL') {
      where.status = status as GarageStatus;
    }
    if (city) {
      where.city = { equals: String(city), mode: 'insensitive' };
    }
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { city: { contains: String(search), mode: 'insensitive' } },
        { address: { contains: String(search), mode: 'insensitive' } },
        { owner: { name: { contains: String(search), mode: 'insensitive' } } },
        { owner: { email: { contains: String(search), mode: 'insensitive' } } },
      ];
    }

    const garages = await prisma.garage.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            createdAt: true,
          },
        },
        _count: {
          select: { mechanics: true, requests: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate revenue for each garage
    const enrichedGarages = await Promise.all(
      garages.map(async (g) => {
        const revenueAgg = await prisma.invoice.aggregate({
          where: {
            request: {
              garageId: g.id,
              status: RequestStatus.PAID,
            },
          },
          _sum: { totalPaise: true },
        });

        const activeMechanics = await prisma.mechanicProfile.count({
          where: { garageId: g.id, status: MechanicStatus.ACTIVE },
        });

        const completedJobs = await prisma.repairRequest.count({
          where: {
            garageId: g.id,
            status: { in: [RequestStatus.COMPLETED, RequestStatus.PAID] },
          },
        });

        const totalRevenuePaise = revenueAgg._sum.totalPaise || 0;
        return {
          ...g,
          metrics: {
            totalRevenuePaise,
            totalRevenueRupees: Math.round(totalRevenuePaise / 100),
            activeMechanics,
            completedJobs,
          },
        };
      })
    );

    res.json({ garages: enrichedGarages });
  } catch (err) {
    next(err);
  }
}

/**
 * 2. Get detailed view of an individual garage
 */
export async function getGarageDetailsAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const garage = await prisma.garage.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
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
        requests: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: { select: { id: true, name: true, phone: true } },
            vehicle: true,
            mechanic: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!garage) {
      res.status(404).json({ error: 'Garage not found.' });
      return;
    }

    // Fetch audit history for this garage
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        targetEntity: 'Garage',
        targetId: id,
      },
      include: {
        actor: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json({ garage, auditLogs });
  } catch (err) {
    next(err);
  }
}

/**
 * 3. Approve a pending garage registration
 */
export async function approveGarage(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const garage = await prisma.garage.findUnique({
      where: { id },
      include: { owner: true },
    });

    if (!garage) {
      res.status(404).json({ error: 'Garage not found.' });
      return;
    }

    const updated = await prisma.garage.update({
      where: { id },
      data: {
        status: GarageStatus.APPROVED,
        isVerified: true,
        rejectionReason: null,
      },
      include: { owner: true },
    });

    await logAudit({
      actorId: req.user!.userId,
      actorRole: req.user!.role,
      action: 'GARAGE_APPROVED',
      targetEntity: 'Garage',
      targetId: id,
      metadata: { garageName: garage.name, ownerEmail: garage.owner?.email },
    });

    // Notify owner via email
    if (garage.owner?.email) {
      emailService.sendGenericEmail({
        to: garage.owner.email,
        subject: `🎉 Congratulations! ${garage.name} has been approved on RepairHub`,
        html: `
          <div style="font-family: sans-serif; background: #0B1729; color: #ffffff; padding: 32px; border-radius: 8px;">
            <h2 style="color: #22C7DB;">RepairHub Network Approval</h2>
            <p>Hello <strong>${garage.owner.name}</strong>,</p>
            <p>Your garage registration for <strong>${garage.name}</strong> has been officially reviewed and <span style="color: #10B981; font-weight: bold;">APPROVED</span> by Master Admin.</p>
            <p>You can now log in to your Garage Owner Dashboard to invite mechanics, manage service bookings, and receive repair jobs.</p>
            <div style="margin: 24px 0;">
              <a href="http://localhost:3000/login" style="background-color: #22C7DB; color: #0B1729; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Go to Garage Dashboard
              </a>
            </div>
          </div>
        `,
      }).catch(console.error);
    }

    res.json({ message: `Garage ${garage.name} approved successfully`, garage: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * 4. Reject a garage registration with reason
 */
export async function rejectGarage(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const garage = await prisma.garage.findUnique({
      where: { id },
      include: { owner: true },
    });

    if (!garage) {
      res.status(404).json({ error: 'Garage not found.' });
      return;
    }

    const updated = await prisma.garage.update({
      where: { id },
      data: {
        status: GarageStatus.REJECTED,
        isVerified: false,
        rejectionReason: reason || 'Application does not meet platform requirements.',
      },
      include: { owner: true },
    });

    await logAudit({
      actorId: req.user!.userId,
      actorRole: req.user!.role,
      action: 'GARAGE_REJECTED',
      targetEntity: 'Garage',
      targetId: id,
      metadata: { reason, garageName: garage.name },
    });

    if (garage.owner?.email) {
      emailService.sendGenericEmail({
        to: garage.owner.email,
        subject: `Update regarding your RepairHub garage application: ${garage.name}`,
        html: `
          <div style="font-family: sans-serif; background: #0B1729; color: #ffffff; padding: 32px; border-radius: 8px;">
            <h2 style="color: #EF4444;">Application Status Update</h2>
            <p>Hello <strong>${garage.owner.name}</strong>,</p>
            <p>Your garage application for <strong>${garage.name}</strong> was reviewed by Master Admin and could not be approved at this time.</p>
            <p><strong>Reason provided:</strong></p>
            <blockquote style="background: #1E293B; border-left: 4px solid #EF4444; padding: 12px; margin: 16px 0;">
              ${reason || 'Requirements not met'}
            </blockquote>
            <p>If you believe this was an error or wish to re-apply with corrected documentation, please contact platform support.</p>
          </div>
        `,
      }).catch(console.error);
    }

    res.json({ message: `Garage ${garage.name} rejected`, garage: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * 5. Suspend a garage
 */
export async function suspendGarage(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const garage = await prisma.garage.update({
      where: { id },
      data: {
        status: GarageStatus.SUSPENDED,
        isVerified: false,
        rejectionReason: reason || undefined,
      },
      include: { owner: true },
    });

    await logAudit({
      actorId: req.user!.userId,
      actorRole: req.user!.role,
      action: 'GARAGE_SUSPENDED',
      targetEntity: 'Garage',
      targetId: id,
      metadata: { reason, garageName: garage.name },
    });

    res.json({ message: `Garage ${garage.name} suspended`, garage });
  } catch (err) {
    next(err);
  }
}

/**
 * 6. Reactivate a suspended garage
 */
export async function reactivateGarage(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const garage = await prisma.garage.update({
      where: { id },
      data: {
        status: GarageStatus.APPROVED,
        isVerified: true,
        rejectionReason: null,
      },
      include: { owner: true },
    });

    await logAudit({
      actorId: req.user!.userId,
      actorRole: req.user!.role,
      action: 'GARAGE_REACTIVATED',
      targetEntity: 'Garage',
      targetId: id,
      metadata: { garageName: garage.name },
    });

    res.json({ message: `Garage ${garage.name} reactivated successfully`, garage });
  } catch (err) {
    next(err);
  }
}

/**
 * 7. Master Admin platform-wide mechanic list
 */
export async function listMechanicsAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { garageId, status, search } = req.query;

    const where: any = {};
    if (garageId) where.garageId = String(garageId);
    if (status && status !== 'ALL') where.status = status as MechanicStatus;
    if (search) {
      where.OR = [
        { user: { name: { contains: String(search), mode: 'insensitive' } } },
        { user: { email: { contains: String(search), mode: 'insensitive' } } },
        { garage: { name: { contains: String(search), mode: 'insensitive' } } },
      ];
    }

    const mechanics = await prisma.mechanicProfile.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
        garage: { select: { id: true, name: true, city: true, status: true } },
      },
      orderBy: { rating: 'desc' },
    });

    const enriched = await Promise.all(
      mechanics.map(async (m) => {
        const completedJobs = await prisma.repairRequest.count({
          where: {
            mechanicId: m.userId,
            status: { in: [RequestStatus.COMPLETED, RequestStatus.PAID] },
          },
        });
        const activeJobs = await prisma.repairRequest.count({
          where: {
            mechanicId: m.userId,
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

        return {
          id: m.id,
          userId: m.userId,
          name: m.user.name,
          email: m.user.email,
          phone: m.user.phone,
          garageId: m.garageId,
          garageName: m.garage.name,
          garageCity: m.garage.city,
          garageStatus: m.garage.status,
          skills: m.skills,
          specialization: m.specialization,
          experienceYears: m.experienceYears,
          available: m.available,
          status: m.status,
          rating: m.rating,
          totalReviews: m.totalReviews,
          completedJobs,
          activeJobs,
        };
      })
    );

    res.json({ mechanics: enriched });
  } catch (err) {
    next(err);
  }
}

/**
 * 8. Master Admin suspend mechanic across any garage
 */
export async function suspendMechanicAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const mechanic = await prisma.mechanicProfile.findFirst({
      where: { OR: [{ id }, { userId: id }] },
      include: { user: true, garage: true },
    });

    if (!mechanic) {
      res.status(404).json({ error: 'Mechanic not found.' });
      return;
    }

    const updated = await prisma.mechanicProfile.update({
      where: { id: mechanic.id },
      data: {
        status: MechanicStatus.SUSPENDED,
        available: false,
        rejectionReason: reason || 'Suspended by Master Admin override',
      },
      include: { user: true, garage: true },
    });

    await logAudit({
      actorId: req.user!.userId,
      actorRole: req.user!.role,
      action: 'MECHANIC_SUSPENDED_BY_ADMIN',
      targetEntity: 'MechanicProfile',
      targetId: mechanic.id,
      metadata: { reason, mechanicEmail: mechanic.user.email, garageId: mechanic.garageId },
    });

    res.json({ message: `Mechanic ${mechanic.user.name} suspended by Master Admin`, mechanic: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * 9. Master Admin reactivate mechanic
 */
export async function reactivateMechanicAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const mechanic = await prisma.mechanicProfile.findFirst({
      where: { OR: [{ id }, { userId: id }] },
      include: { user: true, garage: true },
    });

    if (!mechanic) {
      res.status(404).json({ error: 'Mechanic not found.' });
      return;
    }

    const updated = await prisma.mechanicProfile.update({
      where: { id: mechanic.id },
      data: {
        status: MechanicStatus.ACTIVE,
        available: true,
        rejectionReason: null,
      },
      include: { user: true, garage: true },
    });

    await logAudit({
      actorId: req.user!.userId,
      actorRole: req.user!.role,
      action: 'MECHANIC_REACTIVATED_BY_ADMIN',
      targetEntity: 'MechanicProfile',
      targetId: mechanic.id,
      metadata: { mechanicEmail: mechanic.user.email, garageId: mechanic.garageId },
    });

    res.json({ message: `Mechanic ${mechanic.user.name} reactivated`, mechanic: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * 10. Master Admin list all customers
 */
export async function listCustomersAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { search } = req.query;

    const where: any = { role: Role.CUSTOMER };
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { email: { contains: String(search), mode: 'insensitive' } },
        { phone: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const customers = await prisma.user.findMany({
      where,
      include: {
        vehicles: true,
        _count: {
          select: { customerRequests: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ customers });
  } catch (err) {
    next(err);
  }
}

/**
 * 11. Master Admin list all platform bookings
 */
export async function listAllBookingsAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, garageId, search } = req.query;

    const where: any = {};
    if (status && status !== 'ALL') where.status = status as RequestStatus;
    if (garageId) where.garageId = String(garageId);
    if (search) {
      where.OR = [
        { requestNumber: { contains: String(search), mode: 'insensitive' } },
        { customer: { name: { contains: String(search), mode: 'insensitive' } } },
        { garage: { name: { contains: String(search), mode: 'insensitive' } } },
        { vehicle: { regNo: { contains: String(search), mode: 'insensitive' } } },
      ];
    }

    const bookings = await prisma.repairRequest.findMany({
      where,
      include: {
        garage: { select: { id: true, name: true, city: true } },
        customer: { select: { id: true, name: true, phone: true, email: true } },
        vehicle: true,
        mechanic: { select: { id: true, name: true, phone: true } },
        invoice: true,
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ bookings });
  } catch (err) {
    next(err);
  }
}

/**
 * 12. Audit logs query
 */
export async function getAuditLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { action, actorId, targetEntity, limit = 50 } = req.query;

    const where: any = {};
    if (action) where.action = String(action);
    if (actorId) where.actorId = String(actorId);
    if (targetEntity) where.targetEntity = String(targetEntity);

    const auditLogs = await prisma.auditLog.findMany({
      where,
      include: {
        actor: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
    });

    res.json({ auditLogs });
  } catch (err) {
    next(err);
  }
}

/**
 * 13. Garage performance comparison analytics
 */
export async function getGarageComparisonAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const garages = await prisma.garage.findMany({
      include: {
        _count: { select: { mechanics: true, requests: true } },
      },
    });

    const comparison = await Promise.all(
      garages.map(async (g) => {
        const [revenueAgg, completedCount, cancelledCount] = await Promise.all([
          prisma.invoice.aggregate({
            where: { request: { garageId: g.id, status: RequestStatus.PAID } },
            _sum: { totalPaise: true },
          }),
          prisma.repairRequest.count({
            where: { garageId: g.id, status: { in: [RequestStatus.COMPLETED, RequestStatus.PAID] } },
          }),
          prisma.repairRequest.count({
            where: { garageId: g.id, status: RequestStatus.CANCELLED },
          }),
        ]);

        const avgRatingAgg = await prisma.mechanicProfile.aggregate({
          where: { garageId: g.id },
          _avg: { rating: true },
        });

        const totalRevenuePaise = revenueAgg._sum.totalPaise || 0;
        const totalRequests = g._count.requests;
        const completionRate = totalRequests > 0 ? Math.round((completedCount / totalRequests) * 100) : 0;

        return {
          id: g.id,
          name: g.name,
          city: g.city,
          status: g.status,
          isVerified: g.isVerified,
          mechanicCount: g._count.mechanics,
          totalBookings: totalRequests,
          completedBookings: completedCount,
          cancelledBookings: cancelledCount,
          completionRate,
          totalRevenuePaise,
          totalRevenueRupees: Math.round(totalRevenuePaise / 100),
          averageRating: avgRatingAgg._avg.rating ? Math.round(avgRatingAgg._avg.rating * 10) / 10 : 5.0,
        };
      })
    );

    res.json({ comparison });
  } catch (err) {
    next(err);
  }
}

