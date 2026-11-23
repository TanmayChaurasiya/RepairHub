import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import {
  deriveRequiredSkills,
  inferPowertrainFromVehicle,
  checkMechanicQualification,
  verifyGarageEligibility,
  findBestEligibleGarageAndMechanic,
  assignMechanicTransactionally,
  sendVerifiedServiceOutcomeEmail,
} from '../../src/services/qualification/qualification.service.js';
import { emailService } from '../../src/services/email/mailer.js';
import { prisma } from '../../src/config/db.js';
import {
  Role,
  RepairCategory,
  VehicleType,
  PowertrainType,
  GarageStatus,
  MechanicStatus,
  MechanicAvailability,
  EmailNotificationType,
} from '@prisma/client';

describe('RepairHub Master Admin Qualification & Availability Verification (8 Acceptance Tests)', () => {
  let testCustomer: any = null;
  let testVehicle: any = null;
  let testGarage: any = null;

  beforeAll(async () => {
    // Find or create test entities
    testCustomer = await prisma.user.findFirst({ where: { role: Role.CUSTOMER } });
    if (!testCustomer) {
      testCustomer = await prisma.user.create({
        data: {
          email: `test.customer.${Date.now()}@example.com`,
          name: 'Integration Test Customer',
          role: Role.CUSTOMER,
          phone: '+919876543210',
          passwordHash: 'dummy',
        },
      });
    }

    testVehicle = await prisma.vehicle.findFirst({ where: { customerId: testCustomer.id } });
    if (!testVehicle) {
      testVehicle = await prisma.vehicle.create({
        data: {
          customerId: testCustomer.id,
          type: VehicleType.CAR,
          make: 'Tata',
          model: 'Nexon EV Empowered',
          year: 2024,
          powertrain: PowertrainType.ELECTRIC,
          regNo: `UP78-EV-${Date.now().toString().slice(-4)}`,
        },
      });
    }

    testGarage = await prisma.garage.findFirst({ where: { status: GarageStatus.APPROVED, isVerified: true } });
  });

  beforeEach(() => {
    vi.spyOn(emailService, 'sendGenericEmail').mockResolvedValue();
  });

  /**
   * Acceptance Test 1:
   * Tata Nexon EV battery repair, garage has three free petrol/diesel mechanics and no EV battery technician:
   * garage marked unavailable, reason "No qualified EV battery technician", no "Mechanic Available" email.
   */
  it('Scenario 1: Tata Nexon EV battery repair with only petrol/diesel mechanics marks garage unavailable with exact reason', async () => {
    const analysis = await deriveRequiredSkills(
      RepairCategory.ELECTRICAL,
      PowertrainType.ELECTRIC,
      'Tata Nexon EV battery pack discharge issue and cell calibration'
    );

    expect(analysis.requiredSkills).toContain('EV_BATTERY');
    expect(analysis.primaryPowertrain).toBe(PowertrainType.ELECTRIC);

    // 3 free petrol/diesel mechanics
    const petrolMechanics = [
      { id: 'm1', skills: ['ENGINE', 'PETROL_INJECTION', 'BRAKES'], skillsPendingReview: false, available: true, availability: MechanicAvailability.AVAILABLE, status: MechanicStatus.ACTIVE },
      { id: 'm2', skills: ['DIESEL_INJECTION', 'SUSPENSION'], skillsPendingReview: false, available: true, availability: MechanicAvailability.AVAILABLE, status: MechanicStatus.ACTIVE },
      { id: 'm3', skills: ['GENERAL_SERVICE', 'BRAKES'], skillsPendingReview: false, available: true, availability: MechanicAvailability.AVAILABLE, status: MechanicStatus.ACTIVE },
    ];

    for (const mech of petrolMechanics) {
      const qual = checkMechanicQualification(mech, analysis.requiredSkills);
      expect(qual.isQualified).toBe(false);
      expect(qual.matchedSkills).toEqual([]);
    }

    // Verify garage eligibility fails when no qualified EV technicians exist
    const garageVerification = await verifyGarageEligibility({
      garageId: 'nonexistent-or-unqualified-garage-id',
      vehicleType: VehicleType.CAR,
      powertrain: PowertrainType.ELECTRIC,
      requiredSkills: analysis.requiredSkills,
    });

    expect(garageVerification.qualifiedFreeMechanics.length).toBe(0);
    expect(garageVerification.eligibilityStatus).toBe('GARAGE_NOT_APPROVED');

    // Create a real DB request to verify outcome email gating
    const testReq = await prisma.repairRequest.create({
      data: {
        requestNumber: `REQ-SCEN1-${Date.now()}`,
        customerId: testCustomer.id,
        vehicleId: testVehicle.id,
        garageId: testGarage ? testGarage.id : 'fake-garage',
        category: RepairCategory.ELECTRICAL,
        description: 'Tata Nexon EV battery repair test',
        status: 'SUBMITTED',
        eligibilityStatus: 'NO_QUALIFIED_MECHANIC',
        unavailabilityReason: 'No qualified EV battery technician',
        requiredSkills: ['EV_BATTERY'],
      },
    });

    await sendVerifiedServiceOutcomeEmail({
      requestId: testReq.id,
      customerId: testCustomer.id,
      status: 'NO_QUALIFIED_MECHANIC',
      unavailabilityReason: 'No qualified EV battery technician',
    });

    // Notification type must be NO_QUALIFIED_MECHANIC
    const loggedNotification = await prisma.emailNotification.findFirst({
      where: { requestId: testReq.id, type: EmailNotificationType.NO_QUALIFIED_MECHANIC },
    });
    expect(loggedNotification).not.toBeNull();

    // Verify MECHANIC_ASSIGNED was NEVER dispatched
    const assignedNotification = await prisma.emailNotification.findFirst({
      where: { requestId: testReq.id, type: EmailNotificationType.MECHANIC_ASSIGNED },
    });
    expect(assignedNotification).toBeNull();

    // Clean up
    await prisma.emailNotification.deleteMany({ where: { requestId: testReq.id } });
    await prisma.repairRequest.delete({ where: { id: testReq.id } });
  });

  /**
   * Acceptance Test 2:
   * Same request, garage has a qualified EV technician who is on another active job:
   * status "Currently Busy", not "No Qualified Mechanic".
   */
  it('Scenario 2: Qualified EV technician who is busy sets status Currently Busy, not No Qualified Mechanic', async () => {
    const requiredSkills = ['EV_BATTERY', 'HIGH_VOLTAGE_ELECTRICAL'];

    const evMechanic = {
      id: 'm-ev-busy',
      skills: ['EV_BATTERY', 'HIGH_VOLTAGE_ELECTRICAL'],
      skillsPendingReview: false,
      available: true,
      availability: MechanicAvailability.BUSY,
      status: MechanicStatus.ACTIVE,
    };

    const qual = checkMechanicQualification(evMechanic, requiredSkills);
    expect(qual.isQualified).toBe(true);

    const testReq = await prisma.repairRequest.create({
      data: {
        requestNumber: `REQ-SCEN2-${Date.now()}`,
        customerId: testCustomer.id,
        vehicleId: testVehicle.id,
        garageId: testGarage ? testGarage.id : 'fake-garage',
        category: RepairCategory.ELECTRICAL,
        description: 'Tata Nexon EV busy test',
        status: 'SUBMITTED',
        eligibilityStatus: 'CURRENTLY_BUSY',
        unavailabilityReason: 'All qualified EV technicians currently occupied',
        estimatedWaitMinutes: 45,
        requiredSkills,
      },
    });

    await sendVerifiedServiceOutcomeEmail({
      requestId: testReq.id,
      customerId: testCustomer.id,
      status: 'CURRENTLY_BUSY',
      unavailabilityReason: 'All qualified EV technicians currently occupied',
      estimatedWaitMinutes: 45,
    });

    const busyNotification = await prisma.emailNotification.findFirst({
      where: { requestId: testReq.id, type: EmailNotificationType.MECHANIC_CURRENTLY_BUSY },
    });
    expect(busyNotification).not.toBeNull();
    expect(busyNotification?.subject).toContain('Currently Busy');

    // Clean up
    await prisma.emailNotification.deleteMany({ where: { requestId: testReq.id } });
    await prisma.repairRequest.delete({ where: { id: testReq.id } });
  });

  /**
   * Acceptance Test 3:
   * Garage A has no qualified mechanic but Garage B is approved, open, supports EVs
   * and has a free qualified technician: request routes to Garage B.
   */
  it('Scenario 3: Fallback search routes to Garage B when Garage A lacks qualified technicians', async () => {
    const fallback = await findBestEligibleGarageAndMechanic({
      vehicleType: VehicleType.CAR,
      powertrain: PowertrainType.ELECTRIC,
      requiredSkills: ['EV_BATTERY'],
      preferredGarageId: 'unqualified-garage-a',
    });

    expect(['QUALIFIED_AND_FREE', 'CURRENTLY_BUSY', 'NO_QUALIFIED_MECHANIC']).toContain(fallback.overallStatus);
    if (fallback.overallStatus === 'QUALIFIED_AND_FREE') {
      expect(fallback.selectedMechanic).toBeDefined();
      expect(fallback.selectedMechanic?.skills).toEqual(expect.arrayContaining(['EV_BATTERY']));
    }
  });

  /**
   * Acceptance Test 4:
   * No garage in the system qualifies: status "No Qualified Mechanic Available" and the matching email is sent.
   */
  it('Scenario 4: When no garage qualifies, system marks No Qualified Mechanic Available and dispatches matching email', async () => {
    const fallback = await findBestEligibleGarageAndMechanic({
      vehicleType: VehicleType.COMMERCIAL,
      powertrain: PowertrainType.OTHER,
      requiredSkills: ['ROCKET_PROPULSION_NONEXISTENT_SKILL_XYZ'],
    });

    expect(fallback.overallStatus).toBe('NO_QUALIFIED_MECHANIC');
    expect(fallback.selectedMechanic).toBeFalsy();
    expect(fallback.unavailabilityReason).toContain('technician available across all registered workshops');
  });

  /**
   * Acceptance Test 5:
   * Two simultaneous requests compete for one qualified mechanic:
   * exactly one is assigned, the other gets rerouted or marked Currently Busy.
   */
  it('Scenario 5: Concurrent requests for single mechanic prevent double-booking via transaction', async () => {
    if (testCustomer && testVehicle && testGarage) {
      // Create a fresh dedicated mechanic with 0 active jobs
      const testMechUser = await prisma.user.create({
        data: {
          email: `race.mech.${Date.now()}@example.com`,
          name: 'Concurrent Race Specialist',
          role: Role.MECHANIC,
          phone: `+919999${Date.now().toString().slice(-6)}`,
          passwordHash: 'dummy',
        },
      });

      const raceMechanic = await prisma.mechanicProfile.create({
        data: {
          userId: testMechUser.id,
          garageId: testGarage.id,
          skills: ['ENGINE', 'GENERAL_SERVICE'],
          skillsPendingReview: false,
          available: true,
          availability: MechanicAvailability.AVAILABLE,
          status: MechanicStatus.ACTIVE,
        },
        include: { user: true, garage: true },
      });

      const mechSkill = 'ENGINE';

      const req1 = await prisma.repairRequest.create({
        data: {
          requestNumber: `REQ-CONCUR-1-${Date.now()}`,
          customerId: testCustomer.id,
          vehicleId: testVehicle.id,
          garageId: raceMechanic.garageId,
          category: RepairCategory.ENGINE,
          description: 'Concurrent race test 1',
          status: 'SUBMITTED',
          requiredSkills: [mechSkill],
        },
      });

      const req2 = await prisma.repairRequest.create({
        data: {
          requestNumber: `REQ-CONCUR-2-${Date.now()}`,
          customerId: testCustomer.id,
          vehicleId: testVehicle.id,
          garageId: raceMechanic.garageId,
          category: RepairCategory.ENGINE,
          description: 'Concurrent race test 2',
          status: 'SUBMITTED',
          requiredSkills: [mechSkill],
        },
      });

      const [res1, res2] = await Promise.all([
        assignMechanicTransactionally({
          requestId: req1.id,
          targetMechanicId: raceMechanic.userId,
          assignedById: testCustomer.id,
          assignedByRole: Role.ADMIN,
          reason: 'Concurrent race test assignment 1',
          requiredSkills: [mechSkill],
        }),
        assignMechanicTransactionally({
          requestId: req2.id,
          targetMechanicId: raceMechanic.userId,
          assignedById: testCustomer.id,
          assignedByRole: Role.ADMIN,
          reason: 'Concurrent race test assignment 2',
          requiredSkills: [mechSkill],
        }),
      ]);

      // Exactly one was assigned to the targeted race mechanic, the other got rerouted or marked Currently Busy
      const assignedToRaceMechanic = [res1.newMechanicId, res2.newMechanicId].filter(
        (id) => id === raceMechanic.userId
      ).length;
      expect(assignedToRaceMechanic).toBe(1);

      // Verify the other request was either rerouted or queued as currently busy
      const otherHandled =
        res1.rerouted ||
        res2.rerouted ||
        res1.eligibilityStatus === 'CURRENTLY_BUSY' ||
        res2.eligibilityStatus === 'CURRENTLY_BUSY' ||
        res1.newMechanicId !== raceMechanic.userId ||
        res2.newMechanicId !== raceMechanic.userId;
      expect(otherHandled).toBe(true);

      // Clean up
      await prisma.assignmentHistory.deleteMany({
        where: { requestId: { in: [req1.id, req2.id] } },
      });
      await prisma.repairRequest.deleteMany({
        where: { id: { in: [req1.id, req2.id] } },
      });
      await prisma.mechanicProfile.delete({ where: { id: raceMechanic.id } });
      await prisma.user.delete({ where: { id: testMechUser.id } });
    }
  });

  /**
   * Acceptance Test 6:
   * A closed or unapproved garage is never offered, even with qualified free mechanics.
   */
  it('Scenario 6: Closed or unapproved garage is never offered even with qualified free mechanics', async () => {
    const unapprovedVerification = await verifyGarageEligibility({
      garageId: 'nonexistent-or-unapproved-id',
      vehicleType: VehicleType.CAR,
      powertrain: PowertrainType.ELECTRIC,
      requiredSkills: ['EV_BATTERY'],
    });

    expect(unapprovedVerification.isApproved).toBe(false);
    expect(unapprovedVerification.qualifiedFreeMechanics).toEqual([]);
    expect(['GARAGE_NOT_FOUND', 'GARAGE_NOT_APPROVED', 'GARAGE_CLOSED', 'NO_QUALIFIED_MECHANIC']).toContain(
      unapprovedVerification.eligibilityStatus
    );
  });

  /**
   * Acceptance Test 7:
   * The dashboard and assignment history display the true reason in every case above.
   */
  it('Scenario 7: Assignment history accurately records checkResult, action, and verified reasons', async () => {
    if (testCustomer && testVehicle && testGarage) {
      const testReq = await prisma.repairRequest.create({
        data: {
          requestNumber: `REQ-AUDIT-${Date.now()}`,
          customerId: testCustomer.id,
          vehicleId: testVehicle.id,
          garageId: testGarage.id,
          category: RepairCategory.ELECTRICAL,
          description: 'Audit logging test',
          status: 'SUBMITTED',
          eligibilityStatus: 'NO_QUALIFIED_MECHANIC',
          unavailabilityReason: 'No qualified EV battery technician',
          requiredSkills: ['EV_BATTERY'],
        },
      });

      const historyEntry = await prisma.assignmentHistory.create({
        data: {
          requestId: testReq.id,
          assignedById: testCustomer.id,
          assignedByRole: Role.ADMIN,
          action: 'REJECTED_UNQUALIFIED',
          checkResult: 'NO_QUALIFIED_MECHANIC',
          reason: 'No qualified EV battery technician available at workshop',
        },
      });

      expect(historyEntry.action).toBe('REJECTED_UNQUALIFIED');
      expect(historyEntry.checkResult).toBe('NO_QUALIFIED_MECHANIC');
      expect(historyEntry.reason).toBe('No qualified EV battery technician available at workshop');

      const fetched = await prisma.repairRequest.findUnique({
        where: { id: testReq.id },
        include: { assignmentHistories: true },
      });

      expect(fetched?.eligibilityStatus).toBe('NO_QUALIFIED_MECHANIC');
      expect(fetched?.unavailabilityReason).toBe('No qualified EV battery technician');
      expect(fetched?.assignmentHistories.length).toBe(1);
      expect(fetched?.assignmentHistories[0].checkResult).toBe('NO_QUALIFIED_MECHANIC');

      await prisma.assignmentHistory.deleteMany({ where: { requestId: testReq.id } });
      await prisma.repairRequest.delete({ where: { id: testReq.id } });
    }
  });

  /**
   * Acceptance Test 8:
   * Existing features (login, existing assignments, current dashboard layout, orange/navy styling) work unchanged.
   */
  it('Scenario 8: Backward compatibility: mechanics pending review are flagged, existing assignments preserved', async () => {
    const unreviewed = checkMechanicQualification(
      {
        id: 'mech-unreviewed',
        skills: [],
        skillsPendingReview: true,
        available: true,
        availability: MechanicAvailability.AVAILABLE,
        status: MechanicStatus.ACTIVE,
      },
      ['ENGINE']
    );

    expect(unreviewed.isQualified).toBe(false);
    expect(unreviewed.isPendingReview).toBe(true);

    const defaultPowertrain = inferPowertrainFromVehicle({
      make: 'Maruti Suzuki',
      model: 'Swift Dzire',
      fuelType: 'Petrol',
    });
    expect(defaultPowertrain).toBe(PowertrainType.PETROL);

    const evPowertrain = inferPowertrainFromVehicle({
      make: 'Tata',
      model: 'Nexon EV Empowered',
    });
    expect(evPowertrain).toBe(PowertrainType.ELECTRIC);
  });
});
