import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { prisma } from '../../src/config/db.js';
import { Role, RequestStatus, MechanicAvailability, EmailNotificationStatus } from '@prisma/client';

const app = createApp();

describe('RepairHub Admin Intelligence, Reassignment & Automation Integration Tests', () => {
  const masterAdminEmail = env.MASTER_ADMIN_EMAIL.toLowerCase().trim();
  const masterAdminPass = env.MASTER_ADMIN_INITIAL_PASSWORD || 'MasterAdmin@2026!';

  let adminToken: string;
  let customerToken: string;
  let customerUser: any;
  let mechanic1Token: string;
  let mechanic1User: any;
  let mechanic2Token: string;
  let mechanic2User: any;
  let testGarage: any;
  let testVehicle: any;
  let testRequest: any;

  beforeAll(async () => {
    // 1. Admin login
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: masterAdminEmail,
        password: masterAdminPass,
        expectedRole: 'ADMIN',
      });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.accessToken;

    // 2. Customer login
    const custRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'arun.customer@gmail.com',
        password: 'Password123!',
        expectedRole: 'CUSTOMER',
      });
    expect(custRes.status).toBe(200);
    customerToken = custRes.body.accessToken;
    customerUser = custRes.body.user;

    // 3. Mechanic 1 login (Vikram)
    const m1Res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'vikram.mechanic@repairhub.in',
        password: 'Password123!',
        expectedRole: 'MECHANIC',
      });
    expect(m1Res.status).toBe(200);
    mechanic1Token = m1Res.body.accessToken;
    mechanic1User = m1Res.body.user;

    // 4. Ensure Mechanic 2 exists for reassignment
    let m2 = await prisma.user.findFirst({
      where: {
        role: Role.MECHANIC,
        id: { not: mechanic1User.id },
      },
      include: { mechanicProfile: true },
    });

    if (!m2) {
      testGarage = await prisma.garage.findFirst({ where: { isVerified: true } });
      const createdM2 = await prisma.user.create({
        data: {
          email: 'rajesh.mechanic@test.repairhub.in',
          name: 'Rajesh Kumar',
          phone: '+919876543299',
          passwordHash: mechanic1User.passwordHash || 'hashed',
          role: Role.MECHANIC,
          mechanicProfile: {
            create: {
              garageId: testGarage.id,
              skills: ['FOUR_WHEELER', 'TWO_WHEELER', 'HEAVY'],
              available: true,
              availability: MechanicAvailability.AVAILABLE,
              rating: 4.8,
              totalReviews: 12,
            },
          },
        },
        include: { mechanicProfile: true },
      });
      m2 = createdM2;
    }
    mechanic2User = m2;

    testGarage = await prisma.garage.findFirst({ where: { isVerified: true } });

    // Ensure both mechanics are active & available with matching skills
    await prisma.mechanicProfile.update({
      where: { userId: mechanic1User.id },
      data: {
        available: true,
        availability: MechanicAvailability.AVAILABLE,
        status: 'ACTIVE',
        skills: ['SUSPENSION', 'ENGINE', 'BRAKES'],
        garageId: testGarage.id,
      },
    });

    await prisma.mechanicProfile.update({
      where: { userId: mechanic2User.id },
      data: {
        available: true,
        availability: MechanicAvailability.AVAILABLE,
        status: 'ACTIVE',
        skills: ['SUSPENSION', 'ENGINE', 'BRAKES'],
        garageId: testGarage.id,
      },
    });
  }, 30000);

  // --------------------------------------------------------------------------
  // 1. Mechanic Real-Time Availability Management
  // --------------------------------------------------------------------------
  describe('1. Mechanic Real-time Availability Management', () => {
    it('allows a mechanic to toggle status to ON_BREAK with a break reason', async () => {
      const res = await request(app)
        .patch('/api/mechanics/availability')
        .set('Authorization', `Bearer ${mechanic1Token}`)
        .send({
          availability: 'ON_BREAK',
          breakReason: 'Lunch Break',
        });

      expect(res.status).toBe(200);
      expect(res.body.profile.availability).toBe('ON_BREAK');
      expect(res.body.profile.available).toBe(false);
      expect(res.body.profile.breakReason).toBe('Lunch Break');

      // Verify DB persistence
      const profile = await prisma.mechanicProfile.findUnique({
        where: { userId: mechanic1User.id },
      });
      expect(profile?.availability).toBe('ON_BREAK');
      expect(profile?.available).toBe(false);
      expect(profile?.breakReason).toBe('Lunch Break');
    });

    it('allows a mechanic to toggle status back to AVAILABLE', async () => {
      const res = await request(app)
        .patch('/api/mechanics/availability')
        .set('Authorization', `Bearer ${mechanic1Token}`)
        .send({
          availability: 'AVAILABLE',
        });

      expect(res.status).toBe(200);
      expect(res.body.profile.availability).toBe('AVAILABLE');
      expect(res.body.profile.available).toBe(true);
      expect(res.body.profile.breakReason).toBeNull();
    });

    it('rejects unauthorized requests to update mechanic availability', async () => {
      const res = await request(app)
        .patch('/api/mechanics/availability')
        .send({ availability: 'AVAILABLE' });

      expect(res.status).toBe(401);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Automated Vehicle Registration & Availability Notification
  // --------------------------------------------------------------------------
  describe('2. Automated Vehicle Registration & Availability Notification', () => {
    it('creates a vehicle and logs an automated email notification asynchronously', async () => {
      const uniqueReg = `UP78-AUTO-${Date.now().toString().slice(-4)}`;
      const res = await request(app)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          make: 'Tata',
          model: 'Harrier Dark Edition',
          year: 2024,
          regNo: uniqueReg,
          type: 'CAR',
        });

      expect(res.status).toBe(201);
      testVehicle = res.body.vehicle;
      expect(testVehicle.regNo).toBe(uniqueReg);

      // Give non-blocking async process a moment to evaluate and log
      await new Promise((r) => setTimeout(r, 1200));

      // Verify EmailNotification was persisted in DB
      const notification = await prisma.emailNotification.findFirst({
        where: { vehicleId: testVehicle.id },
      });

      expect(notification).not.toBeNull();
      expect(notification?.recipient).toBe(customerUser.email.toLowerCase());
      expect(['VEHICLE_AVAILABILITY_AVAILABLE', 'VEHICLE_AVAILABILITY_UNAVAILABLE']).toContain(
        notification?.type
      );
    });

    it('prevents duplicate notification emails for the same vehicle', async () => {
      const { checkAndSendVehicleAvailabilityEmail } = await import(
        '../../src/services/email/vehicleAvailabilityEmail.service.js'
      );

      const countBefore = await prisma.emailNotification.count({
        where: { vehicleId: testVehicle.id },
      });

      await checkAndSendVehicleAvailabilityEmail(testVehicle.id, customerUser.id);

      const countAfter = await prisma.emailNotification.count({
        where: { vehicleId: testVehicle.id },
      });

      expect(countAfter).toBe(countBefore);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Admin Customer Vehicles & Email Notification Dashboards
  // --------------------------------------------------------------------------
  describe('3. Admin Customer Vehicles & Notification Dashboards', () => {
    it('Admin can list customer vehicles with pagination and search', async () => {
      const res = await request(app)
        .get('/api/admin/vehicles')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ search: 'Tata', page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.vehicles).toBeDefined();
      expect(Array.isArray(res.body.vehicles)).toBe(true);
      expect(res.body.vehicles.length).toBeGreaterThan(0);
      expect(res.body.pagination).toBeDefined();
    });

    it('Admin can view full vehicle detail view', async () => {
      const res = await request(app)
        .get(`/api/admin/vehicles/${testVehicle.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.vehicle.id).toBe(testVehicle.id);
      expect(res.body.vehicle.customer).toBeDefined();
      expect(res.body.vehicle.requests).toBeDefined();
    });

    it('Admin can list logged email notifications', async () => {
      const res = await request(app)
        .get('/api/admin/email-notifications')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.notifications).toBeDefined();
      expect(Array.isArray(res.body.notifications)).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Admin Mechanic Reassignment System
  // --------------------------------------------------------------------------
  describe('4. Mechanic Reassignment System (Admin-Only)', () => {
    beforeAll(async () => {
      const reqRes = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          vehicleId: testVehicle.id,
          garageId: testGarage.id,
          category: 'SUSPENSION',
          description: 'Suspension clunking noise on rough roads test',
        });

      expect(reqRes.status).toBe(201);
      testRequest = reqRes.body.request;

      const assignRes = await request(app)
        .post(`/api/requests/${testRequest.id}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          mechanicId: mechanic1User.id,
          note: 'Initial assignment to Senior Technician',
        });

      expect(assignRes.status).toBe(200);
      expect(assignRes.body.request.status).toBe('ASSIGNED');
      expect(assignRes.body.request.mechanicId).toBe(mechanic1User.id);
      testRequest = assignRes.body.request;
    });

    it('Admin can retrieve eligible replacement mechanics for reassignment', async () => {
      const res = await request(app)
        .get(`/api/admin/requests/${testRequest.id}/eligible-mechanics`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.reassignmentAllowed).toBe(true);
      expect(res.body.currentMechanic.id).toBe(mechanic1User.id);
      expect(Array.isArray(res.body.eligibleMechanics)).toBe(true);
      const candidateIds = res.body.eligibleMechanics.map((m: any) => m.mechanicId);
      expect(candidateIds).toContain(mechanic2User.id);
    });

    it('Non-admin users cannot execute mechanic reassignment', async () => {
      const res = await request(app)
        .post(`/api/admin/requests/${testRequest.id}/reassign`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          newMechanicId: mechanic2User.id,
          reason: 'Customer trying to reassign mechanic unauthorized',
        });

      expect([401, 403]).toContain(res.status);
    });

    it('Reassignment is rejected if reason is under 5 characters', async () => {
      const res = await request(app)
        .post(`/api/admin/requests/${testRequest.id}/reassign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          newMechanicId: mechanic2User.id,
          reason: 'Sick', // < 5 chars
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/at least 5 characters/i);
    });

    it('Admin successfully reassigns mechanic with valid reason', async () => {
      const res = await request(app)
        .post(`/api/admin/requests/${testRequest.id}/reassign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          newMechanicId: mechanic2User.id,
          reason: 'Mechanic 1 called in for urgent emergency bay repairs',
          expectedUpdatedAt: testRequest.updatedAt,
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/successfully reassigned/i);
      expect(res.body.request.mechanicId).toBe(mechanic2User.id);
      expect(res.body.request.status).toBe(RequestStatus.ASSIGNED);

      // Verify AssignmentHistory record
      const historyRecord = await prisma.assignmentHistory.findFirst({
        where: {
          requestId: testRequest.id,
          newMechanicId: mechanic2User.id,
        },
      });

      expect(historyRecord).not.toBeNull();
      expect(historyRecord?.previousMechanicId).toBe(mechanic1User.id);
      expect(historyRecord?.reason).toMatch(/emergency bay repairs/i);

      testRequest = res.body.request;
    });

    it('Admin can retrieve complete assignment history timeline for the request', async () => {
      const res = await request(app)
        .get(`/api/admin/requests/${testRequest.id}/assignment-history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.histories)).toBe(true);
      expect(res.body.histories.length).toBeGreaterThanOrEqual(1);

      const latest = res.body.histories[0];
      expect(latest.newMechanic.id).toBe(mechanic2User.id);
      expect(latest.previousMechanic.id).toBe(mechanic1User.id);
      expect(latest.assignedBy).toBeDefined();
    });

    it('STRICT GUARD: Once inspection starts (INSPECTING), reassignment is strictly blocked', async () => {
      await prisma.repairRequest.update({
        where: { id: testRequest.id },
        data: { status: RequestStatus.INSPECTING },
      });

      const checkRes = await request(app)
        .get(`/api/admin/requests/${testRequest.id}/eligible-mechanics`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(checkRes.status).toBe(200);
      expect(checkRes.body.reassignmentAllowed).toBe(false);
      expect(checkRes.body.disallowReason).toMatch(/inspection has commenced/i);

      const reassignRes = await request(app)
        .post(`/api/admin/requests/${testRequest.id}/reassign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          newMechanicId: mechanic1User.id,
          reason: 'Trying to bypass inspection guard illegally',
        });

      expect([400, 409]).toContain(reassignRes.status);
      expect(reassignRes.body.error).toMatch(/inspection/i);
    });
  });

  afterAll(async () => {
    try {
      if (testRequest?.id) {
        await prisma.assignmentHistory.deleteMany({ where: { requestId: testRequest.id } });
        await prisma.statusHistory.deleteMany({ where: { requestId: testRequest.id } });
        await prisma.repairRequest.deleteMany({ where: { id: testRequest.id } });
      }
      if (testVehicle?.id) {
        await prisma.emailNotification.deleteMany({ where: { vehicleId: testVehicle.id } });
        await prisma.vehicle.deleteMany({ where: { id: testVehicle.id } });
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  });
});
