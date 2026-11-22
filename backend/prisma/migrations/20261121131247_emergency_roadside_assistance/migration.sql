-- CreateEnum
CREATE TYPE "EmergencyCategory" AS ENUM ('FLAT_TYRE', 'BATTERY_FAILURE', 'ENGINE_OVERHEATING', 'VEHICLE_BREAKDOWN', 'ENGINE_PROBLEMS', 'FUEL_PROBLEMS', 'TOWING', 'OTHER');

-- CreateEnum
CREATE TYPE "EmergencyStatus" AS ENUM ('REQUESTED', 'SEARCHING', 'PENDING_ACCEPTANCE', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'UNFULFILLED');

-- AlterTable
ALTER TABLE "Garage" ADD COLUMN     "acceptsEmergency" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emergencyPhone" TEXT,
ADD COLUMN     "emergencyRadiusKm" DOUBLE PRECISION NOT NULL DEFAULT 25.0,
ADD COLUMN     "latitude" DOUBLE PRECISION DEFAULT 26.4735,
ADD COLUMN     "longitude" DOUBLE PRECISION DEFAULT 80.3075;

-- AlterTable
ALTER TABLE "MechanicProfile" ADD COLUMN     "acceptsEmergency" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emergencyServiceRadiusKm" DOUBLE PRECISION NOT NULL DEFAULT 20.0,
ADD COLUMN     "latitude" DOUBLE PRECISION DEFAULT 26.4735,
ADD COLUMN     "longitude" DOUBLE PRECISION DEFAULT 80.3075;

-- CreateTable
CREATE TABLE "EmergencyRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "garageId" TEXT,
    "assignedMechanicId" TEXT,
    "category" "EmergencyCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "EmergencyStatus" NOT NULL DEFAULT 'REQUESTED',
    "pickupLatitude" DOUBLE PRECISION NOT NULL,
    "pickupLongitude" DOUBLE PRECISION NOT NULL,
    "pickupAddress" TEXT NOT NULL,
    "mechanicLatitude" DOUBLE PRECISION,
    "mechanicLongitude" DOUBLE PRECISION,
    "mechanicLocationUpdatedAt" TIMESTAMP(3),
    "searchRadiusKm" DOUBLE PRECISION NOT NULL DEFAULT 15.0,
    "estimatedDistanceKm" DOUBLE PRECISION,
    "estimatedDurationMinutes" INTEGER,
    "baseChargePaise" INTEGER NOT NULL DEFAULT 49900,
    "totalPaidPaise" INTEGER NOT NULL DEFAULT 0,
    "acceptedAt" TIMESTAMP(3),
    "enRouteAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "interventionReason" TEXT,
    "declinedMechanicIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyAssignmentHistory" (
    "id" TEXT NOT NULL,
    "emergencyRequestId" TEXT NOT NULL,
    "mechanicId" TEXT NOT NULL,
    "garageId" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmergencyAssignmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyStatusHistory" (
    "id" TEXT NOT NULL,
    "emergencyRequestId" TEXT NOT NULL,
    "fromStatus" "EmergencyStatus",
    "toStatus" "EmergencyStatus" NOT NULL,
    "actorId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmergencyStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyRequest_requestNumber_key" ON "EmergencyRequest"("requestNumber");

-- CreateIndex
CREATE INDEX "EmergencyRequest_status_idx" ON "EmergencyRequest"("status");

-- CreateIndex
CREATE INDEX "EmergencyRequest_customerId_idx" ON "EmergencyRequest"("customerId");

-- CreateIndex
CREATE INDEX "EmergencyRequest_assignedMechanicId_idx" ON "EmergencyRequest"("assignedMechanicId");

-- CreateIndex
CREATE INDEX "EmergencyRequest_garageId_idx" ON "EmergencyRequest"("garageId");

-- CreateIndex
CREATE INDEX "EmergencyRequest_createdAt_idx" ON "EmergencyRequest"("createdAt");

-- CreateIndex
CREATE INDEX "EmergencyAssignmentHistory_emergencyRequestId_idx" ON "EmergencyAssignmentHistory"("emergencyRequestId");

-- CreateIndex
CREATE INDEX "EmergencyAssignmentHistory_mechanicId_idx" ON "EmergencyAssignmentHistory"("mechanicId");

-- CreateIndex
CREATE INDEX "EmergencyAssignmentHistory_createdAt_idx" ON "EmergencyAssignmentHistory"("createdAt");

-- CreateIndex
CREATE INDEX "EmergencyStatusHistory_emergencyRequestId_idx" ON "EmergencyStatusHistory"("emergencyRequestId");

-- CreateIndex
CREATE INDEX "EmergencyStatusHistory_createdAt_idx" ON "EmergencyStatusHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "EmergencyRequest" ADD CONSTRAINT "EmergencyRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyRequest" ADD CONSTRAINT "EmergencyRequest_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyRequest" ADD CONSTRAINT "EmergencyRequest_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyRequest" ADD CONSTRAINT "EmergencyRequest_assignedMechanicId_fkey" FOREIGN KEY ("assignedMechanicId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyAssignmentHistory" ADD CONSTRAINT "EmergencyAssignmentHistory_emergencyRequestId_fkey" FOREIGN KEY ("emergencyRequestId") REFERENCES "EmergencyRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyStatusHistory" ADD CONSTRAINT "EmergencyStatusHistory_emergencyRequestId_fkey" FOREIGN KEY ("emergencyRequestId") REFERENCES "EmergencyRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
