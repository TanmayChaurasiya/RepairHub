import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { prisma } from '../../src/config/db.js';
import { Role, EmergencyCategory, EmergencyStatus } from '@prisma/client';

const app = createApp();

describe('RepairHub Emergency Assistance & Roadside Support Integration Tests', () => {
  let adminToken: string;
  let customerToken: string;
  let customerUser: any;
  let mechanic1Token: string;
  let mechanic1User: any;
  let mechanic2Token: string;
  let mechanic2User: any;
  let testGarage: any;
  let testVehicle: any;
  let createdEmergencyId: string;

  beforeAll(async () => {
    // 1. Admin token
    const adminUser = await prisma.user.findFirst({ where: { role: Role.ADMIN } });
    if (!adminUser) throw new Error('No admin user found');
    adminToken = jwt.sign(
      { userId: adminUser.id, email: adminUser.email, role: adminUser.role },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 2. Customer token
    customerUser = await prisma.user.findFirst({ where: { role: Role.CUSTOMER } });
    if (!customerUser) throw new Error('No customer user found');
    customerToken = jwt.sign(
      { userId: customerUser.id, email: customerUser.email, role: customerUser.role },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 3. Mechanics tokens
    const mechanics = await prisma.user.findMany({
      where: { role: Role.MECHANIC },
      include: { mechanicProfile: true },
      take: 2,
    });
    if (mechanics.length < 2) throw new Error('Need at least 2 mechanics for tests');

    mechanic1User = mechanics[0];
    mechanic1Token = jwt.sign(
      { userId: mechanic1User.id, email: mechanic1User.email, role: mechanic1User.role },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    mechanic2User = mechanics[1];
    mechanic2Token = jwt.sign(
      { userId: mechanic2User.id, email: mechanic2User.email, role: mechanic2User.role },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Ensure mechanics and garages have emergency coords & accepted status
    testGarage = await prisma.garage.findFirst({
      where: { isVerified: true },
    });

    if (testGarage) {
      await prisma.garage.update({
        where: { id: testGarage.id },
        data: {
          acceptsEmergency: true,
          latitude: 26.4735,
          longitude: 80.3075,
          emergencyRadiusKm: 25,
        },
      });
    }

    await prisma.mechanicProfile.updateMany({
      where: { userId: { in: [mechanic1User.id, mechanic2User.id] } },
      data: {
        acceptsEmergency: true,
        latitude: 26.475,
        longitude: 80.31,
        emergencyServiceRadiusKm: 25,
        available: true,
        availability: 'AVAILABLE',
      },
    });

    // Ensure customer has a test vehicle
    testVehicle = await prisma.vehicle.findFirst({
      where: { customerId: customerUser.id },
    });

    if (!testVehicle) {
      testVehicle = await prisma.vehicle.create({
        data: {
          customerId: customerUser.id,
          make: 'Tata',
          model: 'Nexon EV',
          year: 2024,
          regNo: `UP78-SOS-${Math.floor(1000 + Math.random() * 9000)}`,
          type: 'CAR',
        },
      });
    }
  });

  afterAll(async () => {
    // Clean up created emergency requests in test
    if (createdEmergencyId) {
      await prisma.emergencyStatusHistory.deleteMany({
        where: { emergencyRequestId: createdEmergencyId },
      });
      await prisma.emergencyAssignmentHistory.deleteMany({
        where: { emergencyRequestId: createdEmergencyId },
      });
      await prisma.emergencyRequest.delete({
        where: { id: createdEmergencyId },
      });
    }
  });

  // TEST 1: Discover nearby emergency providers
  it('1. GET /api/emergency/nearby - should discover providers within search radius', async () => {
    const res = await request(app)
      .get('/api/emergency/nearby')
      .query({
        lat: 26.4735,
        lon: 80.3075,
        category: 'FLAT_TYRE',
        radiusKm: 20,
        vehicleType: 'CAR',
      })
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('providers');
    expect(Array.isArray(res.body.providers)).toBe(true);
    expect(res.body.providers.length).toBeGreaterThan(0);
    expect(res.body.providers[0]).toHaveProperty('mechanicName');
    expect(res.body.providers[0]).toHaveProperty('distanceKm');
    expect(res.body.providers[0]).toHaveProperty('etaMinutes');
  });

  // TEST 2: Customer creates SOS Emergency Request
  it('2. POST /api/emergency/requests - should create SOS request and auto-assign nearest provider', async () => {
    const res = await request(app)
      .post('/api/emergency/requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        vehicleId: testVehicle.id,
        category: 'FLAT_TYRE',
        description: 'Puncture on highway bypass road near Mall Mile',
        pickupLatitude: 26.474,
        pickupLongitude: 80.308,
        pickupAddress: 'Near Mall Mile Bypass, Kanpur',
        searchRadiusKm: 20,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('emergency');
    expect(res.body.emergency).toHaveProperty('requestNumber');
    expect(res.body.emergency.requestNumber).toMatch(/^SOS-\d{4}-\d{4}$/);
    expect(res.body.emergency.category).toBe('FLAT_TYRE');
    expect(['PENDING_ACCEPTANCE', 'SEARCHING']).toContain(res.body.emergency.status);

    createdEmergencyId = res.body.emergency.id;
  });

  // TEST 3: Mechanic accepts emergency request
  it('3. POST /api/emergency/requests/:id/accept - mechanic accepts emergency request atomically', async () => {
    const res = await request(app)
      .post(`/api/emergency/requests/${createdEmergencyId}/accept`)
      .set('Authorization', `Bearer ${mechanic1Token}`)
      .send({ note: 'Accepting roadside job, leaving now.' });

    expect(res.status).toBe(200);
    expect(res.body.emergency.status).toBe('ACCEPTED');
    expect(res.body.emergency.assignedMechanicId).toBe(mechanic1User.id);
  });

  // TEST 4: Anti-Double Booking / Concurrency protection
  it('4. POST /api/emergency/requests/:id/accept - should reject second mechanic acceptance (prevent double booking)', async () => {
    const res = await request(app)
      .post(`/api/emergency/requests/${createdEmergencyId}/accept`)
      .set('Authorization', `Bearer ${mechanic2Token}`)
      .send({});

    // Should return 400 or 409 because already accepted
    expect([400, 409]).toContain(res.status);
  });

  // TEST 5: Mechanic live GPS location update
  it('5. PATCH /api/emergency/requests/:id/location - should update mechanic live location and recalculate ETA', async () => {
    const res = await request(app)
      .patch(`/api/emergency/requests/${createdEmergencyId}/location`)
      .set('Authorization', `Bearer ${mechanic1Token}`)
      .send({
        latitude: 26.4745,
        longitude: 80.3085,
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('location');
    expect(res.body.location).toHaveProperty('estimatedArrivalMinutes');
    expect(res.body.location).toHaveProperty('distanceKm');
  });

  // TEST 6: Workflow stage progression (EN_ROUTE -> ARRIVED -> IN_PROGRESS -> COMPLETED)
  it('6. PATCH /api/emergency/requests/:id/status - should advance through roadside lifecycle to COMPLETED', async () => {
    // EN_ROUTE
    const enRouteRes = await request(app)
      .patch(`/api/emergency/requests/${createdEmergencyId}/status`)
      .set('Authorization', `Bearer ${mechanic1Token}`)
      .send({ targetStatus: 'EN_ROUTE', note: 'Traveling to stranded vehicle' });
    expect(enRouteRes.status).toBe(200);
    expect(enRouteRes.body.emergency.status).toBe('EN_ROUTE');

    // ARRIVED
    const arrivedRes = await request(app)
      .patch(`/api/emergency/requests/${createdEmergencyId}/status`)
      .set('Authorization', `Bearer ${mechanic1Token}`)
      .send({ targetStatus: 'ARRIVED', note: 'Arrived at scene, hazard lights verified' });
    expect(arrivedRes.status).toBe(200);
    expect(arrivedRes.body.emergency.status).toBe('ARRIVED');

    // IN_PROGRESS
    const inProgressRes = await request(app)
      .patch(`/api/emergency/requests/${createdEmergencyId}/status`)
      .set('Authorization', `Bearer ${mechanic1Token}`)
      .send({ targetStatus: 'IN_PROGRESS', note: 'Changing wheel with spare tyre' });
    expect(inProgressRes.status).toBe(200);
    expect(inProgressRes.body.emergency.status).toBe('IN_PROGRESS');

    // COMPLETED
    const completedRes = await request(app)
      .patch(`/api/emergency/requests/${createdEmergencyId}/status`)
      .set('Authorization', `Bearer ${mechanic1Token}`)
      .send({ targetStatus: 'COMPLETED', note: 'Wheel replaced, torque checked, driver resumed journey' });
    expect(completedRes.status).toBe(200);
    expect(completedRes.body.emergency.status).toBe('COMPLETED');
  });

  // TEST 7: Customer roadside cancellation workflow
  it('7. POST /api/emergency/requests - should allow customer cancellation with audit reason', async () => {
    // Create new emergency request to test cancellation
    const newReqRes = await request(app)
      .post('/api/emergency/requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        vehicleId: testVehicle.id,
        category: 'BATTERY_FAILURE',
        description: 'Dead battery in parking lot',
        pickupLatitude: 26.474,
        pickupLongitude: 80.308,
        pickupAddress: 'Civil Lines Parking, Kanpur',
      });

    expect(newReqRes.status).toBe(201);
    const cancelId = newReqRes.body.emergency.id;

    // Customer cancels
    const cancelRes = await request(app)
      .post(`/api/emergency/requests/${cancelId}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ reason: 'Car was successfully jumpstarted by a colleague' });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.emergency.status).toBe('CANCELLED');

    // Cleanup
    await prisma.emergencyStatusHistory.deleteMany({ where: { emergencyRequestId: cancelId } });
    await prisma.emergencyAssignmentHistory.deleteMany({ where: { emergencyRequestId: cancelId } });
    await prisma.emergencyRequest.delete({ where: { id: cancelId } });
  });

  // TEST 8: Admin manual reassignment with audit history
  it('8. POST /api/emergency/requests/:id/reassign - should allow Master Admin to override assignment', async () => {
    // Create request for reassignment test
    const newReqRes = await request(app)
      .post('/api/emergency/requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        vehicleId: testVehicle.id,
        category: 'ENGINE_OVERHEATING',
        description: 'Steam from coolant tank',
        pickupLatitude: 26.474,
        pickupLongitude: 80.308,
        pickupAddress: 'GT Road Kanpur',
      });

    expect(newReqRes.status).toBe(201);
    const reassignId = newReqRes.body.emergency.id;

    // Admin reassigns to Mechanic 2 (Sanjay)
    const reassignRes = await request(app)
      .post(`/api/emergency/requests/${reassignId}/reassign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        newMechanicId: mechanic2User.id,
        reason: 'Administrative override: Mechanic 2 has dedicated coolant diagnostic gear',
      });

    expect(reassignRes.status).toBe(200);
    expect(reassignRes.body.emergency.assignedMechanicId).toBe(mechanic2User.id);

    // Verify audit record exists in database
    const auditRecord = await prisma.emergencyAssignmentHistory.findFirst({
      where: { emergencyRequestId: reassignId, action: 'REASSIGNED' },
    });
    expect(auditRecord).not.toBeNull();
    expect(auditRecord?.reason).toContain('dedicated coolant diagnostic gear');

    // Cleanup
    await prisma.emergencyStatusHistory.deleteMany({ where: { emergencyRequestId: reassignId } });
    await prisma.emergencyAssignmentHistory.deleteMany({ where: { emergencyRequestId: reassignId } });
    await prisma.emergencyRequest.delete({ where: { id: reassignId } });
  });
});
