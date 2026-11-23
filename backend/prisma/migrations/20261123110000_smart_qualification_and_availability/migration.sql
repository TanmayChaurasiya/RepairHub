-- CreateEnum
CREATE TYPE "PowertrainType" AS ENUM ('PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'CNG', 'OTHER');

-- AlterEnum
ALTER TYPE "EmailNotificationType" ADD VALUE IF NOT EXISTS 'MECHANIC_CURRENTLY_BUSY';
ALTER TYPE "EmailNotificationType" ADD VALUE IF NOT EXISTS 'NO_QUALIFIED_MECHANIC';

-- AlterTable Garage
ALTER TABLE "Garage" 
  ADD COLUMN IF NOT EXISTS "supportedVehicleTypes" "VehicleType"[] DEFAULT ARRAY['CAR', 'TWO_WHEELER', 'COMMERCIAL']::"VehicleType"[],
  ADD COLUMN IF NOT EXISTS "supportedPowertrains" "PowertrainType"[] DEFAULT ARRAY['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'CNG', 'OTHER']::"PowertrainType"[];

-- AlterTable MechanicProfile
ALTER TABLE "MechanicProfile" 
  ADD COLUMN IF NOT EXISTS "skillsPendingReview" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable Vehicle
ALTER TABLE "Vehicle" 
  ADD COLUMN IF NOT EXISTS "powertrain" "PowertrainType" NOT NULL DEFAULT 'PETROL',
  ADD COLUMN IF NOT EXISTS "fuelType" TEXT DEFAULT 'PETROL';

-- AlterTable RepairRequest
ALTER TABLE "RepairRequest" 
  ADD COLUMN IF NOT EXISTS "eligibilityStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "unavailabilityReason" TEXT,
  ADD COLUMN IF NOT EXISTS "requiredSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "estimatedWaitMinutes" INTEGER;

-- AlterTable AssignmentHistory
ALTER TABLE "AssignmentHistory" 
  ALTER COLUMN "newMechanicId" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "action" TEXT NOT NULL DEFAULT 'ASSIGNED',
  ADD COLUMN IF NOT EXISTS "checkResult" TEXT;

-- CreateTable IssueSkillMapping
CREATE TABLE IF NOT EXISTS "IssueSkillMapping" (
    "id" TEXT NOT NULL,
    "category" "RepairCategory" NOT NULL,
    "powertrain" "PowertrainType",
    "issuePattern" TEXT,
    "requiredSkills" TEXT[],
    "priority" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueSkillMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IssueSkillMapping_category_idx" ON "IssueSkillMapping"("category");
CREATE INDEX IF NOT EXISTS "IssueSkillMapping_powertrain_idx" ON "IssueSkillMapping"("powertrain");
CREATE INDEX IF NOT EXISTS "IssueSkillMapping_isActive_idx" ON "IssueSkillMapping"("isActive");
