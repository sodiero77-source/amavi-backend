-- CreateTable
CREATE TABLE "TreatmentCalendarSession" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "treatmentPlanId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "sessionTopic" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreatmentCalendarSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalNoteDraftGeneration" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "treatmentPlanId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "treatmentCalendarSessionId" TEXT,
    "serviceType" TEXT NOT NULL,
    "sessionTopic" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "promptInput" JSONB NOT NULL,
    "generatedOutput" JSONB NOT NULL,
    "regenerationCount" INTEGER NOT NULL DEFAULT 0,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalNoteDraftGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteGenerationAuditLog" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "generationId" TEXT,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteGenerationAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TreatmentCalendarSession_facilityId_residentId_scheduledFor_idx" ON "TreatmentCalendarSession"("facilityId", "residentId", "scheduledFor");

-- CreateIndex
CREATE INDEX "TreatmentCalendarSession_treatmentPlanId_idx" ON "TreatmentCalendarSession"("treatmentPlanId");

-- CreateIndex
CREATE INDEX "TreatmentCalendarSession_problemId_goalId_objectiveId_idx" ON "TreatmentCalendarSession"("problemId", "goalId", "objectiveId");

-- CreateIndex
CREATE INDEX "ClinicalNoteDraftGeneration_facilityId_residentId_createdAt_idx" ON "ClinicalNoteDraftGeneration"("facilityId", "residentId", "createdAt");

-- CreateIndex
CREATE INDEX "ClinicalNoteDraftGeneration_treatmentPlanId_idx" ON "ClinicalNoteDraftGeneration"("treatmentPlanId");

-- CreateIndex
CREATE INDEX "ClinicalNoteDraftGeneration_problemId_goalId_objectiveId_idx" ON "ClinicalNoteDraftGeneration"("problemId", "goalId", "objectiveId");

-- CreateIndex
CREATE INDEX "NoteGenerationAuditLog_facilityId_residentId_createdAt_idx" ON "NoteGenerationAuditLog"("facilityId", "residentId", "createdAt");

-- CreateIndex
CREATE INDEX "NoteGenerationAuditLog_generationId_idx" ON "NoteGenerationAuditLog"("generationId");

-- AddForeignKey
ALTER TABLE "TreatmentCalendarSession" ADD CONSTRAINT "TreatmentCalendarSession_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentCalendarSession" ADD CONSTRAINT "TreatmentCalendarSession_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentCalendarSession" ADD CONSTRAINT "TreatmentCalendarSession_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlanV2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentCalendarSession" ADD CONSTRAINT "TreatmentCalendarSession_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "TreatmentPlanProblem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentCalendarSession" ADD CONSTRAINT "TreatmentCalendarSession_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "TreatmentPlanGoal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentCalendarSession" ADD CONSTRAINT "TreatmentCalendarSession_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "TreatmentPlanObjective"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNoteDraftGeneration" ADD CONSTRAINT "ClinicalNoteDraftGeneration_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNoteDraftGeneration" ADD CONSTRAINT "ClinicalNoteDraftGeneration_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNoteDraftGeneration" ADD CONSTRAINT "ClinicalNoteDraftGeneration_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlanV2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNoteDraftGeneration" ADD CONSTRAINT "ClinicalNoteDraftGeneration_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "TreatmentPlanProblem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNoteDraftGeneration" ADD CONSTRAINT "ClinicalNoteDraftGeneration_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "TreatmentPlanGoal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNoteDraftGeneration" ADD CONSTRAINT "ClinicalNoteDraftGeneration_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "TreatmentPlanObjective"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNoteDraftGeneration" ADD CONSTRAINT "ClinicalNoteDraftGeneration_treatmentCalendarSessionId_fkey" FOREIGN KEY ("treatmentCalendarSessionId") REFERENCES "TreatmentCalendarSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteGenerationAuditLog" ADD CONSTRAINT "NoteGenerationAuditLog_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteGenerationAuditLog" ADD CONSTRAINT "NoteGenerationAuditLog_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteGenerationAuditLog" ADD CONSTRAINT "NoteGenerationAuditLog_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "ClinicalNoteDraftGeneration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
