-- CreateEnum
CREATE TYPE "TreatmentPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'UNDER_REVIEW', 'CLOSED');

-- CreateEnum
CREATE TYPE "ObjectiveStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'MET', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "ProgressIndicator" AS ENUM ('PROGRESSING', 'MAINTAINING', 'REGRESSING', 'NOT_ADDRESSED');

-- CreateTable
CREATE TABLE "TreatmentPlanV2" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "status" "TreatmentPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreatmentPlanV2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentPlanProblem" (
    "id" TEXT NOT NULL,
    "treatmentPlanId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreatmentPlanProblem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentPlanGoal" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreatmentPlanGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentPlanObjective" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ObjectiveStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "targetDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreatmentPlanObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalNoteTreatmentPlanLink" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "progressIndicator" "ProgressIndicator" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalNoteTreatmentPlanLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalNoteSignature" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "signedById" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalNoteSignature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TreatmentPlanV2_facilityId_idx" ON "TreatmentPlanV2"("facilityId");

-- CreateIndex
CREATE INDEX "TreatmentPlanV2_residentId_idx" ON "TreatmentPlanV2"("residentId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalNoteTreatmentPlanLink_noteId_objectiveId_key" ON "ClinicalNoteTreatmentPlanLink"("noteId", "objectiveId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalNoteSignature_noteId_key" ON "ClinicalNoteSignature"("noteId");

-- AddForeignKey
ALTER TABLE "TreatmentPlanV2" ADD CONSTRAINT "TreatmentPlanV2_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlanV2" ADD CONSTRAINT "TreatmentPlanV2_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlanProblem" ADD CONSTRAINT "TreatmentPlanProblem_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlanV2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlanGoal" ADD CONSTRAINT "TreatmentPlanGoal_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "TreatmentPlanProblem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlanObjective" ADD CONSTRAINT "TreatmentPlanObjective_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "TreatmentPlanGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNoteTreatmentPlanLink" ADD CONSTRAINT "ClinicalNoteTreatmentPlanLink_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "ClinicalNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNoteTreatmentPlanLink" ADD CONSTRAINT "ClinicalNoteTreatmentPlanLink_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "TreatmentPlanObjective"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNoteSignature" ADD CONSTRAINT "ClinicalNoteSignature_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "ClinicalNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
