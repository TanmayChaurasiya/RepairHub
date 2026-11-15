import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { prisma } from '../../src/config/db.js';
import { Role } from '@prisma/client';

const app = createApp();

describe('Master Admin Security & Role-Based Access Isolation Tests', () => {
  const masterAdminEmail = env.MASTER_ADMIN_EMAIL.toLowerCase().trim();
  const masterAdminPass = env.MASTER_ADMIN_INITIAL_PASSWORD || 'MasterAdmin@2026!';

  let masterAdminToken: string;
  let customerToken: string;
  let mechanicToken: string;
  let garageOwnerToken: string;

  beforeAll(async () => {
    // Ensure test users exist with known passwords for test verification
    // 1. Master Admin Login
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: masterAdminEmail,
        password: masterAdminPass,
        expectedRole: 'ADMIN',
      });

    expect(adminLoginRes.status).toBe(200);
    masterAdminToken = adminLoginRes.body.accessToken;

    // 2. Customer Login
    const customerLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'arun.customer@gmail.com',
        password: 'Password123!',
        expectedRole: 'CUSTOMER',
      });
    expect(customerLoginRes.status).toBe(200);
    customerToken = customerLoginRes.body.accessToken;

    // 3. Mechanic Login
    const mechanicLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'vikram.mechanic@repairhub.in',
        password: 'Password123!',
        expectedRole: 'MECHANIC',
      });
    expect(mechanicLoginRes.status).toBe(200);
    mechanicToken = mechanicLoginRes.body.accessToken;

    // 4. Garage Owner Login
    const garageLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'owner@sharmaauto.com',
        password: 'Password123!',
        expectedRole: 'GARAGE',
      });
    expect(garageLoginRes.status).toBe(200);
    garageOwnerToken = garageLoginRes.body.accessToken;
  });

  // Scenario 1: Master Admin login with authorized account
  it('1. Master Admin login with authorized account succeeds and returns ADMIN role', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: masterAdminEmail,
        password: masterAdminPass,
        expectedRole: 'ADMIN',
      });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(masterAdminEmail);
    expect(res.body.user.role).toBe(Role.ADMIN);
    expect(res.body.accessToken).toBeDefined();
  });

  // Scenario 2: Admin email registration through customer registration
  it('2. Admin email cannot be registered through customer registration', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Imposter Admin',
        email: masterAdminEmail,
        phone: '9999999999',
        password: 'SomePassword123!',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/reserved for system administration/i);
  });

  // Scenario 3: Admin email registration through mechanic registration
  it('3. Admin email cannot be registered through mechanic registration', async () => {
    const garage = await prisma.garage.findFirst();
    const res = await request(app)
      .post('/api/mechanics')
      .set('Authorization', `Bearer ${masterAdminToken}`)
      .send({
        name: 'Imposter Mechanic',
        email: masterAdminEmail,
        phone: '9999999999',
        password: 'SomePassword123!',
        garageId: garage!.id,
        skills: ['ENGINE'],
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/reserved for system administration/i);
  });

  // Scenario 4: Admin email registration through garage registration
  it('4. Admin email cannot be registered through garage registration', async () => {
    const res = await request(app)
      .post('/api/garages/register')
      .send({
        ownerName: 'Imposter Owner',
        email: masterAdminEmail,
        phone: '9999999999',
        password: 'SomePassword123!',
        garageName: 'Imposter Motors',
        address: '123 Fake Street',
        city: 'Kanpur',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/reserved for system administration/i);
  });

  // Scenario 5: Admin email login through customer portal
  it('5. Denies access when Master Admin email attempts to log in through Customer portal', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: masterAdminEmail,
        password: masterAdminPass,
        expectedRole: 'CUSTOMER',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/can only log in through the Master Admin portal/i);
  });

  // Scenario 6: Admin email login through mechanic portal
  it('6. Denies access when Master Admin email attempts to log in through Mechanic portal', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: masterAdminEmail,
        password: masterAdminPass,
        expectedRole: 'MECHANIC',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/can only log in through the Master Admin portal/i);
  });

  // Scenario 7: Admin email login through garage portal
  it('7. Denies access when Master Admin email attempts to log in through Garage Owner portal', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: masterAdminEmail,
        password: masterAdminPass,
        expectedRole: 'GARAGE',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/can only log in through the Master Admin portal/i);
  });

  // Scenario 8: Normal customer login
  it('8. Normal customer logs in successfully through customer portal', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'arun.customer@gmail.com',
        password: 'Password123!',
        expectedRole: 'CUSTOMER',
      });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe(Role.CUSTOMER);
  });

  // Scenario 9: Normal mechanic login
  it('9. Normal mechanic logs in successfully through mechanic portal', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'vikram.mechanic@repairhub.in',
        password: 'Password123!',
        expectedRole: 'MECHANIC',
      });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe(Role.MECHANIC);
  });

  // Scenario 10: Normal garage-owner login
  it('10. Normal garage owner logs in successfully through garage portal', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'owner@sharmaauto.com',
        password: 'Password123!',
        expectedRole: 'GARAGE',
      });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe(Role.GARAGE);
  });

  // Scenario 11: Customer attempting to access admin APIs
  it('11. Customer attempting to access admin APIs is rejected with HTTP 403', async () => {
    const res = await request(app)
      .get('/api/admin/garages')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
  });

  // Scenario 12: Mechanic attempting to access admin APIs
  it('12. Mechanic attempting to access admin APIs is rejected with HTTP 403', async () => {
    const res = await request(app)
      .get('/api/admin/garages')
      .set('Authorization', `Bearer ${mechanicToken}`);

    expect(res.status).toBe(403);
  });

  // Scenario 13: Garage owner attempting to access admin APIs
  it('13. Garage owner attempting to access admin APIs is rejected with HTTP 403', async () => {
    const res = await request(app)
      .get('/api/admin/garages')
      .set('Authorization', `Bearer ${garageOwnerToken}`);

    expect(res.status).toBe(403);
  });

  // Scenario 14: Non-admin trying to log in as ADMIN rejected
  it('14. Non-admin user attempting to authenticate through Master Admin portal is denied access', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'arun.customer@gmail.com',
        password: 'Password123!',
        expectedRole: 'ADMIN',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Only the authorized Master Admin account can access/i);
  });

  // Scenario 15: Master Admin successfully accesses admin APIs
  it('15. Authorized Master Admin successfully accesses admin APIs', async () => {
    const res = await request(app)
      .get('/api/admin/garages')
      .set('Authorization', `Bearer ${masterAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.garages).toBeDefined();
    expect(Array.isArray(res.body.garages)).toBe(true);
  });
});

