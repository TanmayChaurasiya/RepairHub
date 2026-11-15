import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/config/db.js';
import { Role, GarageStatus, MechanicStatus } from '@prisma/client';

import { env } from '../../src/config/env.js';

const app = createApp();

describe('Multi-Garage Management System Integration Tests', () => {
  const timestamp = Date.now();
  const testAdminEmail = env.MASTER_ADMIN_EMAIL;
  const testAdminPassword = env.MASTER_ADMIN_INITIAL_PASSWORD || 'MasterAdmin@2026!';
  const testGarageOwnerEmail = `owner.test.${timestamp}@sharmaauto.com`;
  const testMechanicEmail = `mech.test.${timestamp}@sharmaauto.com`;

  let adminAccessToken: string;
  let garageOwnerAccessToken: string;
  let registeredGarageId: string;
  let mechanicInvitationToken: string;
  let mechanicUserId: string;

  beforeAll(async () => {
    // 1. Log in as verified Master Admin
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testAdminEmail, password: testAdminPassword, expectedRole: 'ADMIN' });

    expect(adminLoginRes.status).toBe(200);
    expect(adminLoginRes.body.user.role).toBe(Role.ADMIN);
    adminAccessToken = adminLoginRes.body.accessToken;
  });

  afterAll(async () => {
    // Cleanup created test records
    await prisma.mechanicInvitation.deleteMany({
      where: { email: { in: [testMechanicEmail] } },
    });
    if (registeredGarageId) {
      await prisma.repairRequest.deleteMany({ where: { garageId: registeredGarageId } });
      await prisma.mechanicProfile.deleteMany({ where: { garageId: registeredGarageId } });
      await prisma.garage.deleteMany({ where: { id: registeredGarageId } });
    }
    await prisma.user.deleteMany({
      where: { email: { in: [testGarageOwnerEmail, testMechanicEmail] } },
    });
  });

  it('1. Public Garage Self-Registration creates PENDING garage and GARAGE role user', async () => {
    const res = await request(app)
      .post('/api/garages/register')
      .send({
        ownerName: 'Test Owner',
        email: testGarageOwnerEmail,
        phone: '9988776655',
        password: 'Password123!',
        garageName: `Test Super Auto ${timestamp}`,
        address: '100 Civil Lines',
        city: 'Kanpur',
        state: 'Uttar Pradesh',
        pinCode: '208001',
        description: 'Quality multi-brand car repairs',
        services: ['ENGINE', 'BRAKES'],
      });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe(Role.GARAGE);
    expect(res.body.garage.status).toBe(GarageStatus.PENDING);
    expect(res.body.garage.isVerified).toBe(false);
    expect(res.body.accessToken).toBeDefined();

    registeredGarageId = res.body.garage.id;
    garageOwnerAccessToken = res.body.accessToken;
  });

  it('2. Garage Owner cannot access operational dashboard while status is PENDING', async () => {
    const res = await request(app)
      .get('/api/garage/dashboard')
      .set('Authorization', `Bearer ${garageOwnerAccessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.status).toBe(GarageStatus.PENDING);
    expect(res.body.error).toContain('pending approval');
  });

  it('3. Garage Owner CAN view their own profile even when PENDING', async () => {
    const res = await request(app)
      .get('/api/garage/profile')
      .set('Authorization', `Bearer ${garageOwnerAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.garage.id).toBe(registeredGarageId);
    expect(res.body.garage.status).toBe(GarageStatus.PENDING);
  });

  it('4. Master Admin lists garages with status filters and finds the pending garage', async () => {
    const res = await request(app)
      .get('/api/admin/garages?status=PENDING')
      .set('Authorization', `Bearer ${adminAccessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.garages)).toBe(true);
    const found = res.body.garages.find((g: any) => g.id === registeredGarageId);
    expect(found).toBeDefined();
    expect(found.status).toBe(GarageStatus.PENDING);
  });

  it('5. Master Admin approves the pending garage', async () => {
    const res = await request(app)
      .post(`/api/admin/garages/${registeredGarageId}/approve`)
      .set('Authorization', `Bearer ${adminAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.garage.status).toBe(GarageStatus.APPROVED);
    expect(res.body.garage.isVerified).toBe(true);
  });

  it('6. Garage Owner can now access dashboard after Master Admin approval', async () => {
    const res = await request(app)
      .get('/api/garage/dashboard')
      .set('Authorization', `Bearer ${garageOwnerAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.metrics).toBeDefined();
    expect(res.body.metrics.totalBookings).toBe(0);
  });

  it('7. Garage Owner invites a mechanic via email', async () => {
    const res = await request(app)
      .post('/api/garage/mechanics/invite')
      .set('Authorization', `Bearer ${garageOwnerAccessToken}`)
      .send({
        name: 'Sunil Mechanic',
        email: testMechanicEmail,
        phone: '9876543299',
        skills: ['ENGINE', 'BRAKES'],
        specialization: 'Diesel Engines',
        experienceYears: 5,
      });

    expect(res.status).toBe(201);
    expect(res.body.invitation).toBeDefined();
    expect(res.body.invitation.inviteUrl).toContain('/mechanic/accept-invitation?token=');

    // Extract token from inviteUrl
    const url = new URL(res.body.invitation.inviteUrl);
    mechanicInvitationToken = url.searchParams.get('token')!;
    expect(mechanicInvitationToken).toBeDefined();
  });

  it('8. Mechanic accepts invitation publicly and creates account under assigned garage', async () => {
    // 8a. Check invitation details endpoint
    const detailsRes = await request(app)
      .get(`/api/mechanics/invitation/${mechanicInvitationToken}`);

    expect(detailsRes.status).toBe(200);
    expect(detailsRes.body.invitation.email).toBe(testMechanicEmail);
    expect(detailsRes.body.invitation.garage.id).toBe(registeredGarageId);

    // 8b. Submit password and activate
    const acceptRes = await request(app)
      .post('/api/mechanics/accept-invitation')
      .send({
        token: mechanicInvitationToken,
        password: 'Password123!',
        specialization: 'Diagnostic Expert',
        experienceYears: 6,
      });

    expect(acceptRes.status).toBe(201);
    expect(acceptRes.body.user.role).toBe(Role.MECHANIC);
    expect(acceptRes.body.user.mechanicProfile.garageId).toBe(registeredGarageId);
    expect(acceptRes.body.accessToken).toBeDefined();

    mechanicUserId = acceptRes.body.user.id;
  });

  it('9. Master Admin can view platform mechanics and suspend/reactivate any mechanic', async () => {
    // Check mechanic appears in Master Admin list
    const listRes = await request(app)
      .get('/api/admin/mechanics')
      .set('Authorization', `Bearer ${adminAccessToken}`);

    expect(listRes.status).toBe(200);
    const foundMech = listRes.body.mechanics.find((m: any) => m.userId === mechanicUserId);
    expect(foundMech).toBeDefined();
    expect(foundMech.status).toBe(MechanicStatus.ACTIVE);

    // Suspend mechanic by Master Admin override
    const suspendRes = await request(app)
      .post(`/api/admin/mechanics/${mechanicUserId}/suspend`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ reason: 'Compliance verification required' });

    expect(suspendRes.status).toBe(200);
    expect(suspendRes.body.mechanic.status).toBe(MechanicStatus.SUSPENDED);
    expect(suspendRes.body.mechanic.available).toBe(false);

    // Reactivate mechanic
    const reactivateRes = await request(app)
      .post(`/api/admin/mechanics/${mechanicUserId}/reactivate`)
      .set('Authorization', `Bearer ${adminAccessToken}`);

    expect(reactivateRes.status).toBe(200);
    expect(reactivateRes.body.mechanic.status).toBe(MechanicStatus.ACTIVE);
  });

  it('10. Master Admin can fetch system audit logs', async () => {
    const res = await request(app)
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${adminAccessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.auditLogs)).toBe(true);
    expect(res.body.auditLogs.length).toBeGreaterThan(0);
  });
});

