-- CreateEnum
CREATE TYPE "MechanicAvailability" AS ENUM ('AVAILABLE', 'BUSY', 'OFFLINE', 'ON_BREAK');

-- CreateEnum
CREATE TYPE "EmailNotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailNotificationType" AS ENUM ('VEHICLE_AVAILABILITY_AVAILABLE', 'VEHICLE_AVAILABILITY_UNAVAILABLE', 'MECHANIC_ASSIGNED', 'MECHANIC_REASSIGNED', 'GARAGE_APPROVAL', 'GARAGE_REJECTION', 'GENERAL');

-- AlterTable
ALTER TABLE "MechanicProfile" ADD COLUMN     "availability" "MechanicAvailability" NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN     "breakReason" TEXT,
ADD COLUMN     "lastActiveAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "AssignmentHistory" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "previousMechanicId" TEXT,
    "newMechanicId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "assignedByRole" "Role" NOT NULL DEFAULT 'ADMIN',
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailNotification" (
    "id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "status" "EmailNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "type" "EmailNotificationType" NOT NULL DEFAULT 'GENERAL',
    "vehicleId" TEXT,
    "requestId" TEXT,
    "metadata" JSONB,
    "errorDetails" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssignmentHistory_requestId_idx" ON "AssignmentHistory"("requestId");

-- CreateIndex
CREATE INDEX "AssignmentHistory_assignedById_idx" ON "AssignmentHistory"("assignedById");

-- CreateIndex
CREATE INDEX "AssignmentHistory_newMechanicId_idx" ON "AssignmentHistory"("newMechanicId");

-- CreateIndex
CREATE INDEX "AssignmentHistory_createdAt_idx" ON "AssignmentHistory"("createdAt");

-- CreateIndex
CREATE INDEX "EmailNotification_recipient_idx" ON "EmailNotification"("recipient");

-- CreateIndex
CREATE INDEX "EmailNotification_status_idx" ON "EmailNotification"("status");

-- CreateIndex
CREATE INDEX "EmailNotification_type_idx" ON "EmailNotification"("type");

-- CreateIndex
CREATE INDEX "EmailNotification_vehicleId_idx" ON "EmailNotification"("vehicleId");

-- CreateIndex
CREATE INDEX "EmailNotification_createdAt_idx" ON "EmailNotification"("createdAt");

-- AddForeignKey
ALTER TABLE "AssignmentHistory" ADD CONSTRAINT "AssignmentHistory_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RepairRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentHistory" ADD CONSTRAINT "AssignmentHistory_previousMechanicId_fkey" FOREIGN KEY ("previousMechanicId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentHistory" ADD CONSTRAINT "AssignmentHistory_newMechanicId_fkey" FOREIGN KEY ("newMechanicId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentHistory" ADD CONSTRAINT "AssignmentHistory_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailNotification" ADD CONSTRAINT "EmailNotification_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailNotification" ADD CONSTRAINT "EmailNotification_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RepairRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
