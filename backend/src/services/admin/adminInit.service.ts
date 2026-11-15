import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';

/**
 * Ensures the exclusive Master Admin account exists, is properly configured with Role.ADMIN,
 * has no conflicting role associations (such as garage ownership or mechanic profiles),
 * and permanently purges any hardcoded legacy demo admin accounts.
 */
export async function initializeMasterAdmin(): Promise<void> {
  const masterEmail = env.MASTER_ADMIN_EMAIL.toLowerCase().trim();

  try {
    let masterUser = await prisma.user.findUnique({
      where: { email: masterEmail },
      include: { ownedGarage: true, mechanicProfile: true },
    });

    const passwordToHash = env.MASTER_ADMIN_INITIAL_PASSWORD || 'MasterAdmin@2026!';
    const passwordHash = await bcrypt.hash(passwordToHash, 10);

    if (masterUser) {
      // Ensure master admin has pure ADMIN role and no conflicting relations
      const updates: any = {
        role: Role.ADMIN,
        failedLoginAttempts: 0,
        lockoutUntil: null,
      };

      // If initial password configured and needed, keep it synced securely
      if (env.MASTER_ADMIN_INITIAL_PASSWORD) {
        updates.passwordHash = passwordHash;
      }

      await prisma.user.update({
        where: { id: masterUser.id },
        data: updates,
      });

      // Detach any garage ownership to maintain strict separation of concerns
      if (masterUser.ownedGarage) {
        await prisma.garage.update({
          where: { id: masterUser.ownedGarage.id },
          data: { ownerId: null },
        });
      }

      // Remove any mechanic profile if previously attached
      if (masterUser.mechanicProfile) {
        await prisma.mechanicProfile.delete({
          where: { id: masterUser.mechanicProfile.id },
        });
      }

      console.log(`✅ [MASTER ADMIN] Master Admin account verified and role repaired: ${masterEmail}`);
    } else {
      masterUser = await prisma.user.create({
        data: {
          email: masterEmail,
          name: 'Master Admin',
          role: Role.ADMIN,
          passwordHash,
          phone: '9807186955',
        },
        include: { ownedGarage: true, mechanicProfile: true },
      });

      console.log(`✅ [MASTER ADMIN] Master Admin account initialized: ${masterEmail}`);
    }

    // Purge legacy demo admin account if still present
    const demoAdmin = await prisma.user.findUnique({
      where: { email: 'admin@repairhub.in' },
    });

    if (demoAdmin && demoAdmin.id !== masterUser.id) {
      // Re-attribute any audit logs to the legitimate Master Admin
      await prisma.auditLog.updateMany({
        where: { actorId: demoAdmin.id },
        data: { actorId: masterUser.id },
      });

      // Clean up tokens and delete legacy demo account
      await prisma.refreshToken.deleteMany({ where: { userId: demoAdmin.id } });
      await prisma.passwordResetToken.deleteMany({ where: { userId: demoAdmin.id } });
      await prisma.user.delete({ where: { id: demoAdmin.id } });

      console.log('🛡️ [SECURITY] Hardcoded demo admin account (admin@repairhub.in) purged from database.');
    }
  } catch (err: any) {
    console.error('❌ [MASTER ADMIN] Error during Master Admin initialization:', err?.message || err);
  }
}

