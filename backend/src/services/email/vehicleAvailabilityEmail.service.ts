import { GarageStatus, MechanicStatus, MechanicAvailability, EmailNotificationStatus, EmailNotificationType } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { emailService } from './mailer.js';

export interface VehicleAvailabilityCheckResult {
  isAvailable: boolean;
  availableMechanicCount: number;
  matchingGaragesCount: number;
  reason: string;
}

/**
 * Checks whether current time falls within garage operating hours (e.g., "09:00 - 20:00" or "08:00 - 18:00")
 */
export function isWithinOperatingHours(operatingHours?: string | null): boolean {
  if (!operatingHours || !operatingHours.includes('-')) {
    // Default open window: 08:00 to 21:00 Indian Standard Time (UTC+5:30)
    const now = new Date();
    // Convert to IST
    const istHours = (now.getUTCHours() + 5 + Math.floor((now.getUTCMinutes() + 30) / 60)) % 24;
    return istHours >= 8 && istHours < 21;
  }

  try {
    const parts = operatingHours.split('-').map((s) => s.trim().toUpperCase());
    if (parts.length !== 2) return true;

    // Parse simple times like "09:00 AM" or "09:00" or "9 AM"
    const parseTime = (timeStr: string): number => {
      const match = timeStr.match(/(\d+)(?::(\d+))?\s*(AM|PM)?/i);
      if (!match) return 9;
      let hours = parseInt(match[1], 10);
      const minutes = match[2] ? parseInt(match[2], 10) : 0;
      const meridiem = match[3]?.toUpperCase();

      if (meridiem === 'PM' && hours < 12) hours += 12;
      if (meridiem === 'AM' && hours === 12) hours = 0;
      return hours + minutes / 60;
    };

    const openTime = parseTime(parts[0]);
    const closeTime = parseTime(parts[1]);

    const now = new Date();
    const istDecimal = (now.getUTCHours() + 5 + (now.getUTCMinutes() + 30) / 60) % 24;

    return istDecimal >= openTime && istDecimal <= closeTime;
  } catch {
    return true;
  }
}

/**
 * Evaluates whether suitable mechanics and garages are available for a given vehicle
 */
export async function evaluateMechanicAvailabilityForVehicle(vehicleId: string): Promise<VehicleAvailabilityCheckResult> {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
  });

  if (!vehicle) {
    return {
      isAvailable: false,
      availableMechanicCount: 0,
      matchingGaragesCount: 0,
      reason: 'Vehicle record not found',
    };
  }

  // Normalize search tokens
  const vehicleType = vehicle.type; // TWO_WHEELER, CAR, COMMERCIAL
  const vehicleMake = vehicle.make.toUpperCase().trim();

  // Find all approved and verified garages
  const approvedGarages = await prisma.garage.findMany({
    where: {
      status: GarageStatus.APPROVED,
      isVerified: true,
    },
    include: {
      mechanics: {
        where: {
          status: MechanicStatus.ACTIVE,
          availability: MechanicAvailability.AVAILABLE,
          available: true,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
  });

  let matchingGaragesCount = 0;
  let totalAvailableMechanics = 0;

  for (const garage of approvedGarages) {
    const inHours = isWithinOperatingHours(garage.operatingHours);
    if (!inHours) continue;

    // Filter mechanics who can handle this vehicle type or brand
    const compatibleMechanics = garage.mechanics.filter((m) => {
      // If mechanic has skills or specialization matching vehicle type or brand
      const specialization = (m.specialization || '').toUpperCase();
      const skillsUpper = m.skills.map((s) => s.toUpperCase());

      const matchesType =
        skillsUpper.includes(vehicleType) ||
        specialization.includes(vehicleType) ||
        skillsUpper.includes('GENERAL_SERVICE') ||
        skillsUpper.includes('ENGINE');

      const matchesMake = specialization.includes(vehicleMake) || specialization.includes('ALL');

      // If either skills cover general vehicle mechanics or specific make
      return matchesType || matchesMake || m.skills.length > 0;
    });

    if (compatibleMechanics.length > 0) {
      matchingGaragesCount++;
      totalAvailableMechanics += compatibleMechanics.length;
    }
  }

  const isAvailable = totalAvailableMechanics > 0;

  return {
    isAvailable,
    availableMechanicCount: totalAvailableMechanics,
    matchingGaragesCount,
    reason: isAvailable
      ? `${totalAvailableMechanics} active mechanics available across ${matchingGaragesCount} operating workshops.`
      : 'No active mechanics currently available or workshop operating hours closed.',
  };
}

/**
 * Asynchronously checks vehicle availability and sends appropriate notification email
 */
export async function checkAndSendVehicleAvailabilityEmail(
  vehicleId: string,
  customerId: string
): Promise<void> {
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        customer: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!vehicle || !vehicle.customer || !vehicle.customer.email) {
      console.warn(`[VEHICLE EMAIL] Cannot send email: Vehicle or customer email missing (Vehicle ID: ${vehicleId})`);
      return;
    }

    // 1. Duplicate check: prevent sending duplicate availability email for the same vehicle
    const existingNotification = await prisma.emailNotification.findFirst({
      where: {
        vehicleId,
        type: {
          in: [
            EmailNotificationType.VEHICLE_AVAILABILITY_AVAILABLE,
            EmailNotificationType.VEHICLE_AVAILABILITY_UNAVAILABLE,
          ],
        },
        status: { in: [EmailNotificationStatus.SENT, EmailNotificationStatus.PENDING] },
      },
    });

    if (existingNotification) {
      console.log(`[VEHICLE EMAIL] Notification already exists for vehicle ${vehicle.regNo} (${vehicleId}). Skipping duplicate.`);
      return;
    }

    // 2. Evaluate availability
    const evalResult = await evaluateMechanicAvailabilityForVehicle(vehicleId);
    const isAvailable = evalResult.isAvailable;

    const frontendUrl = env.FRONTEND_URL || 'http://localhost:3000';
    const bookUrl = `${frontendUrl}/customer/new-request?vehicleId=${vehicle.id}`;
    const exploreUrl = `${frontendUrl}/customer/garages`;

    const type = isAvailable
      ? EmailNotificationType.VEHICLE_AVAILABILITY_AVAILABLE
      : EmailNotificationType.VEHICLE_AVAILABILITY_UNAVAILABLE;

    const subject = isAvailable
      ? `Mechanics Available: Your ${vehicle.make} ${vehicle.model} (${vehicle.regNo}) is ready for service!`
      : `Vehicle Registered: ${vehicle.make} ${vehicle.model} (${vehicle.regNo}) - Service Availability Update`;

    const templateName = isAvailable ? 'VEHICLE_AVAILABLE' : 'VEHICLE_UNAVAILABLE';

    // 3. Create Pending Notification Record in Database
    const notification = await prisma.emailNotification.create({
      data: {
        recipient: vehicle.customer.email,
        subject,
        template: templateName,
        status: EmailNotificationStatus.PENDING,
        type,
        vehicleId,
        metadata: {
          vehicleMake: vehicle.make,
          vehicleModel: vehicle.model,
          vehicleType: vehicle.type,
          regNo: vehicle.regNo,
          year: vehicle.year,
          availableCount: evalResult.availableMechanicCount,
          matchingGarages: evalResult.matchingGaragesCount,
        },
      },
    });

    // 4. Generate Responsive HTML Email Template
    const htmlContent = isAvailable
      ? `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0B1729; color: #FFFFFF; margin: 0; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #0F172A; border: 1px solid #1E293B; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
    <div style="background: linear-gradient(135deg, #F97316 0%, #EA580C 100%); padding: 32px 24px; text-align: center;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px;">RepairHub</h1>
      <p style="margin: 6px 0 0; color: #FED7AA; font-size: 13px; font-weight: 600;">VEHICLE INTELLIGENCE &amp; SERVICE NETWORK</p>
    </div>
    
    <div style="padding: 32px 24px;">
      <div style="display: inline-block; padding: 6px 12px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 9999px; color: #34D399; font-size: 12px; font-weight: bold; margin-bottom: 16px;">
        &#10003; Compatible Mechanics Available Now
      </div>

      <h2 style="font-size: 20px; font-weight: 700; color: #FFFFFF; margin-top: 0;">Hello ${vehicle.customer.name},</h2>
      <p style="color: #94A3B8; font-size: 14px; line-height: 1.6;">
        Your vehicle <strong style="color: #FFFFFF;">${vehicle.year} ${vehicle.make} ${vehicle.model}</strong> (<code style="background: #1E293B; padding: 2px 6px; border-radius: 4px; color: #38BDF8;">${vehicle.regNo}</code>) has been successfully registered to your RepairHub garage account.
      </p>

      <div style="background-color: #1E293B; border: 1px solid #334155; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <h3 style="margin: 0 0 12px; font-size: 14px; font-weight: 700; color: #F97316; text-transform: uppercase; letter-spacing: 0.5px;">Live Workshop Availability</h3>
        <p style="margin: 0 0 8px; font-size: 13px; color: #CBD5E1;">
          We matched <strong>${evalResult.availableMechanicCount} certified technicians</strong> across <strong>${evalResult.matchingGaragesCount} verified workshops</strong> currently on-duty and equipped for your vehicle category (<em>${vehicle.type}</em>).
        </p>
        <p style="margin: 0; font-size: 12px; color: #94A3B8;">
          Transparent digital estimates, real-time photographic inspection, and smart technician assignments are available immediately.
        </p>
      </div>

      <div style="text-align: center; margin: 32px 0 16px;">
        <a href="${bookUrl}" style="background: #F97316; color: #FFFFFF; padding: 14px 28px; border-radius: 12px; font-size: 14px; font-weight: 700; text-decoration: none; display: inline-block; box-shadow: 0 4px 14px rgba(249, 115, 22, 0.4);">
          Book Inspection &amp; Service Now &rarr;
        </a>
      </div>

      <div style="text-align: center;">
        <a href="${exploreUrl}" style="color: #38BDF8; font-size: 12px; font-weight: 600; text-decoration: none;">
          Browse Partner Workshops &amp; Operating Hours
        </a>
      </div>
    </div>

    <div style="border-top: 1px solid #1E293B; padding: 20px; text-align: center; background-color: #09101D;">
      <p style="margin: 0; font-size: 11px; color: #64748B;">
        RepairHub Digital Automotive Platform &bull; Kanpur Pilot Network &bull; Need help? Contact platform support.
      </p>
    </div>
  </div>
</body>
</html>
`
      : `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0B1729; color: #FFFFFF; margin: 0; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #0F172A; border: 1px solid #1E293B; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
    <div style="background: linear-gradient(135deg, #334155 0%, #1E293B 100%); padding: 32px 24px; text-align: center;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px;">RepairHub</h1>
      <p style="margin: 6px 0 0; color: #94A3B8; font-size: 13px; font-weight: 600;">VEHICLE INTELLIGENCE &amp; SERVICE NETWORK</p>
    </div>
    
    <div style="padding: 32px 24px;">
      <div style="display: inline-block; padding: 6px 12px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 9999px; color: #FBBF24; font-size: 12px; font-weight: bold; margin-bottom: 16px;">
        &#9888; Technicians Currently Occupied / Outside Operating Hours
      </div>

      <h2 style="font-size: 20px; font-weight: 700; color: #FFFFFF; margin-top: 0;">Hello ${vehicle.customer.name},</h2>
      <p style="color: #94A3B8; font-size: 14px; line-height: 1.6;">
        Your vehicle <strong style="color: #FFFFFF;">${vehicle.year} ${vehicle.make} ${vehicle.model}</strong> (<code style="background: #1E293B; padding: 2px 6px; border-radius: 4px; color: #38BDF8;">${vehicle.regNo}</code>) has been successfully registered to your account.
      </p>

      <div style="background-color: #1E293B; border: 1px solid #334155; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <h3 style="margin: 0 0 12px; font-size: 14px; font-weight: 700; color: #F59E0B; text-transform: uppercase; letter-spacing: 0.5px;">Current Capacity Status</h3>
        <p style="margin: 0 0 8px; font-size: 13px; color: #CBD5E1;">
          Certified technicians specializing in <em>${vehicle.type}</em> repairs for ${vehicle.make} are currently handling active repair bays or workshops are outside standard operating hours (08:00 AM - 08:00 PM).
        </p>
        <p style="margin: 0; font-size: 12px; color: #94A3B8;">
          You can submit a service booking anytime. Our intelligent dispatcher will assign the first available technician as soon as operating hours resume or a bay opens.
        </p>
      </div>

      <div style="text-align: center; margin: 32px 0 16px;">
        <a href="${bookUrl}" style="background: #334155; color: #FFFFFF; padding: 14px 28px; border-radius: 12px; font-size: 14px; font-weight: 700; text-decoration: none; display: inline-block; border: 1px solid #475569;">
          Schedule Advance Booking &rarr;
        </a>
      </div>

      <div style="text-align: center;">
        <a href="${exploreUrl}" style="color: #38BDF8; font-size: 12px; font-weight: 600; text-decoration: none;">
          Check Garage Schedules &amp; Locations
        </a>
      </div>
    </div>

    <div style="border-top: 1px solid #1E293B; padding: 20px; text-align: center; background-color: #09101D;">
      <p style="margin: 0; font-size: 11px; color: #64748B;">
        RepairHub Digital Automotive Platform &bull; Kanpur Pilot Network &bull; Need help? Contact platform support.
      </p>
    </div>
  </div>
</body>
</html>
`;

    // 5. Send via Email Provider
    try {
      await emailService.sendGenericEmail({
        to: vehicle.customer.email,
        subject,
        html: htmlContent,
      });

      // Update status to SENT
      await prisma.emailNotification.update({
        where: { id: notification.id },
        data: {
          status: EmailNotificationStatus.SENT,
          sentAt: new Date(),
        },
      });

      console.log(`✅ [VEHICLE EMAIL] Successfully dispatched availability email to ${vehicle.customer.email} (Type: ${type})`);
    } catch (sendError: any) {
      console.error(`❌ [VEHICLE EMAIL] Failed sending email to ${vehicle.customer.email}:`, sendError?.message);
      await prisma.emailNotification.update({
        where: { id: notification.id },
        data: {
          status: EmailNotificationStatus.FAILED,
          errorDetails: sendError?.message || 'Email delivery failed',
        },
      });
    }
  } catch (err: any) {
    console.error(`❌ [VEHICLE EMAIL] Fatal error in vehicle availability workflow:`, err?.message);
    // Non-blocking: never throw or affect vehicle creation
  }
}
