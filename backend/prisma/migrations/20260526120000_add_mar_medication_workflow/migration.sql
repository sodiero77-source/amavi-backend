-- CreateEnum
CREATE TYPE "MedicationScheduleType" AS ENUM ('SCHEDULED', 'PRN');

-- CreateEnum
CREATE TYPE "MedicationAdministrationStatus" AS ENUM ('ADMINISTERED', 'REFUSED', 'MISSED', 'HELD', 'OUT_OF_MEDICATION', 'MEDICATION_ERROR');

-- CreateTable
CREATE TABLE "MedicationSchedule" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "medicationOrderId" TEXT NOT NULL,
    "type" "MedicationScheduleType" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledTime" TEXT,
    "scheduledDays" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "instructions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicationSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicationAdministration" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "medicationOrderId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "administrationDate" TIMESTAMP(3) NOT NULL,
    "status" "MedicationAdministrationStatus" NOT NULL,
    "administeredAt" TIMESTAMP(3),
    "administeredById" TEXT NOT NULL,
    "administeredByInitials" TEXT NOT NULL,
    "notes" TEXT,
    "reason" TEXT,
    "prnIndication" TEXT,
    "prnFollowUpAt" TIMESTAMP(3),
    "prnEffectiveness" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicationAdministration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MedicationOrder_facilityId_residentId_idx" ON "MedicationOrder"("facilityId", "residentId");

-- CreateIndex
CREATE INDEX "MedicationSchedule_facilityId_residentId_isActive_idx" ON "MedicationSchedule"("facilityId", "residentId", "isActive");

-- CreateIndex
CREATE INDEX "MedicationSchedule_medicationOrderId_idx" ON "MedicationSchedule"("medicationOrderId");

-- CreateIndex
CREATE INDEX "MedicationAdministration_facilityId_residentId_administrationDate_idx" ON "MedicationAdministration"("facilityId", "residentId", "administrationDate");

-- CreateIndex
CREATE INDEX "MedicationAdministration_medicationOrderId_idx" ON "MedicationAdministration"("medicationOrderId");

-- CreateIndex
CREATE INDEX "MedicationAdministration_scheduleId_idx" ON "MedicationAdministration"("scheduleId");

-- AddForeignKey
ALTER TABLE "MedicationSchedule" ADD CONSTRAINT "MedicationSchedule_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationSchedule" ADD CONSTRAINT "MedicationSchedule_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationSchedule" ADD CONSTRAINT "MedicationSchedule_medicationOrderId_fkey" FOREIGN KEY ("medicationOrderId") REFERENCES "MedicationOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationAdministration" ADD CONSTRAINT "MedicationAdministration_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationAdministration" ADD CONSTRAINT "MedicationAdministration_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationAdministration" ADD CONSTRAINT "MedicationAdministration_medicationOrderId_fkey" FOREIGN KEY ("medicationOrderId") REFERENCES "MedicationOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationAdministration" ADD CONSTRAINT "MedicationAdministration_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "MedicationSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
