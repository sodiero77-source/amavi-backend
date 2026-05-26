-- CreateTable
CREATE TABLE "FacilitySettings" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "providerNpiOrTaxNumber" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "logoUrl" TEXT,
    "programType" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL,
    "shifts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "servicesProvided" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "levelsOfFunctioning" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "urgentNotificationEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "residentAttendanceOptions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "clientLabel" TEXT NOT NULL,
    "residentReportLabel" TEXT NOT NULL,
    "governingBodyLabel" TEXT NOT NULL,
    "residentIdLabel" TEXT NOT NULL,
    "secondaryResidentIdLabel" TEXT,
    "serviceCoordinatorLabel" TEXT NOT NULL,
    "evaluatorLeadLabel" TEXT NOT NULL,
    "goalsLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilitySettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FacilitySettings_facilityId_key" ON "FacilitySettings"("facilityId");

-- AddForeignKey
ALTER TABLE "FacilitySettings" ADD CONSTRAINT "FacilitySettings_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
