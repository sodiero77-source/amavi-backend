import { strict as assert } from "node:assert";
import { describe, it, mock } from "node:test";
import { NotFoundException } from "@nestjs/common";
import { RequestActorContext } from "../../common/auth/request-context.interface";
import { CreateResidentDto, UpdateResidentDto } from "./dto";
import { ResidentsController } from "./residents.controller";
import { ResidentsService } from "./residents.service";

const fn = () => mock.fn<(...args: any[]) => any>();

const actor: RequestActorContext = {
  actorId: "user-1",
  actorRole: "CLINICIAN",
  facilityId: "facility-1",
  requestId: "request-1",
};

function createService(prismaOverrides: Record<string, any> = {}) {
  const prisma = {
    resident: {
      create: fn(),
      findMany: fn(),
      findFirst: fn(),
      updateMany: fn(),
    },
    ...prismaOverrides,
  };

  const eventBus = {
    publish: fn(),
  };

  return {
    prisma,
    eventBus,
    service: new ResidentsService(prisma as any, eventBus as any),
  };
}

describe("ResidentsService", () => {
  it("creates a resident scoped to actor facility", async () => {
    const dto: CreateResidentDto = {
      firstName: "Jane",
      lastName: "Doe",
      dateOfBirth: "1980-01-01",
      admissionDate: "2026-06-07",
    };
    const resident = {
      id: "resident-1",
      facilityId: actor.facilityId,
      ...dto,
      dateOfBirth: new Date(dto.dateOfBirth),
      admissionDate: new Date(dto.admissionDate),
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { prisma, eventBus, service } = createService();
    prisma.resident.create.mock.mockImplementationOnce(async () => resident);

    const result = await service.create(actor, dto);

    assert.equal(result, resident);
    assert.deepEqual(prisma.resident.create.mock.calls[0].arguments[0], {
      data: {
        facilityId: actor.facilityId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        dateOfBirth: new Date(dto.dateOfBirth),
        admissionDate: new Date(dto.admissionDate),
      },
    });
    assert.deepEqual(eventBus.publish.mock.calls[0].arguments[0], {
      name: "ResidentCreated",
      occurredAt: eventBus.publish.mock.calls[0].arguments[0].occurredAt,
      payload: {
        residentId: resident.id,
        facilityId: actor.facilityId,
      },
    });
  });

  it("lists only residents in actor facility", async () => {
    const { prisma, service } = createService();
    prisma.resident.findMany.mock.mockImplementationOnce(async () => [
      { id: "resident-1", facilityId: actor.facilityId },
    ]);

    const result = await service.list(actor);

    assert.deepEqual(result, [{ id: "resident-1", facilityId: actor.facilityId }]);
    assert.deepEqual(prisma.resident.findMany.mock.calls[0].arguments[0], {
      where: { facilityId: actor.facilityId },
      orderBy: { createdAt: "desc" },
    });
  });

  it("rejects getOne when resident is outside actor facility", async () => {
    const { prisma, service } = createService();
    prisma.resident.findFirst.mock.mockImplementationOnce(async () => null);

    await assert.rejects(
      () => service.getOne(actor, "resident-1"),
      NotFoundException,
    );
    assert.deepEqual(prisma.resident.findFirst.mock.calls[0].arguments[0], {
      where: { id: "resident-1", facilityId: actor.facilityId },
    });
  });

  it("rejects update when resident is outside actor facility", async () => {
    const { prisma, service } = createService();
    prisma.resident.updateMany.mock.mockImplementationOnce(async () => ({ count: 0 }));

    await assert.rejects(
      () =>
        service.update(actor, "resident-1", {
          firstName: "Updated",
        }),
      NotFoundException,
    );
    assert.deepEqual(prisma.resident.updateMany.mock.calls[0].arguments[0], {
      where: { id: "resident-1", facilityId: actor.facilityId },
      data: { firstName: "Updated" },
    });
  });

  it("rejects remove when resident is outside actor facility", async () => {
    const { prisma, service } = createService();
    prisma.resident.updateMany.mock.mockImplementationOnce(async () => ({ count: 0 }));

    await assert.rejects(
      () => service.remove(actor, "resident-1"),
      NotFoundException,
    );
    assert.deepEqual(prisma.resident.updateMany.mock.calls[0].arguments[0], {
      where: { id: "resident-1", facilityId: actor.facilityId },
      data: { status: "DISCHARGED" },
    });
  });
});

describe("ResidentsController", () => {
  it("passes actor context to service create", () => {
    const service = {
      create: fn(),
      list: fn(),
      getOne: fn(),
      update: fn(),
      remove: fn(),
    };
    const controller = new ResidentsController(service as any);
    const request = { actorContext: actor };
    const dto: CreateResidentDto = {
      firstName: "Jane",
      lastName: "Doe",
      dateOfBirth: "1980-01-01",
      admissionDate: "2026-06-07",
    };

    controller.create(request, dto);

    assert.deepEqual(service.create.mock.calls[0].arguments, [actor, dto]);
  });
});
