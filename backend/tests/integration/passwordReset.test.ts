import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/config/db.js';

const app = createApp();

describe('Password Reset Integration Tests', () => {
  const testEmail = `pwreset.test.${Date.now()}@example.com`;
  const initialPassword = 'OldPassword123!';
  const newPassword = 'NewPassword456!';
  let userId: string;

  beforeAll(async () => {
    // Register a test user
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Password Reset Tester',
        email: testEmail,
        phone: '9876543210',
        password: initialPassword,
      });

    expect(regRes.status).toBe(201);
    userId = regRes.body.user.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.passwordResetToken.deleteMany({ where: { userId } });
    await prisma.refreshToken.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('1. Returns generic 200 response for unregistered email without enumeration', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nonexistent.user.999@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('If an account exists');
  });

  it('2. Returns generic 200 response and creates hashed token for registered email', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: testEmail });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('If an account exists');

    const tokenRecord = await prisma.passwordResetToken.findFirst({
      where: { userId },
    });

    expect(tokenRecord).not.toBeNull();
    expect(tokenRecord?.tokenHash).toBeDefined();
    expect(tokenRecord?.usedAt).toBeNull();
    expect(tokenRecord?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('3. Rejects reset request with invalid / non-existent token', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: 'completely-invalid-token-1234567890',
        password: newPassword,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid or expired');
  });

  it('4. Rejects reset request with expired token', async () => {
    // Create an explicitly expired token
    const expiredRaw = crypto.randomBytes(32).toString('hex');
    const expiredHash = crypto.createHash('sha256').update(expiredRaw).digest('hex');

    await prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash: expiredHash,
        expiresAt: new Date(Date.now() - 60000), // 1 minute in the past
      },
    });

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: expiredRaw,
        password: newPassword,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('expired');
  });

  it('5. Rejects reset request with weak password violating policy', async () => {
    // Generate a valid fresh token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    // Too short, no uppercase, no number
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: rawToken,
        password: 'weak',
      });

    expect(res.status).toBe(400);
    expect(res.body.errors || res.body.error).toBeDefined();
  });

  it('6. Successfully resets password with valid token and policy-compliant password', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: rawToken,
        password: newPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('reset successfully');

    // Verify token is marked as used
    const updatedToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    expect(updatedToken?.usedAt).not.toBeNull();

    // Verify existing refresh tokens are revoked
    const refreshTokens = await prisma.refreshToken.findMany({
      where: { userId },
    });
    for (const rt of refreshTokens) {
      expect(rt.revoked).toBe(true);
    }
  });

  it('7. Rejects reusing an already-used reset token', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        usedAt: new Date(), // Already used
      },
    });

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: rawToken,
        password: 'AnotherPassword789!',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('already been used');
  });

  it('8. User can log in with new password and cannot log in with old password', async () => {
    // Old password should fail
    const oldLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: initialPassword,
      });
    expect(oldLoginRes.status).toBe(401);

    // New password should succeed
    const newLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: newPassword,
      });
    expect(newLoginRes.status).toBe(200);
    expect(newLoginRes.body.accessToken).toBeDefined();
  });
});

