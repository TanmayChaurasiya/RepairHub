import { Response, NextFunction } from 'express';
import {
  Role,
  GarageStatus,
  MechanicStatus,
  RequestStatus,
  PaymentStatus,
  VehicleType,
  MechanicAvailability,
  EmailNotificationStatus,
  EmailNotificationType,
  EmergencyStatus,
} from '@prisma/client';
import { prisma } from '../../config/db.js';
import { AuthenticatedRequest } from '../../types/index.js';
import { logAudit } from '../../services/audit/audit.service.js';
import { emailService } from '../../services/email/mailer.js';
import {
  getEligibleMechanicsForReassignment,
  executeMechanicReassignment,
  getRequestAssignmentHistory,
  listAllAssignmentHistories,
} from '../../services/reassignment/reassignment.service.js';

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
          availability: m.availability,
          breakReason: m.breakReason,
          lastActiveAt: m.lastActiveAt,
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
        availability: MechanicAvailability.OFFLINE,
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
        availability: MechanicAvailability.AVAILABLE,
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

/**
 * 14. Detailed Mechanic Profile View for Admin
 */
export async function getMechanicDetailsAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const mechanic = await prisma.mechanicProfile.findFirst({
      where: { OR: [{ id }, { userId: id }] },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
        garage: { select: { id: true, name: true, city: true, address: true, phone: true, status: true, operatingHours: true } },
      },
    });

    if (!mechanic) {
      res.status(404).json({ error: 'Mechanic not found' });
      return;
    }

    const activeAssignments = await prisma.repairRequest.findMany({
      where: {
        mechanicId: mechanic.userId,
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
      include: {
        vehicle: true,
        customer: { select: { id: true, name: true, phone: true, email: true } },
        garage: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const completedJobs = await prisma.repairRequest.count({
      where: {
        mechanicId: mechanic.userId,
        status: { in: [RequestStatus.COMPLETED, RequestStatus.PAID] },
      },
    });

    const recentCompletedJobs = await prisma.repairRequest.findMany({
      where: {
        mechanicId: mechanic.userId,
        status: { in: [RequestStatus.COMPLETED, RequestStatus.PAID] },
      },
      take: 5,
      include: {
        vehicle: true,
        customer: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({
      mechanic: {
        ...mechanic,
        completedJobs,
        activeJobsCount: activeAssignments.length,
      },
      activeAssignments,
      recentCompletedJobs,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 15. System-wide Admin Dashboard Statistics
 */
export async function getAdminDashboardStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const [
      totalVehicles,
      twoWheelers,
      cars,
      commercialVehicles,
      totalMechanics,
      availableMechanics,
      busyMechanics,
      onBreakMechanics,
      offlineMechanics,
      totalGarages,
      approvedGarages,
      pendingGarages,
      suspendedGarages,
      totalEmails,
      sentEmails,
      failedEmails,
      pendingEmails,
      activeAssignments,
      pendingReassignments,
      revenueAgg,
      totalCustomers,
      totalEmergency,
      activeEmergency,
      completedEmergency,
    ] = await Promise.all([
      prisma.vehicle.count(),
      prisma.vehicle.count({ where: { type: VehicleType.TWO_WHEELER } }),
      prisma.vehicle.count({ where: { type: VehicleType.CAR } }),
      prisma.vehicle.count({ where: { type: VehicleType.COMMERCIAL } }),
      prisma.mechanicProfile.count(),
      prisma.mechanicProfile.count({ where: { availability: MechanicAvailability.AVAILABLE, status: MechanicStatus.ACTIVE } }),
      prisma.mechanicProfile.count({ where: { availability: MechanicAvailability.BUSY, status: MechanicStatus.ACTIVE } }),
      prisma.mechanicProfile.count({ where: { availability: MechanicAvailability.ON_BREAK, status: MechanicStatus.ACTIVE } }),
      prisma.mechanicProfile.count({ where: { OR: [{ availability: MechanicAvailability.OFFLINE }, { status: { not: MechanicStatus.ACTIVE } }] } }),
      prisma.garage.count(),
      prisma.garage.count({ where: { status: GarageStatus.APPROVED } }),
      prisma.garage.count({ where: { status: GarageStatus.PENDING } }),
      prisma.garage.count({ where: { status: GarageStatus.SUSPENDED } }),
      prisma.emailNotification.count(),
      prisma.emailNotification.count({ where: { status: EmailNotificationStatus.SENT } }),
      prisma.emailNotification.count({ where: { status: EmailNotificationStatus.FAILED } }),
      prisma.emailNotification.count({ where: { status: EmailNotificationStatus.PENDING } }),
      prisma.repairRequest.count({
        where: {
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
      }),
      prisma.repairRequest.count({ where: { status: RequestStatus.ASSIGNED } }),
      prisma.invoice.aggregate({
        where: { request: { status: RequestStatus.PAID } },
        _sum: { totalPaise: true },
      }),
      prisma.user.count({ where: { role: Role.CUSTOMER } }),
      prisma.emergencyRequest.count(),
      prisma.emergencyRequest.count({
        where: {
          status: {
            notIn: [
              EmergencyStatus.COMPLETED,
              EmergencyStatus.CANCELLED,
              EmergencyStatus.UNFULFILLED,
            ],
          },
        },
      }),
      prisma.emergencyRequest.count({ where: { status: EmergencyStatus.COMPLETED } }),
    ]);

    const totalRevenuePaise = revenueAgg._sum.totalPaise || 0;

    res.json({
      stats: {
        customers: {
          total: totalCustomers,
        },
        emergency: {
          total: totalEmergency,
          active: activeEmergency,
          completed: completedEmergency,
        },
        vehicles: {
          total: totalVehicles,
          byCategory: {
            TWO_WHEELER: twoWheelers,
            CAR: cars,
            COMMERCIAL: commercialVehicles,
          },
        },
        mechanics: {
          total: totalMechanics,
          available: availableMechanics,
          busy: busyMechanics,
          onBreak: onBreakMechanics,
          offline: offlineMechanics,
        },
        garages: {
          total: totalGarages,
          approved: approvedGarages,
          pending: pendingGarages,
          suspended: suspendedGarages,
        },
        emails: {
          total: totalEmails,
          sent: sentEmails,
          failed: failedEmails,
          pending: pendingEmails,
          deliveryRate: totalEmails > 0 ? Math.round((sentEmails / totalEmails) * 100) : 100,
        },
        assignments: {
          activeCount: activeAssignments,
          reassignableCount: pendingReassignments,
        },
        revenue: {
          totalPaise: totalRevenuePaise,
          totalRupees: Math.round(totalRevenuePaise / 100),
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 16. Customer Vehicles Platform Management
 */
export async function listCustomerVehiclesAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { search, category, make, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
    const skip = (pageNum - 1) * take;

    const where: any = {};

    if (category && Object.values(VehicleType).includes(category as VehicleType)) {
      where.type = category as VehicleType;
    }

    if (make) {
      where.make = { equals: String(make), mode: 'insensitive' };
    }

    if (search && String(search).trim() !== '') {
      const q = String(search).trim();
      where.OR = [
        { regNo: { contains: q, mode: 'insensitive' } },
        { make: { contains: q, mode: 'insensitive' } },
        { model: { contains: q, mode: 'insensitive' } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
        { customer: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, vehicles] = await Promise.all([
      prisma.vehicle.count({ where }),
      prisma.vehicle.findMany({
        where,
        skip,
        take,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              createdAt: true,
              _count: { select: { vehicles: true } },
            },
          },
          _count: { select: { requests: true } },
          requests: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              requestNumber: true,
              status: true,
              category: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({
      vehicles: vehicles.map((v) => ({
        id: v.id,
        customerId: v.customerId,
        customerName: v.customer.name,
        customerEmail: v.customer.email,
        customerPhone: v.customer.phone,
        customerVehicleCount: v.customer._count.vehicles,
        vehicleName: `${v.year} ${v.make} ${v.model}`,
        category: v.type,
        brand: v.make,
        model: v.model,
        year: v.year,
        registrationNumber: v.regNo,
        registrationDate: v.createdAt,
        totalRequests: v._count.requests,
        latestRequest: v.requests[0] || null,
      })),
      pagination: {
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 17. Vehicle Details for Admin View
 */
export async function getVehicleDetailsAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            createdAt: true,
            vehicles: {
              select: { id: true, make: true, model: true, year: true, regNo: true, type: true },
            },
          },
        },
        requests: {
          include: {
            garage: { select: { id: true, name: true, city: true } },
            mechanic: { select: { id: true, name: true, phone: true } },
            estimates: { where: { status: 'APPROVED' } },
            invoice: true,
            payment: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        emailNotifications: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    res.json({ vehicle });
  } catch (err) {
    next(err);
  }
}

/**
 * 18. Email Notifications Log for Admin
 */
export async function listEmailNotificationsAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, type, search, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
    const skip = (pageNum - 1) * take;

    const where: any = {};

    if (status && status !== 'ALL' && Object.values(EmailNotificationStatus).includes(status as EmailNotificationStatus)) {
      where.status = status as EmailNotificationStatus;
    }

    if (type && type !== 'ALL' && Object.values(EmailNotificationType).includes(type as EmailNotificationType)) {
      where.type = type as EmailNotificationType;
    }

    if (search && String(search).trim() !== '') {
      const q = String(search).trim();
      where.OR = [
        { recipient: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
        { vehicle: { regNo: { contains: q, mode: 'insensitive' } } },
        { vehicle: { make: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, notifications] = await Promise.all([
      prisma.emailNotification.count({ where }),
      prisma.emailNotification.findMany({
        where,
        skip,
        take,
        include: {
          vehicle: {
            select: { id: true, make: true, model: true, regNo: true, type: true },
          },
          request: {
            select: { id: true, requestNumber: true, status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({
      notifications,
      pagination: {
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 19. Retry Failed Email Notification
 */
export async function retryEmailNotificationAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const notification = await prisma.emailNotification.findUnique({
      where: { id },
      include: { vehicle: true },
    });

    if (!notification) {
      res.status(404).json({ error: 'Email notification record not found' });
      return;
    }

    try {
      await emailService.sendGenericEmail({
        to: notification.recipient,
        subject: notification.subject,
        html: `<p>Notification retry from RepairHub: ${notification.subject}</p>`,
      });

      const updated = await prisma.emailNotification.update({
        where: { id },
        data: {
          status: EmailNotificationStatus.SENT,
          sentAt: new Date(),
          errorDetails: null,
        },
      });

      res.json({ message: 'Email retried successfully', notification: updated });
    } catch (err: any) {
      const updated = await prisma.emailNotification.update({
        where: { id },
        data: {
          status: EmailNotificationStatus.FAILED,
          errorDetails: err?.message || 'Retry delivery failed',
        },
      });

      res.status(500).json({ error: 'Retry failed', details: err?.message, notification: updated });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * 20. Get Eligible Mechanics for Reassignment
 */
export async function getEligibleMechanicsForReassignmentAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const result = await getEligibleMechanicsForReassignment(id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to determine eligible mechanics' });
  }
}

/**
 * 21. Execute Mechanic Reassignment
 */
export async function reassignMechanicAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { newMechanicId, reason, expectedUpdatedAt } = req.body;

    if (!newMechanicId) {
      res.status(400).json({ error: 'Target newMechanicId is required.' });
      return;
    }

    if (!reason || reason.trim().length < 5) {
      res.status(400).json({ error: 'A reassignment reason of at least 5 characters is required.' });
      return;
    }

    const result = await executeMechanicReassignment({
      requestId: id,
      newMechanicId,
      reason,
      adminId: req.user!.userId,
      adminRole: req.user!.role,
      expectedUpdatedAt,
    });

    res.json({
      message: 'Mechanic successfully reassigned',
      request: result.updatedRequest,
      assignmentHistory: result.assignmentHistory,
    });
  } catch (err: any) {
    const status = err.statusCode || 400;
    res.status(status).json({ error: err?.message || 'Reassignment failed' });
  }
}

/**
 * 22. Get Assignment History for a Specific Request
 */
export async function getRequestAssignmentHistoryAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const histories = await getRequestAssignmentHistory(id);
    res.json({ histories });
  } catch (err) {
    next(err);
  }
}

/**
 * 23. List All Platform-wide Assignment Histories
 */
export async function listAllAssignmentHistoriesAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { page = '1', limit = '20', search = '' } = req.query;
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));

    const result = await listAllAssignmentHistories({
      page: pageNum,
      limit: take,
      search: String(search),
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * 24. List Issue-to-Skill Mappings
 */
export async function listIssueSkillMappingsAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const mappings = await prisma.issueSkillMapping.findMany({
      orderBy: [{ priority: 'desc' }, { category: 'asc' }],
    });
    res.json({ mappings });
  } catch (err) {
    next(err);
  }
}

/**
 * 25. Create Issue-to-Skill Mapping
 */
export async function createIssueSkillMappingAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { category, powertrain, issuePattern, requiredSkills, priority = 0, description } = req.body;

    if (!category || !requiredSkills || !Array.isArray(requiredSkills) || requiredSkills.length === 0) {
      res.status(400).json({ error: 'Category and at least one required skill are required.' });
      return;
    }

    const mapping = await prisma.issueSkillMapping.create({
      data: {
        category,
        powertrain: powertrain || null,
        issuePattern: issuePattern ? String(issuePattern).trim().toLowerCase() : null,
        requiredSkills: requiredSkills.map((s: string) => s.toUpperCase().trim()),
        priority: parseInt(String(priority), 10) || 0,
        description,
        isActive: true,
      },
    });

    res.status(201).json({ message: 'Issue skill mapping created successfully', mapping });
  } catch (err) {
    next(err);
  }
}

/**
 * 26. Update Issue-to-Skill Mapping
 */
export async function updateIssueSkillMappingAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { category, powertrain, issuePattern, requiredSkills, priority, description, isActive } = req.body;

    const mapping = await prisma.issueSkillMapping.update({
      where: { id },
      data: {
        ...(category && { category }),
        ...(powertrain !== undefined && { powertrain }),
        ...(issuePattern !== undefined && { issuePattern: issuePattern ? String(issuePattern).trim().toLowerCase() : null }),
        ...(requiredSkills && { requiredSkills: requiredSkills.map((s: string) => s.toUpperCase().trim()) }),
        ...(priority !== undefined && { priority: parseInt(String(priority), 10) }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });

    res.json({ message: 'Issue skill mapping updated successfully', mapping });
  } catch (err) {
    next(err);
  }
}

/**
 * 27. Delete Issue-to-Skill Mapping
 */
export async function deleteIssueSkillMappingAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    await prisma.issueSkillMapping.delete({ where: { id } });
    res.json({ message: 'Issue skill mapping removed successfully' });
  } catch (err) {
    next(err);
  }
}

/**
 * 28. List Mechanics Pending Skill Review
 */
export async function listMechanicsPendingReviewAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const mechanics = await prisma.mechanicProfile.findMany({
      where: {
        skillsPendingReview: true,
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        garage: { select: { id: true, name: true, city: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ mechanics });
  } catch (err) {
    next(err);
  }
}

/**
 * 29. Master Admin Tag Mechanic Skills & Resolve Pending Review
 */
export async function tagMechanicSkillsAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { skills, specialization } = req.body;

    if (!skills || !Array.isArray(skills) || skills.length === 0) {
      res.status(400).json({ error: 'At least one skill must be specified.' });
      return;
    }

    const cleanSkills = skills.map((s: string) => s.toUpperCase().trim());

    const updated = await prisma.mechanicProfile.update({
      where: { userId: id },
      data: {
        skills: cleanSkills,
        skillsPendingReview: false,
        ...(specialization !== undefined && { specialization }),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        garage: true,
      },
    });

    res.json({
      message: `Skills successfully tagged for ${updated.user.name}. Profile review complete.`,
      mechanic: updated,
    });
  } catch (err) {
    next(err);
  }
}



