import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { Role, RequestStatus, MechanicStatus, GarageStatus } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { AuthenticatedRequest } from '../../types/index.js';
import { logAudit } from '../../services/audit/audit.service.js';
import { emailService } from '../../services/email/mailer.js';
import { env } from '../../config/env.js';

/**
 * Returns tenant-isolated dashboard KPIs for the logged-in garage owner.
 */
export async function getDashboardStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const garageId = req.garage!.id;

    // 1. Request metrics
    const [
      totalBookings,
      pendingRequests,
      inProgressRequests,
      completedRequests,
      paidRequests,
      activeMechanicsCount,
      totalMechanicsCount,
    ] = await Promise.all([
      prisma.repairRequest.count({ where: { garageId } }),
      prisma.repairRequest.count({ where: { garageId, status: { in: [RequestStatus.SUBMITTED, RequestStatus.ASSIGNED] } } }),
      prisma.repairRequest.count({ where: { garageId, status: { in: [RequestStatus.INSPECTING, RequestStatus.ESTIMATE_SENT, RequestStatus.APPROVED, RequestStatus.IN_PROGRESS, RequestStatus.QC] } } }),
      prisma.repairRequest.count({ where: { garageId, status: RequestStatus.COMPLETED } }),
      prisma.repairRequest.count({ where: { garageId, status: RequestStatus.PAID } }),
      prisma.mechanicProfile.count({ where: { garageId, status: MechanicStatus.ACTIVE } }),
      prisma.mechanicProfile.count({ where: { garageId } }),
    ]);

    // 2. Revenue calculation from paid invoices
    const paidInvoices = await prisma.invoice.aggregate({
      where: {
        request: {
          garageId,
          status: RequestStatus.PAID,
        },
      },
      _sum: {
        totalPaise: true,
      },
    });

    const totalRevenuePaise = paidInvoices._sum.totalPaise || 0;
    const totalRevenueRupees = Math.round(totalRevenuePaise / 100);

    // 3. Recent 5 bookings
    const recentBookings = await prisma.repairRequest.findMany({
      where: { garageId },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        vehicle: { select: { id: true, make: true, model: true, regNo: true, type: true } },
        mechanic: { select: { id: true, name: true, phone: true } },
        estimates: {
          orderBy: { version: 'desc' },
          take: 1,
        },
        invoice: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    res.json({
      garage: req.garage,
      metrics: {
        totalBookings,
        pendingRequests,
        inProgressRequests,
        completedRequests,
        paidRequests,
        activeMechanicsCount,
        totalMechanicsCount,
        totalRevenuePaise,
        totalRevenueRupees,
      },
      recentBookings,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Returns the garage's profile and owner details.
 */
export async function getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const garage = await prisma.garage.findUnique({
      where: { id: req.garage!.id },
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
        _count: {
          select: {
            mechanics: true,
            requests: true,
          },
        },
      },
    });

    res.json({ garage });
  } catch (err) {
    next(err);
  }
}

/**
 * Updates garage profile details.
 */
export async function updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, address, city, state, pinCode, phone, description, operatingHours, services } = req.body;

    const updated = await prisma.garage.update({
      where: { id: req.garage!.id },
      data: {
        name: name || undefined,
        address: address || undefined,
        city: city || undefined,
        state: state || undefined,
        pinCode: pinCode || undefined,
        phone: phone || undefined,
        description: description !== undefined ? description : undefined,
        operatingHours: operatingHours !== undefined ? operatingHours : undefined,
        services: services !== undefined ? services : undefined,
      },
    });

    await logAudit({
      actorId: req.user!.userId,
      actorRole: req.user!.role,
      action: 'GARAGE_PROFILE_UPDATED',
      targetEntity: 'Garage',
      targetId: updated.id,
      metadata: { fieldsUpdated: Object.keys(req.body) },
    });

    res.json({ message: 'Garage profile updated successfully', garage: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * Lists all bookings/requests for this garage with optional filters.
 */
export async function getBookings(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const garageId = req.garage!.id;
    const { status, mechanicId, search } = req.query;

    const where: any = { garageId };
    if (status && status !== 'ALL') {
      where.status = status as RequestStatus;
    }
    if (mechanicId) {
      where.mechanicId = String(mechanicId);
    }
    if (search) {
      where.OR = [
        { requestNumber: { contains: String(search), mode: 'insensitive' } },
        { customer: { name: { contains: String(search), mode: 'insensitive' } } },
        { vehicle: { regNo: { contains: String(search), mode: 'insensitive' } } },
      ];
    }

    const bookings = await prisma.repairRequest.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        vehicle: { select: { id: true, make: true, model: true, regNo: true, type: true } },
        mechanic: { select: { id: true, name: true, phone: true, email: true } },
        estimates: {
          orderBy: { version: 'desc' },
        },
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
 * Assigns or reassigns a mechanic to a booking within this garage.
 */
export async function assignMechanic(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id: requestId } = req.params;
    const { mechanicId } = req.body;
    const garageId = req.garage!.id;

    // Verify booking belongs to this garage
    const request = await prisma.repairRequest.findUnique({
      where: { id: requestId },
      include: { vehicle: true },
    });

    if (!request || request.garageId !== garageId) {
      res.status(404).json({ error: 'Service request not found in your garage.' });
      return;
    }

    // Verify mechanic belongs to this garage and is active
    const mechanicProfile = await prisma.mechanicProfile.findFirst({
      where: {
        userId: mechanicId,
        garageId,
        status: MechanicStatus.ACTIVE,
      },
      include: { user: true },
    });

    if (!mechanicProfile) {
      res.status(400).json({ error: 'Selected mechanic is not active or does not belong to your garage.' });
      return;
    }

    // Determine new status: if currently SUBMITTED, transition to ASSIGNED
    const newStatus = request.status === RequestStatus.SUBMITTED ? RequestStatus.ASSIGNED : request.status;

    const updated = await prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.repairRequest.update({
        where: { id: requestId },
        data: {
          mechanicId,
          status: newStatus,
        },
        include: {
          customer: { select: { id: true, name: true, email: true, phone: true } },
          vehicle: true,
          mechanic: { select: { id: true, name: true, email: true, phone: true } },
        },
      });

      await tx.statusHistory.create({
        data: {
          requestId,
          fromStatus: request.status,
          toStatus: newStatus,
          actorId: req.user!.userId,
          actorRole: req.user!.role,
          note: `Mechanic assigned by Garage Owner: ${mechanicProfile.user.name}`,
        },
      });

      await tx.assignmentHistory.create({
        data: {
          requestId,
          previousMechanicId: request.mechanicId,
          newMechanicId: mechanicId,
          assignedById: req.user!.userId,
          assignedByRole: Role.GARAGE,
          reason: request.mechanicId ? 'Reassigned by Garage Owner' : 'Initial assignment by Garage Owner',
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: req.user!.userId,
          actorRole: req.user!.role,
          action: 'MECHANIC_ASSIGNED',
          targetEntity: 'RepairRequest',
          targetId: requestId,
          metadata: {
            mechanicId,
            mechanicName: mechanicProfile.user.name,
            requestNumber: request.requestNumber,
          },
        },
      });

      return updatedRequest;
    });

    res.json({ message: 'Mechanic assigned successfully', request: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * Lists all mechanics under this garage, plus active mechanic invitations.
 */
export async function listMechanics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const garageId = req.garage!.id;

    const mechanics = await prisma.mechanicProfile.findMany({
      where: { garageId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            createdAt: true,
          },
        },
        garage: {
          select: { id: true, name: true, city: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Also get pending invitations
    const invitations = await prisma.mechanicInvitation.findMany({
      where: {
        garageId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ mechanics, invitations });
  } catch (err) {
    next(err);
  }
}

/**
 * Garage Owner invites a new mechanic via email.
 */
export async function inviteMechanic(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, name, phone, skills, specialization, experienceYears } = req.body;
    const garageId = req.garage!.id;
    const normalizedEmail = email.toLowerCase().trim();

    // The Master Admin identity is reserved exclusively and cannot be invited as a mechanic
    if (normalizedEmail === env.MASTER_ADMIN_EMAIL.toLowerCase().trim()) {
      res.status(403).json({
        error: 'This email address is reserved for system administration and cannot be invited as a mechanic.',
      });
      return;
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { mechanicProfile: true, ownedGarage: true },
    });

    if (existingUser) {
      if (existingUser.role === Role.MECHANIC || existingUser.mechanicProfile) {
        res.status(409).json({ error: 'A technician with this email address is already registered on RepairHub.' });
        return;
      }
      if (existingUser.role === Role.ADMIN) {
        res.status(409).json({ error: 'This email belongs to an Admin account and cannot be invited as a mechanic.' });
        return;
      }
      if (existingUser.role === Role.GARAGE || existingUser.ownedGarage) {
        res.status(409).json({ error: 'This email belongs to a Garage Owner account and cannot be invited as a mechanic.' });
        return;
      }
      // If the user has role CUSTOMER, we allow inviting them to become a technician for this garage!
    }

    // Cancel any prior unaccepted invitations for this email
    await prisma.mechanicInvitation.deleteMany({
      where: { email: normalizedEmail, acceptedAt: null },
    });

    // Generate secure single-use token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await prisma.mechanicInvitation.create({
      data: {
        garageId,
        email: normalizedEmail,
        name,
        phone,
        skills: skills || [],
        tokenHash,
        expiresAt,
      },
    });

    // Invitation link
    const inviteUrl = `${env.FRONTEND_URL}/mechanic/accept-invitation?token=${rawToken}`;

    // Send invitation email
    try {
      await emailService.sendGenericEmail({
        to: normalizedEmail,
        subject: `Invitation to join ${req.garage!.name} on RepairHub`,
        html: `
          <div style="font-family: sans-serif; background: #0B1729; color: #ffffff; padding: 32px; border-radius: 8px;">
            <h2 style="color: #22C7DB; margin-top: 0;">🔧 Welcome to RepairHub</h2>
            <p>Hello <strong>${name}</strong>,</p>
            <p>You have been invited by <strong>${req.garage!.name}</strong> (${req.garage!.city}) to join their mechanic team on the RepairHub platform.</p>
            <div style="margin: 28px 0;">
              <a href="${inviteUrl}" style="background-color: #FF8A3D; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Accept Invitation & Set Password
              </a>
            </div>
            <p style="color: #94A3B8; font-size: 13px;">This invitation link will expire in 7 days. If you did not expect this invitation, you can safely ignore this email.</p>
            <hr style="border: 0; border-top: 1px solid #1E293B; margin: 24px 0;" />
            <p style="color: #64748B; font-size: 12px;">RepairHub — Independent Garage Management Platform</p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error('Failed to send mechanic invitation email:', emailErr);
    }

    await logAudit({
      actorId: req.user!.userId,
      actorRole: req.user!.role,
      action: 'MECHANIC_INVITED',
      targetEntity: 'MechanicInvitation',
      targetId: invitation.id,
      metadata: { email: normalizedEmail, name, garageName: req.garage!.name },
    });

    res.status(201).json({
      message: `Invitation dispatched to ${normalizedEmail}`,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        name: invitation.name,
        expiresAt: invitation.expiresAt,
        inviteUrl, // also returned in response for easy local testing
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Updates a mechanic's active/suspended status in this garage.
 */
export async function updateMechanicStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params; // mechanic profile id or userId
    const { status, available } = req.body;
    const garageId = req.garage!.id;

    // Find profile
    const profile = await prisma.mechanicProfile.findFirst({
      where: {
        OR: [{ id }, { userId: id }],
        garageId,
      },
      include: { user: true },
    });

    if (!profile) {
      res.status(404).json({ error: 'Mechanic not found in your garage.' });
      return;
    }

    const updated = await prisma.mechanicProfile.update({
      where: { id: profile.id },
      data: {
        status: status ? (status as MechanicStatus) : undefined,
        available: available !== undefined ? Boolean(available) : undefined,
      },
      include: { user: true },
    });

    await logAudit({
      actorId: req.user!.userId,
      actorRole: req.user!.role,
      action: 'MECHANIC_STATUS_UPDATED',
      targetEntity: 'MechanicProfile',
      targetId: profile.id,
      metadata: { newStatus: status, mechanicEmail: profile.user.email },
    });

    res.json({ message: 'Mechanic status updated', mechanic: updated });
  } catch (err) {
    next(err);
  }
}

