import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../config/db.js';
import { AuthenticatedRequest, TokenPayload } from '../types/index.js';

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. No token provided.' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token.' });
    return;
  }
}

export function authorizeRoles(...roles: Role[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized. Please login.' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied. Role ${req.user.role} is not permitted for this resource.`,
      });
      return;
    }

    // High-security Master Admin enforcement:
    // If the authenticated user is acting as ADMIN, verify against the reserved Master Admin identity
    // and verify current database state (never rely solely on JWT token payload or email matching alone).
    if (req.user.role === Role.ADMIN) {
      const masterEmail = env.MASTER_ADMIN_EMAIL.toLowerCase().trim();
      const tokenEmail = req.user.email?.toLowerCase().trim();

      if (tokenEmail !== masterEmail) {
        res.status(403).json({
          error: 'Access denied. Only the authorized Master Admin account can perform administrative actions.',
        });
        return;
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { id: true, email: true, role: true },
      });

      if (!dbUser || dbUser.role !== Role.ADMIN || dbUser.email.toLowerCase().trim() !== masterEmail) {
        res.status(403).json({
          error: 'Access denied. Account is not recognized as authorized Master Admin.',
        });
        return;
      }
    }

    next();
  };
}

export const requireMasterAdmin = authorizeRoles(Role.ADMIN);
