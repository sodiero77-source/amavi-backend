import { BadRequestException, NotFoundException } from "@nestjs/common";
import { strict as assert } from "node:assert";
import { describe, it, mock } from "node:test";
import { RequestActorContext } from "../../common/auth/request-context.interface";
import { UpdateFacilitySettingsDto } from "./dto";
import { FacilitySettingsController } from "./facility-settings.controller";
import { FacilitySettingsService } from "./facility-settings.service";

const fn = () => mock.fn<(...args: any[]) => any>();

const actor: RequestActorContext = {
  actorId: "user-1",
  actorRole: "ADMIN",
  facilityId: "facility-1",
  requestId: "request-1",
};

const fullPayload: UpdateFacilitySettingsDto = {
  companyName: "Springs of Joy",
  providerNpiOrTaxNumber: "1234567890",
  email: "admin@springsofjoy.example",
  logoUrl: "https://springsofjoy.example/logo.png",
  programType: "Behavioral Health",
  addressLine1: "123 Main St",
  addressLine2: "Suite 200",
  city: "Phoenix",
  state: "AZ",
  postalCode: "85001",
  timeZone: "America/Phoenix",
  shifts: ["Day", "Evening"],
  servicesProvided: ["Assessment", "Medication Support"],
  levelsOfFunctioning: ["Independent", "Supported"],
  urgentNotificationEmails: ["urgent@springsofjoy.example"],
  residentAttendanceOptions: ["Present", "Absent", "Excused"],
  clientLabel: "Client",
  residentReportLabel: "Resident Report",
  governingBodyLabel: "Governing Body",
  residentIdLabel: "Resident ID",
  secondaryResidentIdLabel: "Medicaid ID",
  serviceCoordinatorLabel: "Service Coordinator",
  evaluatorLeadLabel: "Evaluator Lead",
  goalsLabel: "Goals",
};

function createService(prismaOverrides: Record<string, any> = {}) {
  const prisma = {
    facility: {
      findUnique: fn(),
    },
    facilitySettings: {
      findUnique: fn(),
      create: fn(),
      update: fn(),
    },
    ...prismaOverrides,
  };

  return {
    prisma,
    service: new FacilitySettingsService(prisma as any),
  };
}

describe("FacilitySettingsService", () => {
  it("reads settings only for the actor facility", async () => {
    const existing = {
      id: "settings-1",
      facilityId: actor.facilityId,
      ...fullPayload,
    };
    const { prisma, service } = createService();
    prisma.facility.findUnique.mock.mockImplementationOnce(async () => ({
      id: actor.facilityId,
    }));
    prisma.facilitySettings.findUnique.mock.mockImplementationOnce(
      async () => existing,
    );

    const result = await service.get(actor);

    assert.equal(result, existing);
    assert.deepEqual(prisma.facility.findUnique.mock.calls[0].arguments[0], {
      where: { id: actor.facilityId },
      select: { id: true },
    });
    assert.deepEqual(
      prisma.facilitySettings.findUnique.mock.calls[0].arguments[0],
      { where: { facilityId: actor.facilityId } },
    );
  });

  it("creates settings scoped to the actor facility", async () => {
    const created = {
      id: "settings-1",
      facilityId: actor.facilityId,
      ...fullPayload,
    };
    const { prisma, service } = createService();
    prisma.facility.findUnique.mock.mockImplementationOnce(async () => ({
      id: actor.facilityId,
    }));
    prisma.facilitySettings.findUnique.mock.mockImplementationOnce(
      async () => null,
    );
    prisma.facilitySettings.create.mock.mockImplementationOnce(
      async () => created,
    );

    const result = await service.update(actor, fullPayload);

    assert.equal(result, created);
    assert.equal(
      prisma.facilitySettings.create.mock.calls[0].arguments[0].data.facilityId,
      actor.facilityId,
    );
    assert.equal(
      prisma.facilitySettings.create.mock.calls[0].arguments[0].data.companyName,
      "Springs of Joy",
    );
  });

  it("updates only the actor facility settings", async () => {
    const { prisma, service } = createService();
    prisma.facility.findUnique.mock.mockImplementationOnce(async () => ({
      id: actor.facilityId,
    }));
    prisma.facilitySettings.findUnique.mock.mockImplementationOnce(async () => ({
      id: "settings-1",
      facilityId: actor.facilityId,
    }));
    prisma.facilitySettings.update.mock.mockImplementationOnce(async () => ({
      id: "settings-1",
      facilityId: actor.facilityId,
      companyName: "Springs of Joy Updated",
    }));

    await service.update(actor, {
      companyName: "Springs of Joy Updated",
      shifts: [" Day ", " ", "Night"],
    });

    assert.deepEqual(
      prisma.facilitySettings.update.mock.calls[0].arguments[0].where,
      { facilityId: actor.facilityId },
    );
    assert.deepEqual(
      prisma.facilitySettings.update.mock.calls[0].arguments[0].data.shifts,
      ["Day", "Night"],
    );
  });

  it("requires complete required settings when creating first settings row", async () => {
    const { prisma, service } = createService();
    prisma.facility.findUnique.mock.mockImplementationOnce(async () => ({
      id: actor.facilityId,
    }));
    prisma.facilitySettings.findUnique.mock.mockImplementationOnce(
      async () => null,
    );

    await assert.rejects(
      () => service.update(actor, { companyName: "Springs of Joy" }),
      BadRequestException,
    );
  });

  it("rejects reads or updates when the actor facility does not exist", async () => {
    const { prisma, service } = createService();
    prisma.facility.findUnique.mock.mockImplementation(async () => null);

    await assert.rejects(() => service.get(actor), NotFoundException);
    await assert.rejects(
      () => service.update(actor, fullPayload),
      NotFoundException,
    );
  });
});

describe("FacilitySettingsController", () => {
  it("passes actor context through for reads and updates", () => {
    const service = {
      get: fn(),
      update: fn(),
    };
    const controller = new FacilitySettingsController(service as any);
    const request = { actorContext: actor };

    controller.get(request);
    controller.update(request, fullPayload);

    assert.deepEqual(service.get.mock.calls[0].arguments, [actor]);
    assert.deepEqual(service.update.mock.calls[0].arguments, [
      actor,
      fullPayload,
    ]);
  });
});
