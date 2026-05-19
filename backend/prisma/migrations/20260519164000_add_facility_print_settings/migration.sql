-- CreateTable
CREATE TABLE "FacilityPrintSettings" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "facilityLegalName" TEXT,
    "dbaName" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "licenseNumber" TEXT,
    "logoUrl" TEXT,
    "footerDisclaimer" TEXT,
    "printedNoteTitle" TEXT NOT NULL DEFAULT 'Clinical Note Draft',
    "showAiDraftDisclaimerOnPrintedDrafts" BOOLEAN NOT NULL DEFAULT true,
    "showStaffCredentials" BOOLEAN NOT NULL DEFAULT true,
    "showTreatmentPlanLinkageSection" BOOLEAN NOT NULL DEFAULT true,
    "showAuditMetadataSection" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilityPrintSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FacilityPrintSettings_facilityId_key" ON "FacilityPrintSettings"("facilityId");

-- AddForeignKey
ALTER TABLE "FacilityPrintSettings" ADD CONSTRAINT "FacilityPrintSettings_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
