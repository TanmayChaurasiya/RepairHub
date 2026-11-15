-- CreateEnum
CREATE TYPE "GarageStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "MechanicStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'GARAGE';

-- AlterTable
ALTER TABLE "Garage" ADD COLUMN     "description" TEXT,
ADD COLUMN     "operatingHours" TEXT,
ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "pinCode" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "services" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "state" TEXT,
ADD COLUMN     "status" "GarageStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "MechanicProfile" ADD COLUMN     "experienceYears" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "specialization" TEXT,
ADD COLUMN     "status" "MechanicStatus" NOT NULL DEFAULT 'ACTIVE';

-- Update existing verified garages to APPROVED
UPDATE "Garage" SET "status" = 'APPROVED' WHERE "isVerified" = true;

-- CreateTable
CREATE TABLE "MechanicInvitation" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "skills" TEXT[],
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MechanicInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" "Role" NOT NULL,
    "action" TEXT NOT NULL,
    "targetEntity" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MechanicInvitation_tokenHash_key" ON "MechanicInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "MechanicInvitation_garageId_idx" ON "MechanicInvitation"("garageId");

-- CreateIndex
CREATE INDEX "MechanicInvitation_email_idx" ON "MechanicInvitation"("email");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_targetEntity_targetId_idx" ON "AuditLog"("targetEntity", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Garage_ownerId_key" ON "Garage"("ownerId");

-- CreateIndex
CREATE INDEX "Garage_status_idx" ON "Garage"("status");

-- CreateIndex
CREATE INDEX "Garage_city_idx" ON "Garage"("city");

-- CreateIndex
CREATE INDEX "MechanicProfile_garageId_idx" ON "MechanicProfile"("garageId");

-- CreateIndex
CREATE INDEX "MechanicProfile_status_idx" ON "MechanicProfile"("status");

-- AddForeignKey
ALTER TABLE "Garage" ADD CONSTRAINT "Garage_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MechanicInvitation" ADD CONSTRAINT "MechanicInvitation_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

