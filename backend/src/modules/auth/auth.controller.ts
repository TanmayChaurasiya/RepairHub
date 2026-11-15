import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { AuthenticatedRequest, TokenPayload } from '../../types/index.js';
import { emailService } from '../../services/email/mailer.js';

export function generateTokens(payload: TokenPayload) {
  const accessToken = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as any,
  });

  const refreshToken = jwt.sign(
    { userId: payload.userId, jti: crypto.randomUUID() },
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
    }
  );

  return { accessToken, refreshToken };
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, email, phone, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();
    const masterAdminEmail = env.MASTER_ADMIN_EMAIL.toLowerCase().trim();

    // The Master Admin identity is reserved exclusively for the platform administrator
    if (normalizedEmail === masterAdminEmail) {
      res.status(403).json({
        error: 'This email address is reserved for system administration and cannot register as a customer.',
      });
      return;
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      res.status(409).json({ error: 'An account with this email address already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Enforce role: CUSTOMER (never accept client-supplied role for self-registration)
    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        phone,
        passwordHash,
        role: Role.CUSTOMER,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const { accessToken, refreshToken } = generateTokens(tokenPayload);

    // Save refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt,
      },
    });

    res.status(201).json({
      message: 'Account registered successfully',
      user,
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        mechanicProfile: {
          include: {
            garage: true,
          },
        },
        ownedGarage: true,
      },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    // Check account lockout
    const now = new Date();
    if (user.lockoutUntil && user.lockoutUntil > now) {
      const waitMinutes = Math.ceil((user.lockoutUntil.getTime() - now.getTime()) / 60000);
      res.status(429).json({
        error: `Account temporarily locked due to repeated failed logins. Please try again in ${waitMinutes} minute(s).`,
      });
      return;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      const newAttempts = user.failedLoginAttempts + 1;
      let lockoutDate: Date | null = null;

      if (newAttempts >= env.MAX_FAILED_LOGIN_ATTEMPTS) {
        lockoutDate = new Date(Date.now() + env.LOCKOUT_DURATION_MINUTES * 60 * 1000);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newAttempts,
          lockoutUntil: lockoutDate,
        },
      });

      if (lockoutDate) {
        res.status(429).json({
          error: `Too many failed attempts. Account locked for ${env.LOCKOUT_DURATION_MINUTES} minutes.`,
        });
        return;
      }

      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    // Strict Role-Based Portal Enforcement:
    // 1. The Master Admin email is restricted exclusively to the Master Admin login flow
    // 2. No other user can authenticate through the Master Admin portal
    // 3. Each role must authenticate through their designated portal tab
    const normalizedEmail = email.toLowerCase().trim();
    const masterAdminEmail = env.MASTER_ADMIN_EMAIL.toLowerCase().trim();
    const { expectedRole } = req.body;

    if (normalizedEmail === masterAdminEmail) {
      if (expectedRole && expectedRole !== Role.ADMIN) {
        res.status(403).json({
          error: 'This account has administrative privileges and can only log in through the Master Admin portal.',
        });
        return;
      }
      if (user.role !== Role.ADMIN) {
        res.status(403).json({
          error: 'Master Admin account role integrity mismatch. Please contact system administrator.',
        });
        return;
      }
    }

    if (expectedRole === Role.ADMIN) {
      if (normalizedEmail !== masterAdminEmail || user.role !== Role.ADMIN) {
        res.status(403).json({
          error: 'Access denied. Only the authorized Master Admin account can access the Master Admin portal.',
        });
        return;
      }
    }

    if (expectedRole && expectedRole !== user.role) {
      res.status(403).json({
        error: `Access denied. This account is registered as a ${user.role.toLowerCase()}. Please select the ${user.role.toLowerCase()} portal to log in.`,
      });
      return;
    }

    // Reset failed attempts on success
    if (user.failedLoginAttempts > 0 || user.lockoutUntil) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockoutUntil: null,
        },
      });
    }

    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const { accessToken, refreshToken } = generateTokens(tokenPayload);

    // Save refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt,
      },
    });

    const userProfile = {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      mechanicProfile: user.mechanicProfile,
      ownedGarage: user.ownedGarage,
      createdAt: user.createdAt,
    };

    res.json({
      message: 'Login successful',
      user: userProfile,
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body;

    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    } catch {
      res.status(401).json({ error: 'Invalid or expired refresh token.' });
      return;
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken || storedToken.revoked || storedToken.expiresAt < new Date()) {
      res.status(401).json({ error: 'Refresh token is expired or revoked. Please log in again.' });
      return;
    }

    // Revoke old token (rotation)
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked: true },
    });

    const tokenPayload: TokenPayload = {
      userId: storedToken.user.id,
      email: storedToken.user.email,
      role: storedToken.user.role,
    };

    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(tokenPayload);

    // Save new refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.refreshToken.create({
      data: {
        userId: storedToken.user.id,
        token: newRefreshToken,
        expiresAt,
      },
    });

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.updateMany({
        where: { token: refreshToken },
        data: { revoked: true },
      });
    }

    res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
}

export async function me(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
        mechanicProfile: {
          include: {
            garage: true,
          },
        },
        ownedGarage: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email } = req.body;
    const normalizedEmail = email.toLowerCase().trim();
    const genericMessage = 'If an account exists with this email address, a password reset link has been sent.';

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      // Prevent email enumeration
      res.status(200).json({ message: genericMessage });
      return;
    }

    // Generate a cryptographically secure random token (32 bytes = 64 hex characters)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Invalidate any prior unused reset tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    // Token expires in 30 minutes
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // Dispatch email
    try {
      await emailService.sendPasswordResetEmail({
        toEmail: user.email,
        name: user.name,
        resetToken: rawToken,
      });
    } catch (emailErr: any) {
      const sanitizedError = emailErr?.message || 'Email delivery failed';
      console.error('❌ [AUTH] Failed to dispatch password reset email:', sanitizedError);
      if (env.NODE_ENV === 'production') {
        res.status(500).json({ error: 'Unable to send password reset email at this time. Please try again later.' });
        return;
      }
    }

    res.status(200).json({ message: genericMessage });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token, password } = req.body;

    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'Reset token is required.' });
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetRecord) {
      res.status(400).json({ error: 'Invalid or expired password reset link.' });
      return;
    }

    if (resetRecord.usedAt !== null) {
      res.status(400).json({ error: 'This password reset link has already been used. Please request a new one.' });
      return;
    }

    if (resetRecord.expiresAt < new Date()) {
      res.status(400).json({ error: 'This password reset link has expired. Please request a new one.' });
      return;
    }

    // Hash new password using existing bcrypt configuration
    const passwordHash = await bcrypt.hash(password, 10);

    // Atomically update password, mark token used, and revoke all active refresh tokens
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRecord.userId },
        data: {
          passwordHash,
          failedLoginAttempts: 0,
          lockoutUntil: null,
        },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: resetRecord.userId },
        data: { revoked: true },
      }),
    ]);

    res.status(200).json({
      message: 'Your password has been reset successfully. You can now log in with your new password.',
    });
  } catch (err) {
    next(err);
  }
}
