import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';

const app = createApp();

describe('RepairHub Integration Tests (Full Flow & Security Rules)', () => {
  let adminToken: string;
  let mechanicToken: string;
  let mechanicId: string;
  let garageId: string;

  let customerAToken: string;
  let customerAId: string;
  let customerAVehicleId: string;

  let customerBToken: string;

  beforeAll(async () => {
    // Login Master Admin
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: env.MASTER_ADMIN_EMAIL,
        password: env.MASTER_ADMIN_INITIAL_PASSWORD || 'MasterAdmin@2026!',
        expectedRole: 'ADMIN',
      });
    expect(adminLoginRes.status).toBe(200);
    adminToken = adminLoginRes.body.accessToken;

    // Login seeded mechanic (Vikram Sharma)
    const mechanicLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'vikram.mechanic@repairhub.in', password: 'Password123!' });
    expect(mechanicLoginRes.status).toBe(200);
    mechanicToken = mechanicLoginRes.body.accessToken;
    mechanicId = mechanicLoginRes.body.user.id;

    // Fetch verified garage
    const garageRes = await request(app).get('/api/garages');
    expect(garageRes.status).toBe(200);
    garageId = garageRes.body.garages[0].id;

    // Register Customer B for cross-tenant isolation testing
    const custBEmail = `test.custb.${Date.now()}@example.com`;
    const custBRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Customer B',
        email: custBEmail,
        phone: '9988776655',
        password: 'Password123!',
      });
    expect(custBRes.status).toBe(201);
    customerBToken = custBRes.body.accessToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('Happy Path: Complete End-to-End Workflow from Registration to Review', async () => {
    // 1. Customer registers
    const custAEmail = `test.customer.${Date.now()}@example.com`;
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Sameer Joshi',
        email: custAEmail,
        phone: '9876501234',
        password: 'Password123!',
      });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.user.role).toBe('CUSTOMER');
    customerAToken = registerRes.body.accessToken;
    customerAId = registerRes.body.user.id;

    // 2. Customer adds a vehicle
    const vehicleRegNo = `UP78-TEST-${Math.floor(1000 + Math.random() * 9000)}`;
    const addVehicleRes = await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        type: 'CAR',
        make: 'Tata',
        model: 'Nexon EV',
        year: 2023,
        regNo: vehicleRegNo,
      });

    expect(addVehicleRes.status).toBe(201);
    expect(addVehicleRes.body.vehicle.regNo).toBe(vehicleRegNo);
    customerAVehicleId = addVehicleRes.body.vehicle.id;

    // 3. Customer submits a repair request
    const createReqRes = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        vehicleId: customerAVehicleId,
        garageId,
        category: 'ENGINE',
        description: 'Battery cooling fan running excessively and warning light on.',
        photos: [],
      });

    expect(createReqRes.status).toBe(201);
    const requestId = createReqRes.body.request.id;
    expect(createReqRes.body.request.status).toBe('SUBMITTED');

    // 4. Admin views ranked mechanic suggestions
    const suggestionsRes = await request(app)
      .get(`/api/requests/${requestId}/suggestions`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(suggestionsRes.status).toBe(200);
    expect(suggestionsRes.body.suggestions.length).toBeGreaterThan(0);

    // 5. Admin assigns mechanic
    const assignRes = await request(app)
      .post(`/api/requests/${requestId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        mechanicId,
        note: 'Assigned to senior technician Vikram',
      });

    expect(assignRes.status).toBe(200);
    expect(assignRes.body.request.status).toBe('ASSIGNED');
    expect(assignRes.body.request.mechanicId).toBe(mechanicId);

    // 6. Mechanic starts inspection
    const startInspectionRes = await request(app)
      .post(`/api/requests/${requestId}/transition`)
      .set('Authorization', `Bearer ${mechanicToken}`)
      .send({
        targetStatus: 'INSPECTING',
        note: 'Vehicle placed on diagnostic lift',
      });

    expect(startInspectionRes.status).toBe(200);
    expect(startInspectionRes.body.request.status).toBe('INSPECTING');

    // 7. Mechanic records diagnosis
    const diagnosisRes = await request(app)
      .put(`/api/requests/${requestId}/diagnosis`)
      .set('Authorization', `Bearer ${mechanicToken}`)
      .send({
        diagnosis: 'Coolant temperature sensor faulty and auxiliary relay defective.',
      });

    expect(diagnosisRes.status).toBe(200);

    // 8. Mechanic creates and sends estimate
    const sendEstimateRes = await request(app)
      .post(`/api/estimates/request/${requestId}`)
      .set('Authorization', `Bearer ${mechanicToken}`)
      .send({
        items: [
          {
            kind: 'LABOUR',
            description: 'Thermal diagnostic & sensor calibration',
            quantity: 1,
            unitPricePaise: 120000, // ₹1,200.00
          },
          {
            kind: 'PART',
            description: 'Coolant Temperature Sensor OEM',
            quantity: 1,
            unitPricePaise: 180000, // ₹1,800.00
          },
        ],
      });

    expect(sendEstimateRes.status).toBe(201);
    const estimateId = sendEstimateRes.body.estimate.id;
    expect(sendEstimateRes.body.estimate.status).toBe('SENT');
    expect(sendEstimateRes.body.estimate.totalPaise).toBe(300000); // ₹3,000.00
    expect(sendEstimateRes.body.request.status).toBe('ESTIMATE_SENT');

    // 9. Customer approves estimate
    const approveRes = await request(app)
      .post(`/api/estimates/${estimateId}/decision`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        decision: 'APPROVE',
        customerNote: 'Approved, please proceed with original parts.',
      });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.estimate.status).toBe('APPROVED');
    expect(approveRes.body.request.status).toBe('APPROVED');

    // 10. Mechanic starts work (IN_PROGRESS)
    const inProgressRes = await request(app)
      .post(`/api/requests/${requestId}/transition`)
      .set('Authorization', `Bearer ${mechanicToken}`)
      .send({
        targetStatus: 'IN_PROGRESS',
        note: 'Replacement sensor fitted',
      });

    expect(inProgressRes.status).toBe(200);
    expect(inProgressRes.body.request.status).toBe('IN_PROGRESS');

    // 11. Mechanic moves to Quality Check (QC)
    const qcRes = await request(app)
      .post(`/api/requests/${requestId}/transition`)
      .set('Authorization', `Bearer ${mechanicToken}`)
      .send({
        targetStatus: 'QC',
        note: 'Test cycle completed, temperature reading normal',
      });

    expect(qcRes.status).toBe(200);
    expect(qcRes.body.request.status).toBe('QC');

    // 12. Mechanic marks COMPLETED (Invoice automatically created)
    const completeRes = await request(app)
      .post(`/api/requests/${requestId}/transition`)
      .set('Authorization', `Bearer ${mechanicToken}`)
      .send({
        targetStatus: 'COMPLETED',
        note: 'Ready for customer pickup and payment',
      });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.request.status).toBe('COMPLETED');
    expect(completeRes.body.request.invoice).toBeDefined();
    expect(completeRes.body.request.invoice.totalPaise).toBe(300000);

    // 13. Customer creates payment order and confirms payment
    const createOrderRes = await request(app)
      .post('/api/payments/create-order')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ requestId });

    expect(createOrderRes.status).toBe(200);
    const orderId = createOrderRes.body.orderId;

    const confirmPaymentRes = await request(app)
      .post('/api/payments/confirm')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        requestId,
        orderId,
        paymentId: `PAY_MOCK_${Date.now()}`,
      });

    expect(confirmPaymentRes.status).toBe(200);
    expect(confirmPaymentRes.body.request.status).toBe('PAID');
    expect(confirmPaymentRes.body.payment.status).toBe('SUCCESS');

    // 14. Customer leaves a 5-star review
    const reviewRes = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        requestId,
        rating: 5,
        comment: 'Super fast and transparent repair service in Kanpur!',
      });

    expect(reviewRes.status).toBe(201);
    expect(reviewRes.body.review.rating).toBe(5);
  });

  describe('Security & Business Rule Enforcements', () => {
    let testReqId: string;

    beforeAll(async () => {
      // Create a test request owned by Customer A
      const reqRes = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          vehicleId: customerAVehicleId,
          garageId,
          category: 'BRAKES',
          description: 'Security test brake inspection',
          photos: [],
        });
      testReqId = reqRes.body.request.id;
    });

    it('403: Customer cannot read another customer’s request', async () => {
      const res = await request(app)
        .get(`/api/requests/${testReqId}`)
        .set('Authorization', `Bearer ${customerBToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/cannot view another customer’s request/i);
    });

    it('403: Customer cannot assign a mechanic', async () => {
      const res = await request(app)
        .post(`/api/requests/${testReqId}/assign`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ mechanicId });

      expect(res.status).toBe(403);
    });

    it('409: Illegal transition (attempting to jump from SUBMITTED directly to COMPLETED)', async () => {
      const res = await request(app)
        .post(`/api/requests/${testReqId}/transition`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ targetStatus: 'COMPLETED' });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/illegal state transition/i);
    });

    it('409: Payment only possible when COMPLETED (cannot pay while SUBMITTED)', async () => {
      const res = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ requestId: testReqId });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/only possible when repair is COMPLETED/i);
    });

    it('409: A superseded estimate cannot be approved', async () => {
      // Assign and start inspecting
      await request(app)
        .post(`/api/requests/${testReqId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ mechanicId });

      await request(app)
        .post(`/api/requests/${testReqId}/transition`)
        .set('Authorization', `Bearer ${mechanicToken}`)
        .send({ targetStatus: 'INSPECTING' });

      // Mechanic sends Estimate v1
      const est1Res = await request(app)
        .post(`/api/estimates/request/${testReqId}`)
        .set('Authorization', `Bearer ${mechanicToken}`)
        .send({
          items: [
            {
              kind: 'LABOUR',
              description: 'Initial brake check',
              quantity: 1,
              unitPricePaise: 50000,
            },
          ],
        });

      const estimateV1Id = est1Res.body.estimate.id;

      // Mechanic reopens to revise and sends Estimate v2
      await request(app)
        .post(`/api/estimates/request/${testReqId}/reopen`)
        .set('Authorization', `Bearer ${mechanicToken}`);

      const est2Res = await request(app)
        .post(`/api/estimates/request/${testReqId}`)
        .set('Authorization', `Bearer ${mechanicToken}`)
        .send({
          items: [
            {
              kind: 'LABOUR',
              description: 'Revised comprehensive brake check & rotor skimming',
              quantity: 1,
              unitPricePaise: 90000,
            },
          ],
        });

      expect(est2Res.status).toBe(201);
      expect(est2Res.body.estimate.version).toBe(2);

      // Now Customer attempts to approve superseded Estimate v1 -> MUST return 409
      const approveV1Res = await request(app)
        .post(`/api/estimates/${estimateV1Id}/decision`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ decision: 'APPROVE' });

      expect(approveV1Res.status).toBe(409);
      expect(approveV1Res.body.error).toMatch(/superseded estimate cannot be approved/i);
    });
  });
});
