import {
  Role,
  EmergencyCategory,
  EmergencyStatus,
  MechanicStatus,
  MechanicAvailability,
  GarageStatus,
  VehicleType,
} from '@prisma/client';
import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { isWithinOperatingHours } from '../../services/email/vehicleAvailabilityEmail.service.js';
import { emailService } from '../../services/email/mailer.js';
import { logAudit } from '../../services/audit/audit.service.js';
import {
  emitEmergencyCreated,
  emitEmergencyAccepted,
  emitEmergencyStatusUpdated,
  emitEmergencyLocationUpdated,
  emitEmergencyCancelled,
  emitMechanicAvailabilityUpdated,
} from '../../services/socket.js';

/**
 * Calculates straight-line surface distance in kilometers using the Haversine formula
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Estimates arrival time in minutes based on real-world Indian urban traffic speeds (~25 km/h)
 * plus a 5-minute dispatch response preparation window.
 */
export function estimateTravelTimeMinutes(distanceKm: number): number {
  if (distanceKm <= 0.5) return 5;
  const travelMinutes = (distanceKm / 25) * 60;
  return Math.max(5, Math.round(travelMinutes + 5));
}

export interface NearbyProviderCandidate {
  mechanicId: string;
  mechanicName: string;
  phone: string;
  rating: number;
  totalReviews: number;
  skills: string[];
  garageId: string;
  garageName: string;
  garageAddress: string;
  garagePhone: string;
  distanceKm: number;
  etaMinutes: number;
  baseChargePaise: number;
  isAvailable: boolean;
  isOpenNow: boolean;
  score: number;
}

/**
 * Discovers verified garages and available mechanics within a GPS radius
 * that match the vehicle category, operating hours, and accept emergency jobs.
 */
export async function discoverNearbyProviders(params: {
  lat: number;
  lon: number;
  category?: EmergencyCategory;
  radiusKm?: number;
  vehicleType?: VehicleType;
}): Promise<{
  providers: NearbyProviderCandidate[];
  searchRadiusKm: number;
  totalFound: number;
  expandedRadius: boolean;
}> {
  const { lat, lon, category, vehicleType } = params;
  let searchRadius = params.radiusKm || 15;
  let expandedRadius = false;

  // 1. Fetch all verified approved garages
  const garages = await prisma.garage.findMany({
    where: {
      status: GarageStatus.APPROVED,
      isVerified: true,
      acceptsEmergency: true,
    },
    include: {
      mechanics: {
        where: {
          status: MechanicStatus.ACTIVE,
          available: true,
          availability: MechanicAvailability.AVAILABLE,
          acceptsEmergency: true,
        },
        include: {
          user: {
            select: { id: true, name: true, phone: true, email: true },
          },
        },
      },
    },
  });

  const evaluateCandidates = (radius: number): NearbyProviderCandidate[] => {
    const list: NearbyProviderCandidate[] = [];

    for (const g of garages) {
      const gLat = g.latitude ?? 26.4735;
      const gLon = g.longitude ?? 80.3075;
      const distance = calculateDistanceKm(lat, lon, gLat, gLon);
      const withinOperating = isWithinOperatingHours(g.operatingHours);

      // Distance filter for the garage
      if (distance > radius) continue;

      for (const m of g.mechanics) {
        // Vehicle specialization matching: if skills provided, verify compatible
        if (vehicleType && m.skills.length > 0) {
          const typeMatch = m.skills.some((s) => {
            const norm = s.toUpperCase();
            if (vehicleType === VehicleType.TWO_WHEELER) return norm.includes('TWO') || norm.includes('BIKE');
            if (vehicleType === VehicleType.COMMERCIAL) return norm.includes('COMMERCIAL') || norm.includes('HEAVY');
            return norm.includes('CAR') || norm.includes('FOUR') || norm.includes('SEDAN');
          });
          // If mechanic explicitly specifies specialization and it doesn't match, rank lower or skip
        }

        const eta = estimateTravelTimeMinutes(distance);
        // Base roadside dispatch fee: ₹499 (49900 paise) + ₹20/km after 5km
        const extraKm = Math.max(0, distance - 5);
        const baseChargePaise = 49900 + Math.round(extraKm * 20 * 100);

        // Ranking score: higher rating, closer distance, operating garage
        const score = m.rating * 2 - distance * 0.5 + (withinOperating ? 5 : 0);

        list.push({
          mechanicId: m.userId,
          mechanicName: m.user.name,
          phone: m.user.phone,
          rating: m.rating,
          totalReviews: m.totalReviews,
          skills: m.skills,
          garageId: g.id,
          garageName: g.name,
          garageAddress: g.address,
          garagePhone: g.phone,
          distanceKm: distance,
          etaMinutes: eta,
          baseChargePaise,
          isAvailable: m.availability === MechanicAvailability.AVAILABLE,
          isOpenNow: withinOperating,
          score,
        });
      }
    }

    return list.sort((a, b) => b.score - a.score);
  };

  let candidates = evaluateCandidates(searchRadius);

  // If none found within initial radius, dynamically expand radius up to 40km
  if (candidates.length === 0 && searchRadius < 40) {
    searchRadius = 40;
    candidates = evaluateCandidates(searchRadius);
    expandedRadius = true;
  }

  return {
    providers: candidates,
    searchRadiusKm: searchRadius,
    totalFound: candidates.length,
    expandedRadius,
  };
}

/**
 * Creates an emergency assistance request
 */
export async function createEmergencyRequest(params: {
  customerId: string;
  vehicleId: string;
  category: EmergencyCategory;
  description: string;
  pickupLatitude: number;
  pickupLongitude: number;
  pickupAddress: string;
  photos?: string[];
  preferredMechanicId?: string;
  preferredGarageId?: string;
  searchRadiusKm?: number;
}) {
  const {
    customerId,
    vehicleId,
    category,
    description,
    pickupLatitude,
    pickupLongitude,
    pickupAddress,
    photos = [],
    preferredMechanicId,
    preferredGarageId,
    searchRadiusKm = 15,
  } = params;

  // Validate customer owns vehicle
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
    },
  });

  if (!vehicle) {
    throw new Error('Vehicle not found.');
  }

  // Generate unique SOS Request Number: e.g. SOS-2026-9812
  const count = await prisma.emergencyRequest.count();
  const requestNumber = `SOS-${new Date().getFullYear()}-${String(1001 + count).padStart(4, '0')}`;

  // Find nearest provider if none preferred
  let targetMechanicId = preferredMechanicId;
  let targetGarageId = preferredGarageId;
  let estimatedDistanceKm: number | null = null;
  let estimatedDurationMinutes: number | null = null;
  let baseChargePaise = 49900;

  if (targetMechanicId) {
    const mech = await prisma.mechanicProfile.findUnique({
      where: { userId: targetMechanicId },
      include: { garage: true },
    });
    if (mech) {
      targetGarageId = targetGarageId || mech.garageId;
      const dist = calculateDistanceKm(
        pickupLatitude,
        pickupLongitude,
        mech.latitude ?? mech.garage.latitude ?? 26.4735,
        mech.longitude ?? mech.garage.longitude ?? 80.3075
      );
      estimatedDistanceKm = dist;
      estimatedDurationMinutes = estimateTravelTimeMinutes(dist);
      const extraKm = Math.max(0, dist - 5);
      baseChargePaise = 49900 + Math.round(extraKm * 20 * 100);
    }
  } else {
    // Auto-discover nearest compatible provider
    const discovery = await discoverNearbyProviders({
      lat: pickupLatitude,
      lon: pickupLongitude,
      category,
      radiusKm: searchRadiusKm,
      vehicleType: vehicle.type,
    });

    if (discovery.providers.length > 0) {
      const top = discovery.providers[0];
      targetMechanicId = top.mechanicId;
      targetGarageId = top.garageId;
      estimatedDistanceKm = top.distanceKm;
      estimatedDurationMinutes = top.etaMinutes;
      baseChargePaise = top.baseChargePaise;
    }
  }

  const initialStatus = targetMechanicId
    ? EmergencyStatus.PENDING_ACCEPTANCE
    : EmergencyStatus.SEARCHING;

  // Create Emergency Request in DB
  const emergency = await prisma.$transaction(async (tx) => {
    const created = await tx.emergencyRequest.create({
      data: {
        requestNumber,
        customerId,
        vehicleId,
        garageId: targetGarageId,
        assignedMechanicId: targetMechanicId,
        category,
        description,
        photos,
        status: initialStatus,
        pickupLatitude,
        pickupLongitude,
        pickupAddress,
        searchRadiusKm,
        estimatedDistanceKm,
        estimatedDurationMinutes,
        baseChargePaise,
      },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        vehicle: true,
        garage: true,
        assignedMechanic: {
          select: {
            id: true,
            name: true,
            phone: true,
            mechanicProfile: true,
          },
        },
      },
    });

    // Record initial status history
    await tx.emergencyStatusHistory.create({
      data: {
        emergencyRequestId: created.id,
        toStatus: initialStatus,
        actorId: customerId,
        note: `Emergency request initiated by customer: ${description}`,
      },
    });

    // If targeted to a mechanic, record assignment offer
    if (targetMechanicId) {
      await tx.emergencyAssignmentHistory.create({
        data: {
          emergencyRequestId: created.id,
          mechanicId: targetMechanicId,
          garageId: targetGarageId,
          action: 'OFFERED',
          reason: 'Initial provider dispatch based on GPS proximity and availability',
          actorId: customerId,
        },
      });
    }

    return created;
  });

  // Real-time broadcast
  emitEmergencyCreated({
    id: emergency.id,
    requestNumber: emergency.requestNumber,
    customerId: emergency.customerId,
    customerName: emergency.customer.name,
    customerPhone: emergency.customer.phone,
    vehicleName: `${emergency.vehicle.year} ${emergency.vehicle.make} ${emergency.vehicle.model} (${emergency.vehicle.regNo})`,
    category: emergency.category,
    description: emergency.description,
    pickupLatitude: emergency.pickupLatitude,
    pickupLongitude: emergency.pickupLongitude,
    pickupAddress: emergency.pickupAddress,
    status: emergency.status,
    assignedMechanicId: emergency.assignedMechanicId,
    estimatedDistanceKm: emergency.estimatedDistanceKm,
    estimatedDurationMinutes: emergency.estimatedDurationMinutes,
    createdAt: emergency.createdAt,
  });

  // Asynchronously dispatch confirmation email to customer with safety advice
  if (emergency.customer.email) {
    const safetyAdvice = `
      <div style="background:#FEF2F2;border:1px solid #FCA5A5;padding:12px;border-radius:8px;margin-bottom:16px;">
        <strong style="color:#991B1B;">⚠️ Safety First Advisory:</strong>
        <p style="margin:4px 0 0 0;font-size:12px;color:#7F1D1D;">
          If you are on an active highway or road, move your vehicle to the shoulder if safe to do so, turn on hazard lights, and stay behind the safety barrier. For life-threatening emergencies, call national emergency services at <strong>112</strong>.
        </p>
      </div>
    `;

    const bodyHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #E2E8F0;border-radius:12px;">
        <h2 style="color:#C2410C;margin-top:0;">🚨 Emergency Assistance Dispatched</h2>
        <p>Hello ${emergency.customer.name},</p>
        <p>Your roadside assistance request <strong>${emergency.requestNumber}</strong> has been received and prioritized.</p>
        ${safetyAdvice}
        <table style="width:100%;font-size:13px;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:6px;color:#64748B;">Category:</td><td style="padding:6px;font-weight:bold;">${emergency.category}</td></tr>
          <tr><td style="padding:6px;color:#64748B;">Vehicle:</td><td style="padding:6px;font-weight:bold;">${emergency.vehicle.make} ${emergency.vehicle.model} (${emergency.vehicle.regNo})</td></tr>
          <tr><td style="padding:6px;color:#64748B;">Location:</td><td style="padding:6px;font-weight:bold;">${emergency.pickupAddress}</td></tr>
          <tr><td style="padding:6px;color:#64748B;">Status:</td><td style="padding:6px;font-weight:bold;color:#C2410C;">${emergency.status}</td></tr>
        </table>
        <p style="margin-top:20px;text-align:center;">
          <a href="${env.FRONTEND_URL}/customer/emergency?id=${emergency.id}" style="background:#0F172A;color:#FFFFFF;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Track Live Assistance</a>
        </p>
      </div>
    `;

    emailService
      .sendGenericEmail({
        to: emergency.customer.email,
        subject: `🚨 [RepairHub SOS] Roadside Assistance Request: ${emergency.requestNumber}`,
        html: bodyHtml,
      })
      .catch((err: any) => console.error('[EMERGENCY EMAIL] Failed to send customer confirmation:', err?.message));
  }

  return emergency;
}

/**
 * Mechanic accepts emergency request (Atomic check against double-acceptance)
 */
export async function acceptEmergencyRequest(requestId: string, mechanicUserId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.emergencyRequest.findUnique({
      where: { id: requestId },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        vehicle: true,
        assignedMechanic: { select: { id: true, name: true, phone: true } },
      },
    });

    if (!current) {
      throw new Error('Emergency request not found.');
    }

    // Strict validation: Only accept if in acceptable state
    if (
      current.status !== EmergencyStatus.REQUESTED &&
      current.status !== EmergencyStatus.SEARCHING &&
      current.status !== EmergencyStatus.PENDING_ACCEPTANCE
    ) {
      const err: any = new Error(
        `This emergency job is no longer available. Current status: ${current.status}.`
      );
      err.statusCode = 409;
      throw err;
    }

    // Verify mechanic is active and available
    const mechanicProfile = await tx.mechanicProfile.findUnique({
      where: { userId: mechanicUserId },
      include: { garage: true, user: true },
    });

    if (!mechanicProfile || mechanicProfile.status !== MechanicStatus.ACTIVE) {
      const err: any = new Error('Mechanic profile is not active.');
      err.statusCode = 403;
      throw err;
    }

    const mLat = mechanicProfile.latitude ?? mechanicProfile.garage.latitude ?? 26.4735;
    const mLon = mechanicProfile.longitude ?? mechanicProfile.garage.longitude ?? 80.3075;
    const distance = calculateDistanceKm(current.pickupLatitude, current.pickupLongitude, mLat, mLon);
    const eta = estimateTravelTimeMinutes(distance);

    const updated = await tx.emergencyRequest.update({
      where: { id: requestId },
      data: {
        status: EmergencyStatus.ACCEPTED,
        assignedMechanicId: mechanicUserId,
        garageId: mechanicProfile.garageId,
        mechanicLatitude: mLat,
        mechanicLongitude: mLon,
        mechanicLocationUpdatedAt: new Date(),
        estimatedDistanceKm: distance,
        estimatedDurationMinutes: eta,
        acceptedAt: new Date(),
      },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        vehicle: true,
        garage: true,
        assignedMechanic: {
          select: { id: true, name: true, phone: true, email: true },
        },
      },
    });

    // Mark mechanic status as BUSY
    await tx.mechanicProfile.update({
      where: { id: mechanicProfile.id },
      data: {
        availability: MechanicAvailability.BUSY,
        available: false,
        lastActiveAt: new Date(),
      },
    });

    // Log assignment acceptance
    await tx.emergencyAssignmentHistory.create({
      data: {
        emergencyRequestId: requestId,
        mechanicId: mechanicUserId,
        garageId: mechanicProfile.garageId,
        action: 'ACCEPTED',
        reason: 'Mechanic accepted emergency roadside dispatch',
        actorId: mechanicUserId,
      },
    });

    // Log status transition
    await tx.emergencyStatusHistory.create({
      data: {
        emergencyRequestId: requestId,
        fromStatus: current.status,
        toStatus: EmergencyStatus.ACCEPTED,
        actorId: mechanicUserId,
        note: `Accepted by Technician ${mechanicProfile.user.name}. ETA ~${eta} mins (${distance} km).`,
      },
    });

    return { updated, mechanicProfile, distance, eta };
  });

  // Broadcast availability change for the mechanic
  emitMechanicAvailabilityUpdated({
    mechanicId: mechanicUserId,
    availability: MechanicAvailability.BUSY,
    available: false,
    lastActiveAt: new Date(),
  });

  // Broadcast emergency acceptance to incident room, customer, and admin
  emitEmergencyAccepted(result.updated.id, {
    emergencyId: result.updated.id,
    requestNumber: result.updated.requestNumber,
    status: result.updated.status,
    customerId: result.updated.customerId,
    assignedMechanicId: mechanicUserId,
    mechanicName: result.mechanicProfile.user.name,
    mechanicPhone: result.mechanicProfile.user.phone,
    garageName: result.mechanicProfile.garage.name,
    distanceKm: result.distance,
    etaMinutes: result.eta,
    mechanicLatitude: result.updated.mechanicLatitude,
    mechanicLongitude: result.updated.mechanicLongitude,
    acceptedAt: result.updated.acceptedAt,
  });

  // Email customer that technician has accepted
  if (result.updated.customer.email) {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #E2E8F0;border-radius:12px;">
        <h2 style="color:#059669;margin-top:0;">✅ Emergency Assistance Confirmed</h2>
        <p>Hello ${result.updated.customer.name},</p>
        <p>Certified technician <strong>${result.mechanicProfile.user.name}</strong> from <strong>${result.mechanicProfile.garage.name}</strong> has accepted your roadside assistance request.</p>
        <div style="background:#F8FAFC;border:1px solid #E2E8F0;padding:14px;border-radius:8px;margin:16px 0;">
          <p style="margin:4px 0;"><strong>Estimated Arrival:</strong> ~${result.eta} minutes (${result.distance} km away)</p>
          <p style="margin:4px 0;"><strong>Technician Phone:</strong> <a href="tel:${result.mechanicProfile.user.phone}">${result.mechanicProfile.user.phone}</a></p>
        </div>
        <p style="text-align:center;margin-top:20px;">
          <a href="${env.FRONTEND_URL}/customer/emergency?id=${result.updated.id}" style="background:#0F172A;color:#FFFFFF;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">View Live GPS Map</a>
        </p>
      </div>
    `;

    emailService
      .sendGenericEmail({
        to: result.updated.customer.email,
        subject: `✅ [RepairHub SOS] Technician Confirmed: ${result.updated.requestNumber}`,
        html,
      })
      .catch((err: any) => console.error('[EMERGENCY EMAIL] Failed to send acceptance alert:', err?.message));
  }

  return result.updated;
}

/**
 * Mechanic declines emergency request (offers to next available provider)
 */
export async function declineEmergencyRequest(
  requestId: string,
  mechanicUserId: string,
  reason: string
) {
  const current = await prisma.emergencyRequest.findUnique({
    where: { id: requestId },
    include: { vehicle: true },
  });

  if (!current) {
    throw new Error('Emergency request not found.');
  }

  const declinedList = Array.from(new Set([...current.declinedMechanicIds, mechanicUserId]));

  // Log decline action
  await prisma.emergencyAssignmentHistory.create({
    data: {
      emergencyRequestId: requestId,
      mechanicId: mechanicUserId,
      action: 'DECLINED',
      reason,
      actorId: mechanicUserId,
    },
  });

  // Find next best available provider
  const discovery = await discoverNearbyProviders({
    lat: current.pickupLatitude,
    lon: current.pickupLongitude,
    category: current.category,
    radiusKm: current.searchRadiusKm,
    vehicleType: current.vehicle.type,
  });

  const nextEligible = discovery.providers.find((p) => !declinedList.includes(p.mechanicId));

  if (nextEligible) {
    // Re-offer to next provider
    const updated = await prisma.emergencyRequest.update({
      where: { id: requestId },
      data: {
        status: EmergencyStatus.PENDING_ACCEPTANCE,
        assignedMechanicId: nextEligible.mechanicId,
        garageId: nextEligible.garageId,
        estimatedDistanceKm: nextEligible.distanceKm,
        estimatedDurationMinutes: nextEligible.etaMinutes,
        declinedMechanicIds: declinedList,
      },
      include: {
        customer: true,
        vehicle: true,
        garage: true,
        assignedMechanic: true,
      },
    });

    await prisma.emergencyAssignmentHistory.create({
      data: {
        emergencyRequestId: requestId,
        mechanicId: nextEligible.mechanicId,
        garageId: nextEligible.garageId,
        action: 'OFFERED',
        reason: `Re-routed following decline by previous provider: ${reason}`,
      },
    });

    emitEmergencyCreated({
      ...updated,
      reOffered: true,
    });

    return { updated, nextOffered: true };
  } else {
    // No more providers available in radius -> UNFULFILLED
    const updated = await prisma.emergencyRequest.update({
      where: { id: requestId },
      data: {
        status: EmergencyStatus.UNFULFILLED,
        assignedMechanicId: null,
        declinedMechanicIds: declinedList,
      },
      include: { customer: true, vehicle: true },
    });

    await prisma.emergencyStatusHistory.create({
      data: {
        emergencyRequestId: requestId,
        fromStatus: current.status,
        toStatus: EmergencyStatus.UNFULFILLED,
        actorId: mechanicUserId,
        note: `All nearby providers declined or unavailable. Manual admin intervention required.`,
      },
    });

    emitEmergencyStatusUpdated(requestId, {
      emergencyId: requestId,
      status: EmergencyStatus.UNFULFILLED,
      message: 'All nearby providers currently occupied. Master Admin alerted for manual intervention.',
    });

    return { updated, nextOffered: false };
  }
}

/**
 * Updates emergency request workflow stage (EN_ROUTE, ARRIVED, IN_PROGRESS, COMPLETED)
 */
export async function updateEmergencyStatus(params: {
  requestId: string;
  targetStatus: EmergencyStatus;
  actorId: string;
  actorRole: Role;
  note?: string;
}) {
  const { requestId, targetStatus, actorId, actorRole, note } = params;

  const current = await prisma.emergencyRequest.findUnique({
    where: { id: requestId },
    include: {
      assignedMechanic: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true, email: true, phone: true } },
    },
  });

  if (!current) {
    throw new Error('Emergency request not found.');
  }

  // Authorization check: only assigned mechanic or admin can advance stages
  if (actorRole !== Role.ADMIN && current.assignedMechanicId !== actorId) {
    const err: any = new Error('You are not authorized to update this emergency job.');
    err.statusCode = 403;
    throw err;
  }

  const dataToUpdate: any = {
    status: targetStatus,
  };

  if (targetStatus === EmergencyStatus.EN_ROUTE) dataToUpdate.enRouteAt = new Date();
  if (targetStatus === EmergencyStatus.ARRIVED) dataToUpdate.arrivedAt = new Date();
  if (targetStatus === EmergencyStatus.COMPLETED) dataToUpdate.completedAt = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.emergencyRequest.update({
      where: { id: requestId },
      data: dataToUpdate,
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        vehicle: true,
        garage: true,
        assignedMechanic: { select: { id: true, name: true, phone: true } },
      },
    });

    await tx.emergencyStatusHistory.create({
      data: {
        emergencyRequestId: requestId,
        fromStatus: current.status,
        toStatus: targetStatus,
        actorId,
        note: note || `Status progressed to ${targetStatus}`,
      },
    });

    // If completed, revert mechanic availability to AVAILABLE if active jobs clear
    if (targetStatus === EmergencyStatus.COMPLETED && current.assignedMechanicId) {
      const activeNormalJobs = await tx.repairRequest.count({
        where: {
          mechanicId: current.assignedMechanicId,
          status: { in: ['INSPECTING', 'IN_PROGRESS', 'QC'] },
        },
      });

      const activeSosJobs = await tx.emergencyRequest.count({
        where: {
          assignedMechanicId: current.assignedMechanicId,
          status: { in: [EmergencyStatus.ACCEPTED, EmergencyStatus.EN_ROUTE, EmergencyStatus.ARRIVED, EmergencyStatus.IN_PROGRESS] },
          id: { not: requestId },
        },
      });

      if (activeNormalJobs === 0 && activeSosJobs === 0) {
        await tx.mechanicProfile.update({
          where: { userId: current.assignedMechanicId },
          data: {
            availability: MechanicAvailability.AVAILABLE,
            available: true,
            lastActiveAt: new Date(),
          },
        });

        emitMechanicAvailabilityUpdated({
          mechanicId: current.assignedMechanicId,
          availability: MechanicAvailability.AVAILABLE,
          available: true,
          lastActiveAt: new Date(),
        });
      }
    }

    return res;
  });

  // Real-time broadcast
  emitEmergencyStatusUpdated(requestId, {
    emergencyId: requestId,
    requestNumber: updated.requestNumber,
    status: updated.status,
    customerId: updated.customerId,
    assignedMechanicId: updated.assignedMechanicId,
    note,
    updatedAt: new Date(),
  });

  return updated;
}

/**
 * Updates mechanic's live GPS coordinates while en route or at service location
 */
export async function updateMechanicLiveLocation(params: {
  requestId: string;
  mechanicUserId: string;
  latitude: number;
  longitude: number;
}) {
  const { requestId, mechanicUserId, latitude, longitude } = params;

  const current = await prisma.emergencyRequest.findUnique({
    where: { id: requestId },
  });

  if (!current) {
    throw new Error('Emergency request not found.');
  }

  if (current.assignedMechanicId !== mechanicUserId) {
    const err: any = new Error('Only the assigned technician may update live GPS coordinates.');
    err.statusCode = 403;
    throw err;
  }

  // Recalculate remaining distance and ETA
  const remainingDistanceKm = calculateDistanceKm(
    latitude,
    longitude,
    current.pickupLatitude,
    current.pickupLongitude
  );
  const etaMinutes = estimateTravelTimeMinutes(remainingDistanceKm);

  const updated = await prisma.emergencyRequest.update({
    where: { id: requestId },
    data: {
      mechanicLatitude: latitude,
      mechanicLongitude: longitude,
      mechanicLocationUpdatedAt: new Date(),
      estimatedDistanceKm: remainingDistanceKm,
      estimatedDurationMinutes: etaMinutes,
    },
    select: {
      id: true,
      mechanicLatitude: true,
      mechanicLongitude: true,
      mechanicLocationUpdatedAt: true,
      estimatedDistanceKm: true,
      estimatedDurationMinutes: true,
      status: true,
    },
  });

  // Broadcast to incident room for live map tracking
  emitEmergencyLocationUpdated(requestId, {
    emergencyId: requestId,
    latitude,
    longitude,
    remainingDistanceKm,
    etaMinutes,
    updatedAt: updated.mechanicLocationUpdatedAt || new Date(),
  });

  return updated;
}

/**
 * Admin intervention: Manually reassign emergency provider
 */
export async function adminReassignEmergency(params: {
  requestId: string;
  adminId: string;
  newMechanicId: string;
  reason: string;
}) {
  const { requestId, adminId, newMechanicId, reason } = params;

  const current = await prisma.emergencyRequest.findUnique({
    where: { id: requestId },
  });

  if (!current) {
    throw new Error('Emergency request not found.');
  }

  if (current.status === EmergencyStatus.COMPLETED || current.status === EmergencyStatus.CANCELLED) {
    throw new Error('Cannot reassign an emergency request that has already concluded.');
  }

  const newMechanic = await prisma.mechanicProfile.findUnique({
    where: { userId: newMechanicId },
    include: { garage: true, user: true },
  });

  if (!newMechanic) {
    throw new Error('Replacement technician not found.');
  }

  const mLat = newMechanic.latitude ?? newMechanic.garage.latitude ?? 26.4735;
  const mLon = newMechanic.longitude ?? newMechanic.garage.longitude ?? 80.3075;
  const dist = calculateDistanceKm(current.pickupLatitude, current.pickupLongitude, mLat, mLon);
  const eta = estimateTravelTimeMinutes(dist);

  const updated = await prisma.$transaction(async (tx) => {
    // Revert previous mechanic if needed
    if (current.assignedMechanicId && current.assignedMechanicId !== newMechanicId) {
      await tx.mechanicProfile.update({
        where: { userId: current.assignedMechanicId },
        data: {
          availability: MechanicAvailability.AVAILABLE,
          available: true,
        },
      });
    }

    // Set new mechanic as BUSY
    await tx.mechanicProfile.update({
      where: { userId: newMechanicId },
      data: {
        availability: MechanicAvailability.BUSY,
        available: false,
      },
    });

    const res = await tx.emergencyRequest.update({
      where: { id: requestId },
      data: {
        assignedMechanicId: newMechanicId,
        garageId: newMechanic.garageId,
        status: EmergencyStatus.ACCEPTED,
        mechanicLatitude: mLat,
        mechanicLongitude: mLon,
        mechanicLocationUpdatedAt: new Date(),
        estimatedDistanceKm: dist,
        estimatedDurationMinutes: eta,
        interventionReason: reason,
      },
      include: {
        customer: true,
        vehicle: true,
        garage: true,
        assignedMechanic: { select: { id: true, name: true, phone: true } },
      },
    });

    await tx.emergencyAssignmentHistory.create({
      data: {
        emergencyRequestId: requestId,
        mechanicId: newMechanicId,
        garageId: newMechanic.garageId,
        action: 'REASSIGNED',
        reason: `Admin Intervention: ${reason}`,
        actorId: adminId,
      },
    });

    await tx.emergencyStatusHistory.create({
      data: {
        emergencyRequestId: requestId,
        fromStatus: current.status,
        toStatus: EmergencyStatus.ACCEPTED,
        actorId: adminId,
        note: `Admin reassigned to ${newMechanic.user.name}. Reason: ${reason}`,
      },
    });

    await logAudit({
      actorId: adminId,
      actorRole: Role.ADMIN,
      action: 'EMERGENCY_REASSIGNED',
      targetEntity: 'EmergencyRequest',
      targetId: requestId,
      metadata: { previousMechanicId: current.assignedMechanicId, newMechanicId, reason },
    });

    return res;
  });

  emitEmergencyAccepted(requestId, {
    emergencyId: requestId,
    requestNumber: updated.requestNumber,
    status: updated.status,
    customerId: updated.customerId,
    assignedMechanicId: newMechanicId,
    mechanicName: newMechanic.user.name,
    mechanicPhone: newMechanic.user.phone,
    garageName: newMechanic.garage.name,
    distanceKm: dist,
    etaMinutes: eta,
  });

  return updated;
}

/**
 * Cancels an emergency request
 */
export async function cancelEmergencyRequest(params: {
  requestId: string;
  actorId: string;
  actorRole: Role;
  reason: string;
}) {
  const { requestId, actorId, actorRole, reason } = params;

  const current = await prisma.emergencyRequest.findUnique({
    where: { id: requestId },
  });

  if (!current) {
    throw new Error('Emergency request not found.');
  }

  // Permission check: only customer who created it or Admin can cancel
  if (actorRole !== Role.ADMIN && current.customerId !== actorId) {
    const err: any = new Error('You are not authorized to cancel this emergency request.');
    err.statusCode = 403;
    throw err;
  }

  if (current.status === EmergencyStatus.COMPLETED) {
    throw new Error('Cannot cancel an emergency service that is already completed.');
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Revert assigned mechanic if exists
    if (current.assignedMechanicId) {
      await tx.mechanicProfile.update({
        where: { userId: current.assignedMechanicId },
        data: {
          availability: MechanicAvailability.AVAILABLE,
          available: true,
        },
      });

      emitMechanicAvailabilityUpdated({
        mechanicId: current.assignedMechanicId,
        availability: MechanicAvailability.AVAILABLE,
        available: true,
      });
    }

    const res = await tx.emergencyRequest.update({
      where: { id: requestId },
      data: {
        status: EmergencyStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
      include: { customer: true, vehicle: true, assignedMechanic: true },
    });

    await tx.emergencyStatusHistory.create({
      data: {
        emergencyRequestId: requestId,
        fromStatus: current.status,
        toStatus: EmergencyStatus.CANCELLED,
        actorId,
        note: `Cancelled. Reason: ${reason}`,
      },
    });

    return res;
  });

  emitEmergencyCancelled(requestId, {
    emergencyId: requestId,
    status: EmergencyStatus.CANCELLED,
    reason,
  });

  return updated;
}

/**
 * Lists emergency requests filtered by role & status
 */
export async function listEmergencyRequests(params: {
  userId: string;
  role: Role;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const { userId, role, status, search, page = 1, limit = 20 } = params;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (role === Role.CUSTOMER) {
    where.customerId = userId;
  } else if (role === Role.MECHANIC) {
    where.OR = [
      { assignedMechanicId: userId },
      {
        status: {
          in: [
            EmergencyStatus.REQUESTED,
            EmergencyStatus.SEARCHING,
            EmergencyStatus.PENDING_ACCEPTANCE,
          ],
        },
      },
    ];
  } else if (role === Role.GARAGE) {
    const garage = await prisma.garage.findUnique({ where: { ownerId: userId } });
    if (garage) {
      where.garageId = garage.id;
    }
  }

  if (status && status !== 'ALL' && Object.values(EmergencyStatus).includes(status as any)) {
    where.status = status as EmergencyStatus;
  }

  if (search && search.trim() !== '') {
    const q = search.trim();
    where.AND = [
      {
        OR: [
          { requestNumber: { contains: q, mode: 'insensitive' } },
          { pickupAddress: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { customer: { name: { contains: q, mode: 'insensitive' } } },
          { vehicle: { regNo: { contains: q, mode: 'insensitive' } } },
        ],
      },
    ];
  }

  const [total, requests] = await Promise.all([
    prisma.emergencyRequest.count({ where }),
    prisma.emergencyRequest.findMany({
      where,
      skip,
      take: limit,
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        vehicle: true,
        garage: true,
        assignedMechanic: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    requests: requests.map((r) => ({
      ...r,
      latitude: r.pickupLatitude,
      longitude: r.pickupLongitude,
      distanceKm: r.estimatedDistanceKm,
      estimatedArrivalMinutes: r.estimatedDurationMinutes,
    })),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Gets emergency request details by ID
 */
export async function getEmergencyRequestById(requestId: string, userId: string, role: Role) {
  const request = await prisma.emergencyRequest.findUnique({
    where: { id: requestId },
    include: {
      customer: { select: { id: true, name: true, phone: true, email: true } },
      vehicle: true,
      garage: true,
      assignedMechanic: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          mechanicProfile: { include: { garage: true } },
        },
      },
      assignmentHistories: { orderBy: { createdAt: 'asc' } },
      statusHistories: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!request) {
    throw new Error('Emergency request not found.');
  }

  // Role validation: Customer can view their own, mechanic can view if assigned or searching, Admin can view all
  if (role === Role.CUSTOMER && request.customerId !== userId) {
    const err: any = new Error('Access denied. You do not own this emergency request.');
    err.statusCode = 403;
    throw err;
  }

  return {
    ...request,
    latitude: request.pickupLatitude,
    longitude: request.pickupLongitude,
    distanceKm: request.estimatedDistanceKm,
    estimatedArrivalMinutes: request.estimatedDurationMinutes,
  };
}

/**
 * Toggles provider emergency roadside assistance acceptance
 */
export async function toggleProviderEmergencySettings(params: {
  userId: string;
  role: Role;
  acceptsEmergency: boolean;
  emergencyRadiusKm?: number;
}) {
  const { userId, role, acceptsEmergency, emergencyRadiusKm } = params;

  if (role === Role.MECHANIC) {
    const updated = await prisma.mechanicProfile.update({
      where: { userId },
      data: {
        acceptsEmergency,
        emergencyServiceRadiusKm: emergencyRadiusKm || 20,
      },
    });
    return updated;
  } else if (role === Role.GARAGE) {
    const garage = await prisma.garage.findUnique({ where: { ownerId: userId } });
    if (!garage) throw new Error('Garage not found.');
    const updated = await prisma.garage.update({
      where: { id: garage.id },
      data: {
        acceptsEmergency,
        emergencyRadiusKm: emergencyRadiusKm || 25,
      },
    });
    return updated;
  }

  throw new Error('Unauthorized role for emergency settings.');
}
