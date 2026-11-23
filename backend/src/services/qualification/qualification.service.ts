import {
  Role,
  RequestStatus,
  RepairCategory,
  VehicleType,
  PowertrainType,
  GarageStatus,
  MechanicStatus,
  MechanicAvailability,
  EmailNotificationStatus,
  EmailNotificationType,
} from '@prisma/client';
import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { isWithinOperatingHours } from '../email/vehicleAvailabilityEmail.service.js';
import { emailService } from '../email/mailer.js';
import { emitRequestUpdated, emitMechanicAvailabilityUpdated, emitNotification } from '../socket.js';

export interface RequiredSkillAnalysis {
  requiredSkills: string[];
  primaryPowertrain: PowertrainType;
  matchedRuleDescription?: string;
}

export interface QualifiedMechanicCandidate {
  mechanicId: string;
  name: string;
  email: string;
  phone: string;
  garageId: string;
  garageName: string;
  rating: number;
  skills: string[];
  activeJobCount: number;
  distanceKm?: number;
  estimatedWaitMinutes?: number;
}

export interface GarageVerificationResult {
  garageId: string;
  garageName: string;
  isOpen: boolean;
  isApproved: boolean;
  supportsVehicleType: boolean;
  supportsPowertrain: boolean;
  eligibilityStatus:
    | 'QUALIFIED_AND_FREE'
    | 'CURRENTLY_BUSY'
    | 'NO_QUALIFIED_MECHANIC'
    | 'SKILLS_PENDING_REVIEW'
    | 'GARAGE_CLOSED'
    | 'GARAGE_NOT_APPROVED'
    | 'POWERTRAIN_NOT_SUPPORTED';
  unavailabilityReason?: string;
  requiredSkills: string[];
  qualifiedFreeMechanics: QualifiedMechanicCandidate[];
  qualifiedBusyMechanics: QualifiedMechanicCandidate[];
  pendingReviewCount: number;
}

/**
 * Calculates Haversine distance in km between two GPS coordinates
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
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
 * 1. Intake: Derives required skills from vehicle powertrain + reported issue description + category
 * using the dynamic, editable IssueSkillMapping table in the database.
 */
export async function deriveRequiredSkills(
  category: RepairCategory,
  powertrain: PowertrainType,
  description?: string
): Promise<RequiredSkillAnalysis> {
  const descLower = (description || '').toLowerCase();

  // Query all active mappings for this category or wildcard category
  const mappings = await prisma.issueSkillMapping.findMany({
    where: {
      category,
      isActive: true,
      OR: [{ powertrain }, { powertrain: null }],
    },
    orderBy: { priority: 'desc' },
  });

  // 1. Look for specific issue pattern match first
  for (const m of mappings) {
    if (m.issuePattern && m.issuePattern.trim() !== '') {
      const pattern = m.issuePattern.toLowerCase().trim();
      if (descLower.includes(pattern)) {
        return {
          requiredSkills: m.requiredSkills,
          primaryPowertrain: powertrain,
          matchedRuleDescription: m.description || `Matched pattern '${m.issuePattern}' for ${category} on ${powertrain}`,
        };
      }
    }
  }

  // 2. Look for powertrain-specific general mapping
  const powertrainMatch = mappings.find((m) => m.powertrain === powertrain && !m.issuePattern);
  if (powertrainMatch && powertrainMatch.requiredSkills.length > 0) {
    return {
      requiredSkills: powertrainMatch.requiredSkills,
      primaryPowertrain: powertrain,
      matchedRuleDescription: powertrainMatch.description || `Powertrain match for ${powertrain} in ${category}`,
    };
  }

  // 3. Fallback to generic category mapping
  const genericMatch = mappings.find((m) => !m.powertrain && !m.issuePattern);
  if (genericMatch && genericMatch.requiredSkills.length > 0) {
    return {
      requiredSkills: genericMatch.requiredSkills,
      primaryPowertrain: powertrain,
      matchedRuleDescription: genericMatch.description || `Generic ${category} service`,
    };
  }

  // 4. Default safety fallback:
  let fallbackSkills: string[] = [category.toString()];
  if (powertrain === PowertrainType.ELECTRIC) {
    if (descLower.includes('battery') || category === RepairCategory.ELECTRICAL) {
      fallbackSkills = ['EV_BATTERY'];
    } else {
      fallbackSkills = ['ELECTRIC_POWERTRAIN'];
    }
  } else if (powertrain === PowertrainType.HYBRID && descLower.includes('battery')) {
    fallbackSkills = ['HYBRID_SYSTEM', 'EV_BATTERY'];
  }

  return {
    requiredSkills: fallbackSkills,
    primaryPowertrain: powertrain,
    matchedRuleDescription: `Default skill inference for ${category} on ${powertrain}`,
  };
}

/**
 * Normalizes vehicle powertrain from string or model hints (e.g. "Nexon EV" -> ELECTRIC)
 */
export function inferPowertrainFromVehicle(vehicle: {
  powertrain?: PowertrainType | null;
  fuelType?: string | null;
  make?: string;
  model?: string;
}): PowertrainType {
  if (vehicle.powertrain && Object.values(PowertrainType).includes(vehicle.powertrain)) {
    return vehicle.powertrain;
  }
  const text = `${vehicle.make || ''} ${vehicle.model || ''} ${vehicle.fuelType || ''}`.toUpperCase();
  if (text.includes('EV') || text.includes('ELECTRIC')) return PowertrainType.ELECTRIC;
  if (text.includes('HYBRID')) return PowertrainType.HYBRID;
  if (text.includes('DIESEL')) return PowertrainType.DIESEL;
  if (text.includes('CNG')) return PowertrainType.CNG;
  return PowertrainType.PETROL;
}

/**
 * Evaluates whether a mechanic satisfies required repair skills.
 * Never counts unrelated skills. Checks for skillsPendingReview.
 */
export function checkMechanicQualification(
  mechanic: {
    skills: string[];
    skillsPendingReview?: boolean;
    specialization?: string | null;
  },
  requiredSkills: string[] = []
): {
  isQualified: boolean;
  isPendingReview: boolean;
  matchedSkills: string[];
  missingSkills: string[];
} {
  const safeRequired = Array.isArray(requiredSkills) ? requiredSkills : [];

  // Flagged or empty skills must be surfaced as Skills Pending Review
  if (mechanic.skillsPendingReview || !mechanic.skills || mechanic.skills.length === 0) {
    return {
      isQualified: false,
      isPendingReview: true,
      matchedSkills: [],
      missingSkills: safeRequired,
    };
  }

  const normalizedMechSkills = (mechanic.skills || []).map((s) => s.toUpperCase().trim());
  const specUpper = (mechanic.specialization || '').toUpperCase();

  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const req of safeRequired) {
    const reqUpper = req.toUpperCase().trim();
    // Match exact skill or sub-specialization equivalent
    const hasExact = normalizedMechSkills.includes(reqUpper);
    const hasRelatedEV =
      reqUpper === 'EV_BATTERY' &&
      (normalizedMechSkills.includes('EV_BATTERY') ||
        normalizedMechSkills.includes('HIGH_VOLTAGE_BATTERY') ||
        specUpper.includes('EV BATTERY'));

    const hasRelatedGeneral =
      reqUpper === 'GENERAL_SERVICE' &&
      (normalizedMechSkills.includes('GENERAL_SERVICE') || normalizedMechSkills.includes('ENGINE'));

    if (hasExact || hasRelatedEV || hasRelatedGeneral) {
      matchedSkills.push(req);
    } else {
      missingSkills.push(req);
    }
  }

  const isQualified = missingSkills.length === 0;

  return {
    isQualified,
    isPendingReview: false,
    matchedSkills,
    missingSkills,
  };
}

/**
 * 2, 3, 4, 5, 6: Verifies garage status, vehicle support, skill match, and availability
 */
export async function verifyGarageEligibility(params: {
  garageId: string;
  vehicleType: VehicleType;
  powertrain: PowertrainType;
  requiredSkills: string[];
}): Promise<GarageVerificationResult> {
  const { garageId, vehicleType, powertrain, requiredSkills } = params;

  const garage = await prisma.garage.findUnique({
    where: { id: garageId },
    include: {
      mechanics: {
        where: {
          status: MechanicStatus.ACTIVE,
        },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
      },
    },
  });

  if (!garage) {
    return {
      garageId,
      garageName: 'Unknown Workshop',
      isOpen: false,
      isApproved: false,
      supportsVehicleType: false,
      supportsPowertrain: false,
      eligibilityStatus: 'GARAGE_NOT_APPROVED',
      unavailabilityReason: 'Selected garage does not exist.',
      requiredSkills,
      qualifiedFreeMechanics: [],
      qualifiedBusyMechanics: [],
      pendingReviewCount: 0,
    };
  }

  // 1. Garage approval and verification check
  const isApproved = garage.status === GarageStatus.APPROVED && garage.isVerified;
  if (!isApproved) {
    return {
      garageId: garage.id,
      garageName: garage.name,
      isOpen: false,
      isApproved: false,
      supportsVehicleType: true,
      supportsPowertrain: true,
      eligibilityStatus: 'GARAGE_NOT_APPROVED',
      unavailabilityReason:
        garage.status !== GarageStatus.APPROVED
          ? `Garage is currently ${garage.status.toLowerCase()} and cannot accept bookings.`
          : 'Garage is unverified by platform administration.',
      requiredSkills,
      qualifiedFreeMechanics: [],
      qualifiedBusyMechanics: [],
      pendingReviewCount: 0,
    };
  }

  // 2. Garage operating hours check
  const isOpen = isWithinOperatingHours(garage.operatingHours);
  if (!isOpen) {
    return {
      garageId: garage.id,
      garageName: garage.name,
      isOpen: false,
      isApproved: true,
      supportsVehicleType: true,
      supportsPowertrain: true,
      eligibilityStatus: 'GARAGE_CLOSED',
      unavailabilityReason: `Garage closed (outside operating hours: ${garage.operatingHours || '08:00 - 20:00 IST'}).`,
      requiredSkills,
      qualifiedFreeMechanics: [],
      qualifiedBusyMechanics: [],
      pendingReviewCount: 0,
    };
  }

  // 3. Vehicle Category support check
  const supportsVehicleType =
    !garage.supportedVehicleTypes ||
    garage.supportedVehicleTypes.length === 0 ||
    garage.supportedVehicleTypes.includes(vehicleType);

  if (!supportsVehicleType) {
    return {
      garageId: garage.id,
      garageName: garage.name,
      isOpen: true,
      isApproved: true,
      supportsVehicleType: false,
      supportsPowertrain: true,
      eligibilityStatus: 'POWERTRAIN_NOT_SUPPORTED',
      unavailabilityReason: `Workshop does not service ${vehicleType.toLowerCase().replace('_', ' ')} vehicles.`,
      requiredSkills,
      qualifiedFreeMechanics: [],
      qualifiedBusyMechanics: [],
      pendingReviewCount: 0,
    };
  }

  // 4. Vehicle Powertrain support check (petrol, diesel, electric, hybrid, etc.)
  const supportsPowertrain =
    !garage.supportedPowertrains ||
    garage.supportedPowertrains.length === 0 ||
    garage.supportedPowertrains.includes(powertrain);

  if (!supportsPowertrain) {
    return {
      garageId: garage.id,
      garageName: garage.name,
      isOpen: true,
      isApproved: true,
      supportsVehicleType: true,
      supportsPowertrain: false,
      eligibilityStatus: 'POWERTRAIN_NOT_SUPPORTED',
      unavailabilityReason: `Workshop does not have infrastructure or tooling for ${powertrain.toLowerCase()} powertrains.`,
      requiredSkills,
      qualifiedFreeMechanics: [],
      qualifiedBusyMechanics: [],
      pendingReviewCount: 0,
    };
  }

  // 5. Evaluate all active mechanics in the garage
  const qualifiedFreeMechanics: QualifiedMechanicCandidate[] = [];
  const qualifiedBusyMechanics: QualifiedMechanicCandidate[] = [];
  let pendingReviewCount = 0;

  // Active repair statuses that represent a busy technician
  const activeRepairStatuses: RequestStatus[] = [
    RequestStatus.ASSIGNED,
    RequestStatus.INSPECTING,
    RequestStatus.ESTIMATE_SENT,
    RequestStatus.APPROVED,
    RequestStatus.IN_PROGRESS,
    RequestStatus.QC,
  ];

  for (const mech of garage.mechanics) {
    const qual = checkMechanicQualification(mech, requiredSkills);

    if (qual.isPendingReview) {
      pendingReviewCount++;
      continue;
    }

    if (!qual.isQualified) {
      // Unrelated mechanic (e.g. petrol mechanic for an EV battery repair) -> STRICTLY EXCLUDED
      continue;
    }

    // Qualified mechanic found! Now check availability / workload:
    const activeJobs = await prisma.repairRequest.count({
      where: {
        mechanicId: mech.userId,
        status: { in: activeRepairStatuses },
      },
    });

    const isAvailableOnDuty =
      mech.available &&
      mech.availability === MechanicAvailability.AVAILABLE &&
      mech.status === MechanicStatus.ACTIVE;

    const candidate: QualifiedMechanicCandidate = {
      mechanicId: mech.userId,
      name: mech.user.name,
      email: mech.user.email,
      phone: mech.user.phone,
      garageId: garage.id,
      garageName: garage.name,
      rating: mech.rating,
      skills: mech.skills,
      activeJobCount: activeJobs,
      estimatedWaitMinutes: activeJobs > 0 ? activeJobs * 45 : 0,
    };

    if (isAvailableOnDuty && activeJobs === 0) {
      qualifiedFreeMechanics.push(candidate);
    } else {
      qualifiedBusyMechanics.push(candidate);
    }
  }

  // Determine overall status & human-readable reason
  if (qualifiedFreeMechanics.length > 0) {
    return {
      garageId: garage.id,
      garageName: garage.name,
      isOpen: true,
      isApproved: true,
      supportsVehicleType: true,
      supportsPowertrain: true,
      eligibilityStatus: 'QUALIFIED_AND_FREE',
      unavailabilityReason: undefined,
      requiredSkills,
      qualifiedFreeMechanics,
      qualifiedBusyMechanics,
      pendingReviewCount,
    };
  }

  if (qualifiedBusyMechanics.length > 0) {
    const waitTime = Math.min(...qualifiedBusyMechanics.map((m) => m.estimatedWaitMinutes || 45));
    return {
      garageId: garage.id,
      garageName: garage.name,
      isOpen: true,
      isApproved: true,
      supportsVehicleType: true,
      supportsPowertrain: true,
      eligibilityStatus: 'CURRENTLY_BUSY',
      unavailabilityReason: `Qualified mechanics currently busy (${qualifiedBusyMechanics.length} technician on active repair, estimated wait ~${waitTime} mins).`,
      requiredSkills,
      qualifiedFreeMechanics,
      qualifiedBusyMechanics,
      pendingReviewCount,
    };
  }

  if (pendingReviewCount > 0) {
    return {
      garageId: garage.id,
      garageName: garage.name,
      isOpen: true,
      isApproved: true,
      supportsVehicleType: true,
      supportsPowertrain: true,
      eligibilityStatus: 'SKILLS_PENDING_REVIEW',
      unavailabilityReason: `Skills Pending Review: ${pendingReviewCount} mechanic(s) in workshop require skill profile review by Master Admin.`,
      requiredSkills,
      qualifiedFreeMechanics,
      qualifiedBusyMechanics,
      pendingReviewCount,
    };
  }

  // No qualified mechanic in the garage!
  const skillsLabel = requiredSkills.map((s) => s.replace(/_/g, ' ')).join(', ');
  return {
    garageId: garage.id,
    garageName: garage.name,
    isOpen: true,
    isApproved: true,
    supportsVehicleType: true,
    supportsPowertrain: true,
    eligibilityStatus: 'NO_QUALIFIED_MECHANIC',
    unavailabilityReason: `No qualified ${skillsLabel} technician available at this workshop.`,
    requiredSkills,
    qualifiedFreeMechanics,
    qualifiedBusyMechanics,
    pendingReviewCount,
  };
}

/**
 * 7. Fallback Search: If target garage fails eligibility, search other approved garages.
 * Ranks candidates by:
 * 1. Nearest garage first (Haversine distance)
 * 2. Qualified mechanic with the lightest current workload (fewest active jobs).
 */
export async function findBestEligibleGarageAndMechanic(params: {
  vehicleType: VehicleType;
  powertrain: PowertrainType;
  requiredSkills: string[];
  referenceLat?: number;
  referenceLon?: number;
  preferredGarageId?: string;
}): Promise<{
  matchedGarage?: GarageVerificationResult;
  selectedMechanic?: QualifiedMechanicCandidate;
  allGarageResults: GarageVerificationResult[];
  overallStatus:
    | 'QUALIFIED_AND_FREE'
    | 'CURRENTLY_BUSY'
    | 'NO_QUALIFIED_MECHANIC'
    | 'SKILLS_PENDING_REVIEW';
  unavailabilityReason: string;
}> {
  const { vehicleType, powertrain, requiredSkills, referenceLat = 26.4735, referenceLon = 80.3075 } = params;

  // 1. Fetch all approved garages
  const approvedGarages = await prisma.garage.findMany({
    where: {
      status: GarageStatus.APPROVED,
      isVerified: true,
    },
    select: { id: true, name: true, latitude: true, longitude: true },
  });

  const allGarageResults: GarageVerificationResult[] = [];

  for (const g of approvedGarages) {
    const res = await verifyGarageEligibility({
      garageId: g.id,
      vehicleType,
      powertrain,
      requiredSkills,
    });
    allGarageResults.push(res);
  }

  // 2. Separate garages with qualified free mechanics
  const garagesWithFree = allGarageResults.filter(
    (g) => g.eligibilityStatus === 'QUALIFIED_AND_FREE' && g.qualifiedFreeMechanics.length > 0
  );

  if (garagesWithFree.length > 0) {
    // Rank by distance to reference coordinates, then by workload
    garagesWithFree.sort((a, b) => {
      const gA = approvedGarages.find((x) => x.id === a.garageId);
      const gB = approvedGarages.find((x) => x.id === b.garageId);
      const distA = calculateDistanceKm(referenceLat, referenceLon, gA?.latitude ?? 26.4735, gA?.longitude ?? 80.3075);
      const distB = calculateDistanceKm(referenceLat, referenceLon, gB?.latitude ?? 26.4735, gB?.longitude ?? 80.3075);
      return distA - distB;
    });

    const topGarage = garagesWithFree[0];
    // Select mechanic with lightest workload, then highest rating
    topGarage.qualifiedFreeMechanics.sort((a, b) => {
      if (a.activeJobCount !== b.activeJobCount) return a.activeJobCount - b.activeJobCount;
      return b.rating - a.rating;
    });

    const selectedMechanic = topGarage.qualifiedFreeMechanics[0];

    return {
      matchedGarage: topGarage,
      selectedMechanic,
      allGarageResults,
      overallStatus: 'QUALIFIED_AND_FREE',
      unavailabilityReason: `Qualified specialist ${selectedMechanic.name} available at ${topGarage.garageName}.`,
    };
  }

  // 3. If none free, check if qualified busy mechanics exist across network
  const garagesWithBusy = allGarageResults.filter(
    (g) => g.eligibilityStatus === 'CURRENTLY_BUSY' && g.qualifiedBusyMechanics.length > 0
  );

  if (garagesWithBusy.length > 0) {
    const topGarage = garagesWithBusy[0];
    const topMechanic = topGarage.qualifiedBusyMechanics[0];
    return {
      matchedGarage: topGarage,
      selectedMechanic: topMechanic,
      allGarageResults,
      overallStatus: 'CURRENTLY_BUSY',
      unavailabilityReason: topGarage.unavailabilityReason || 'Qualified specialists currently busy on repair bays.',
    };
  }

  // 4. Check if any pending review
  const hasPendingReview = allGarageResults.some((g) => g.pendingReviewCount > 0);
  if (hasPendingReview) {
    return {
      allGarageResults,
      overallStatus: 'SKILLS_PENDING_REVIEW',
      unavailabilityReason: 'Skills Pending Review: Technicians in network require skill tagging by Master Admin.',
    };
  }

  // 5. No garage has qualified mechanic!
  const skillsLabel = requiredSkills.map((s) => s.replace(/_/g, ' ')).join(', ');
  return {
    allGarageResults,
    overallStatus: 'NO_QUALIFIED_MECHANIC',
    unavailabilityReason: `No qualified ${skillsLabel} technician available across all registered workshops.`,
  };
}

/**
 * 12. Double-booking prevention & Transactional Assignment:
 * Rechecks availability inside a Prisma database transaction with atomic lock.
 * If recheck fails (claimed by concurrent request), reruns search instead of assigning!
 */
export async function assignMechanicTransactionally(params: {
  requestId: string;
  targetMechanicId: string;
  garageId?: string;
  assignedById?: string;
  performedByUserId?: string;
  assignedByRole?: Role;
  reason?: string;
  requiredSkills?: string[];
}): Promise<{
  success: boolean;
  assignedRequest?: any;
  rerouted?: boolean;
  newMechanicId?: string;
  eligibilityStatus: string;
  unavailabilityReason?: string;
}> {
  const {
    requestId,
    targetMechanicId,
    garageId: inputGarageId,
    assignedByRole = Role.ADMIN,
    reason = 'Smart qualified mechanic allocation',
    requiredSkills,
  } = params;

  const assignedById = params.assignedById || params.performedByUserId || '';

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Fetch Request with pessimistic recheck
        const request = await tx.repairRequest.findUnique({
          where: { id: requestId },
          include: { vehicle: true, customer: true, garage: true },
        });

      if (!request) {
        throw new Error('Repair request not found.');
      }

      // Reassignment lock check: only SUBMITTED or ASSIGNED can be assigned/reassigned
      if (
        request.status !== RequestStatus.SUBMITTED &&
        request.status !== RequestStatus.ASSIGNED
      ) {
        throw new Error(
          `Cannot assign or reassign request in status ${request.status}. Once inspection begins, reassignment is locked.`
        );
      }

      // 2. Atomic Mechanic Check:
      const mechProfile = await tx.mechanicProfile.findUnique({
        where: { userId: targetMechanicId },
        include: { user: true, garage: true },
      });

      if (!mechProfile) {
        throw new Error('Mechanic profile not found.');
      }

      // Verify qualifications
      const effectiveSkills =
        requiredSkills && requiredSkills.length > 0
          ? requiredSkills
          : request.requiredSkills && request.requiredSkills.length > 0
          ? request.requiredSkills
          : [];
      const qual = checkMechanicQualification(mechProfile, effectiveSkills);
      if (!qual.isQualified) {
        throw new Error(
          `Mechanic ${mechProfile.user.name} is not qualified for required skills: ${effectiveSkills.join(', ')}`
        );
      }

      // Concurrency check: Ensure mechanic has NOT been claimed simultaneously
      const activeJobCount = await tx.repairRequest.count({
        where: {
          mechanicId: targetMechanicId,
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
          id: { not: requestId }, // exclude current request if re-assigning same
        },
      });

      // 3. Atomic mechanic claim: atomic update with row condition
      // Ensures two concurrent requests cannot claim the same technician
      const isInitialOrDifferent = request.mechanicId !== targetMechanicId;
      if (isInitialOrDifferent) {
        const claimResult = await tx.mechanicProfile.updateMany({
          where: {
            id: mechProfile.id,
            available: true,
            availability: MechanicAvailability.AVAILABLE,
            status: MechanicStatus.ACTIVE,
          },
          data: {
            availability: MechanicAvailability.BUSY,
            available: false,
            lastActiveAt: new Date(),
          },
        });

        if (claimResult.count === 0 || activeJobCount > 0) {
          // Concurrency conflict / Race condition detected!
          const raceErr: any = new Error('CONCURRENT_DOUBLE_BOOKING_PREVENTED');
          raceErr.code = 'CONCURRENT_DOUBLE_BOOKING_PREVENTED';
          throw raceErr;
        }
      } else {
        if (activeJobCount > 0) {
          const raceErr: any = new Error('CONCURRENT_DOUBLE_BOOKING_PREVENTED');
          raceErr.code = 'CONCURRENT_DOUBLE_BOOKING_PREVENTED';
          throw raceErr;
        }
        await tx.mechanicProfile.update({
          where: { id: mechProfile.id },
          data: {
            availability: MechanicAvailability.BUSY,
            available: false,
            lastActiveAt: new Date(),
          },
        });
      }

      // If reassigning from a previous mechanic, mark previous mechanic AVAILABLE
      if (request.mechanicId && request.mechanicId !== targetMechanicId) {
        const prevMech = await tx.mechanicProfile.findUnique({
          where: { userId: request.mechanicId },
        });
        if (prevMech) {
          const prevOtherJobs = await tx.repairRequest.count({
            where: {
              mechanicId: request.mechanicId,
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
              id: { not: requestId },
            },
          });
          if (prevOtherJobs === 0 && prevMech.status === MechanicStatus.ACTIVE) {
            await tx.mechanicProfile.update({
              where: { id: prevMech.id },
              data: { availability: MechanicAvailability.AVAILABLE, available: true },
            });
          }
        }
      }

      // 4. Update RepairRequest
      const updatedRequest = await tx.repairRequest.update({
        where: { id: requestId },
        data: {
          status: RequestStatus.ASSIGNED,
          mechanicId: targetMechanicId,
          garageId: inputGarageId || mechProfile.garageId || request.garageId,
          eligibilityStatus: 'QUALIFIED_AND_FREE',
          unavailabilityReason: null,
          requiredSkills,
        },
        include: {
          customer: { select: { id: true, name: true, email: true, phone: true } },
          vehicle: true,
          garage: true,
          mechanic: { select: { id: true, name: true, email: true, phone: true } },
        },
      });

      // 5. Create AssignmentHistory record
      await tx.assignmentHistory.create({
        data: {
          requestId,
          previousMechanicId: request.mechanicId,
          newMechanicId: targetMechanicId,
          assignedById,
          assignedByRole,
          action: request.mechanicId ? 'REASSIGNED' : 'ASSIGNED',
          checkResult: 'PASS',
          reason: `${reason}. Verified qualified in: ${effectiveSkills.join(', ')}`,
        },
      });

      // 6. Record status history
      await tx.statusHistory.create({
        data: {
          requestId,
          fromStatus: request.status,
          toStatus: RequestStatus.ASSIGNED,
          actorId: assignedById,
          actorRole: assignedByRole,
          note: `Assigned to qualified specialist ${mechProfile.user.name} (${mechProfile.garageId})`,
        },
      });

      return { updatedRequest, mechProfile };
    }, { maxWait: 15000, timeout: 25000 });

    // Post-transaction notifications
    emitMechanicAvailabilityUpdated({
      mechanicId: targetMechanicId,
      availability: MechanicAvailability.BUSY,
      available: false,
    });
    emitRequestUpdated(requestId, result.updatedRequest);

    return {
      success: true,
      assignedRequest: result.updatedRequest,
      newMechanicId: targetMechanicId,
      eligibilityStatus: 'QUALIFIED_AND_FREE',
    };
  } catch (err: any) {
    if (err?.code === 'CONCURRENT_DOUBLE_BOOKING_PREVENTED') {
      // Acceptance Test 5: Recheck failed! Rerun the search instead of assigning!
      console.warn(`[DOUBLE-BOOKING PREVENTED] Mechanic ${targetMechanicId} was claimed concurrently. Rerunning fallback search...`);
      
      const req = await prisma.repairRequest.findUnique({
        where: { id: requestId },
        include: { vehicle: true },
      });

      if (!req) {
        return { success: false, eligibilityStatus: 'NO_QUALIFIED_MECHANIC', unavailabilityReason: 'Request not found' };
      }

      const powertrain = inferPowertrainFromVehicle(req.vehicle);
      const skillsToSearch =
        requiredSkills && requiredSkills.length > 0
          ? requiredSkills
          : req.requiredSkills && req.requiredSkills.length > 0
          ? req.requiredSkills
          : [];
      const fallback = await findBestEligibleGarageAndMechanic({
        vehicleType: req.vehicle.type,
        powertrain,
        requiredSkills: skillsToSearch,
        preferredGarageId: inputGarageId || req.garageId,
      });

      if (fallback.overallStatus === 'QUALIFIED_AND_FREE' && fallback.selectedMechanic) {
        // Reroute to next candidate
        return await assignMechanicTransactionally({
          requestId,
          targetMechanicId: fallback.selectedMechanic.mechanicId,
          garageId: fallback.selectedMechanic.garageId,
          assignedById,
          assignedByRole,
          reason: 'Auto-rerouted after concurrent double-booking prevention',
          requiredSkills,
        });
      } else {
        // Mark currently busy or no qualified
        await prisma.repairRequest.update({
          where: { id: requestId },
          data: {
            eligibilityStatus: fallback.overallStatus,
            unavailabilityReason: fallback.unavailabilityReason,
          },
        });

        // Log double booking prevention in assignment history
        await prisma.assignmentHistory.create({
          data: {
            requestId,
            previousMechanicId: null,
            newMechanicId: null,
            assignedById,
            assignedByRole,
            action: 'DOUBLE_BOOKING_PREVENTED',
            checkResult: 'FAIL_BUSY',
            reason: `Concurrent double-booking prevented for mechanic ${targetMechanicId}. Request rerouted to queue (${fallback.overallStatus}).`,
          },
        });

        return {
          success: false,
          rerouted: true,
          eligibilityStatus: fallback.overallStatus,
          unavailabilityReason: fallback.unavailabilityReason,
        };
      }
    }
    throw err;
  }
}

/**
 * 10. Verified Email Dispatcher with 3 Distinct Templates
 */
export async function sendVerifiedServiceOutcomeEmail(params: {
  requestId: string;
  customerId: string;
  status: 'QUALIFIED_AND_FREE' | 'CURRENTLY_BUSY' | 'NO_QUALIFIED_MECHANIC';
  assignedMechanic?: { name: string; garageName: string; skills: string[] };
  unavailabilityReason?: string;
  estimatedWaitMinutes?: number;
}): Promise<void> {
  const { requestId, customerId, status, assignedMechanic, unavailabilityReason, estimatedWaitMinutes = 45 } = params;

  const request = await prisma.repairRequest.findUnique({
    where: { id: requestId },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      vehicle: true,
      garage: true,
    },
  });

  if (!request || !request.customer || !request.customer.email) return;

  const frontendUrl = env.FRONTEND_URL || 'http://localhost:3000';
  const trackingUrl = `${frontendUrl}/customer/requests/${request.id}`;
  const exploreUrl = `${frontendUrl}/customer/garages`;

  let subject = '';
  let templateType: EmailNotificationType = EmailNotificationType.GENERAL;
  let htmlBody = '';

  if (status === 'QUALIFIED_AND_FREE' && assignedMechanic) {
    subject = `Mechanic Available for Your ${request.vehicle.make} ${request.vehicle.model} – RepairHub`;
    templateType = EmailNotificationType.MECHANIC_ASSIGNED;
    htmlBody = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;background:#0B1729;color:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #1E293B;">
        <div style="background:linear-gradient(135deg,#F97316,#EA580C);padding:28px 24px;text-align:center;">
          <h1 style="margin:0;font-size:22px;font-weight:800;color:#FFF;">RepairHub</h1>
          <p style="margin:4px 0 0;color:#FED7AA;font-size:12px;font-weight:700;">VERIFIED SPECIALIST ASSIGNED</p>
        </div>
        <div style="padding:28px 24px;">
          <div style="display:inline-block;padding:4px 12px;background:rgba(16,185,129,0.2);border:1px solid rgba(16,185,129,0.4);border-radius:9999px;color:#34D399;font-size:12px;font-weight:bold;margin-bottom:16px;">
            &#10003; Verified Specialist Ready &amp; Free
          </div>
          <h2 style="font-size:18px;margin-top:0;color:#FFF;">Hello ${request.customer.name},</h2>
          <p style="color:#94A3B8;font-size:14px;line-height:1.6;">
            A certified and qualified technician has been allocated to your service request <strong>#${request.requestNumber}</strong> for your <strong>${request.vehicle.year} ${request.vehicle.make} ${request.vehicle.model}</strong> (${request.vehicle.regNo}).
          </p>
          <div style="background:#1E293B;border-radius:12px;padding:16px;margin:20px 0;border:1px solid #334155;">
            <p style="margin:0 0 6px;font-size:13px;color:#E2E8F0;">Assigned Technician: <strong style="color:#FFF;">${assignedMechanic.name}</strong></p>
            <p style="margin:0 0 6px;font-size:13px;color:#CBD5E1;">Workshop: <strong>${assignedMechanic.garageName}</strong></p>
            <p style="margin:0;font-size:12px;color:#38BDF8;">Verified Expertise: ${assignedMechanic.skills.join(', ')}</p>
          </div>
          <div style="text-align:center;margin:28px 0 12px;">
            <a href="${trackingUrl}" style="background:#F97316;color:#FFF;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">
              Track Repair &amp; Approve Estimate &rarr;
            </a>
          </div>
        </div>
      </div>
    `;
  } else if (status === 'CURRENTLY_BUSY') {
    subject = `Technicians Currently Busy: ${request.vehicle.make} ${request.vehicle.model} – Estimated Wait Time Inside`;
    templateType = EmailNotificationType.MECHANIC_CURRENTLY_BUSY;
    htmlBody = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;background:#0B1729;color:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #1E293B;">
        <div style="background:linear-gradient(135deg,#334155,#1E293B);padding:28px 24px;text-align:center;">
          <h1 style="margin:0;font-size:22px;font-weight:800;color:#FFF;">RepairHub</h1>
          <p style="margin:4px 0 0;color:#94A3B8;font-size:12px;font-weight:700;">CAPACITY NOTIFICATION</p>
        </div>
        <div style="padding:28px 24px;">
          <div style="display:inline-block;padding:4px 12px;background:rgba(245,158,11,0.2);border:1px solid rgba(245,158,11,0.4);border-radius:9999px;color:#FBBF24;font-size:12px;font-weight:bold;margin-bottom:16px;">
            &#9888; Qualified Specialists Currently Occupied
          </div>
          <h2 style="font-size:18px;margin-top:0;color:#FFF;">Hello ${request.customer.name},</h2>
          <p style="color:#94A3B8;font-size:14px;line-height:1.6;">
            Certified technicians specializing in your vehicle's repair are registered at our workshops, but all qualified technicians are currently occupied on active repair bays.
          </p>
          <div style="background:#1E293B;border-radius:12px;padding:16px;margin:20px 0;border:1px solid #334155;">
            <p style="margin:0 0 6px;font-size:13px;color:#FBBF24;font-weight:bold;">Estimated Wait Time: ~${estimatedWaitMinutes} minutes</p>
            <p style="margin:0;font-size:12px;color:#94A3B8;">
              Your ticket <strong>#${request.requestNumber}</strong> is queued in priority. You may wait for the next bay opening or request automatic rerouting to another approved workshop.
            </p>
          </div>
          <div style="text-align:center;margin:28px 0 12px;">
            <a href="${trackingUrl}" style="background:#334155;color:#FFF;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;border:1px solid #475569;">
              View Queue Status &amp; Options &rarr;
            </a>
          </div>
        </div>
      </div>
    `;
  } else {
    // NO_QUALIFIED_MECHANIC
    subject = `Service Update: No Qualified Specialist Currently Available for ${request.vehicle.make} ${request.vehicle.model}`;
    templateType = EmailNotificationType.NO_QUALIFIED_MECHANIC;
    htmlBody = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;background:#0B1729;color:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #1E293B;">
        <div style="background:linear-gradient(135deg,#7F1D1D,#991B1B);padding:28px 24px;text-align:center;">
          <h1 style="margin:0;font-size:22px;font-weight:800;color:#FFF;">RepairHub</h1>
          <p style="margin:4px 0 0;color:#FECACA;font-size:12px;font-weight:700;">SPECIALIST NOT FOUND</p>
        </div>
        <div style="padding:28px 24px;">
          <div style="display:inline-block;padding:4px 12px;background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.4);border-radius:9999px;color:#F87171;font-size:12px;font-weight:bold;margin-bottom:16px;">
            &#10006; No Qualified Mechanic Available
          </div>
          <h2 style="font-size:18px;margin-top:0;color:#FFF;">Hello ${request.customer.name},</h2>
          <p style="color:#94A3B8;font-size:14px;line-height:1.6;">
            We performed an intelligent network scan for your <strong>${request.vehicle.year} ${request.vehicle.make} ${request.vehicle.model}</strong> (${request.vehicle.regNo}).
          </p>
          <div style="background:#1E293B;border-radius:12px;padding:16px;margin:20px 0;border:1px solid #334155;">
            <p style="margin:0 0 6px;font-size:13px;color:#F87171;font-weight:bold;">Verification Result:</p>
            <p style="margin:0;font-size:12px;color:#CBD5E1;">
              ${unavailabilityReason || 'No registered technician currently possesses the required specialized certifications for this vehicle powertrain and reported issue.'}
            </p>
          </div>
          <div style="text-align:center;margin:28px 0 12px;">
            <a href="${exploreUrl}" style="background:#F97316;color:#FFF;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">
              Browse Alternative Authorized Garages &rarr;
            </a>
          </div>
        </div>
      </div>
    `;
  }

  // Record email in DB and dispatch
  try {
    const notification = await prisma.emailNotification.create({
      data: {
        recipient: request.customer.email,
        subject,
        template: status,
        status: EmailNotificationStatus.PENDING,
        type: templateType,
        requestId: request.id,
        vehicleId: request.vehicleId,
        metadata: {
          eligibilityStatus: status,
          unavailabilityReason,
          vehicleMake: request.vehicle.make,
          vehicleModel: request.vehicle.model,
          regNo: request.vehicle.regNo,
          estimatedWaitMinutes,
        },
      },
    });

    await emailService.sendGenericEmail({
      to: request.customer.email,
      subject,
      html: htmlBody,
    });

    await prisma.emailNotification.update({
      where: { id: notification.id },
      data: { status: EmailNotificationStatus.SENT, sentAt: new Date() },
    });
  } catch (err: any) {
    console.error(`[VERIFIED EMAIL] Failed to deliver ${status} email:`, err?.message);
  }
}
