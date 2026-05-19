-- AlterTable
ALTER TABLE "Resident" ADD COLUMN "primaryDiagnosis" TEXT;
ALTER TABLE "Resident" ADD COLUMN "secondaryDiagnoses" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Resident" ADD COLUMN "levelOfCare" TEXT;
ALTER TABLE "Resident" ADD COLUMN "serviceFrequency" TEXT;

-- AlterTable
ALTER TABLE "TreatmentCalendarSession" ADD COLUMN "interventionCategory" TEXT;
ALTER TABLE "TreatmentCalendarSession" ADD COLUMN "expectedProgressFocus" TEXT;
ALTER TABLE "TreatmentCalendarSession" ADD COLUMN "suggestedPrompt" TEXT;
ALTER TABLE "TreatmentCalendarSession" ADD COLUMN "progressionRationale" TEXT;
ALTER TABLE "TreatmentCalendarSession" ADD COLUMN "diagnosisRationale" JSONB;
ALTER TABLE "TreatmentCalendarSession" ADD COLUMN "topicRotationKey" TEXT;
ALTER TABLE "TreatmentCalendarSession" ADD COLUMN "calendarMonth" TEXT;

-- CreateIndex
CREATE INDEX "TreatmentCalendarSession_facilityId_residentId_calendarMonth_idx" ON "TreatmentCalendarSession"("facilityId", "residentId", "calendarMonth");
