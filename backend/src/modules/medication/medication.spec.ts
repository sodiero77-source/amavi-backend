import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  MedicationAdministrationStatus,
  MedicationScheduleType,
} from "@prisma/client";
import { strict as assert } from "node:assert";
import { describe, it, mock } from "node:test";
import { RequestActorContext } from "../../common/auth/request-context.interface";
import {
  MedicationAdministrationsController,
  MedicationController,
} from "./medication.controller";
import { MedicationService } from "./medication.service";

const fn = () => mock.fn<(...args: any[]) => any>();

const actor: RequestActorContext = {
  actorId: "user-1",
  actorRole: "MEDTECH",
  facilityId: "facility-1",
  requestId: "request-1",
};

const order = {
  id: "order-1",
  facilityId: actor.facilityId,
  residentId: "resident-1",
};

const scheduledSchedule = {
  id: "schedule-1",
  facilityId: actor.facilityId,
  residentId: order.residentId,
  medicationOrderId: order.id,
  type: MedicationScheduleType.SCHEDULED,
  isActive: true,
};

function createService(prismaOverrides: Record<string, any> = {}) {
  const prisma = {
    resident: {
      findFirst: fn(),
    },
    medicationOrder: {
      create: fn(),
      findFirst: fn(),
      findMany: fn(),
    },
    medicationSchedule: {
      create: fn(),
      findFirst: fn(),
      findMany: fn(),
    },
    medicationAdministration: {
      create: fn(),
      findMany: fn(),
    },
    ...prismaOverrides,
  };
  const eventBus = {
    publish: fn(),
  };

  return {
    prisma,
    eventBus,
    service: new MedicationService(prisma as any, eventBus as any),
  };
}

function administeredDto(overrides: Record<string, unknown> = {}) {
  return {
    residentId: order.residentId,
    medicationOrderId: order.id,
    scheduleId: scheduledSchedule.id,
    administrationDate: "2026-05-26T08:00:00.000Z",
    status: MedicationAdministrationStatus.ADMINISTERED,
    administeredAt: "2026-05-26T08:05:00.000Z",
    administeredByInitials: "AB",
    ...overrides,
  };
}

describe("MedicationService MAR workflow", () => {
  it("creates a schedule using the actor facility scope", async () => {
    const createdSchedule = {
      ...scheduledSchedule,
      createdById: actor.actorId,
      scheduledTime: "08:00",
    };
    const { prisma, eventBus, service } = createService();
    prisma.medicationOrder.findFirst.mock.mockImplementationOnce(async () => order);
    prisma.medicationSchedule.create.mock.mockImplementationOnce(
      async () => createdSchedule,
    );

    const result = await service.createSchedule(actor, order.id, {
      type: MedicationScheduleType.SCHEDULED,
      scheduledTime: "08:00",
      scheduledDays: ["MON", "TUE"],
    });

    assert.equal(result, createdSchedule);
    assert.deepEqual(prisma.medicationOrder.findFirst.mock.calls[0].arguments[0], {
      where: {
        id: order.id,
        facilityId: actor.facilityId,
      },
    });
    assert.equal(
      prisma.medicationSchedule.create.mock.calls[0].arguments[0].data.facilityId,
      actor.facilityId,
    );
    assert.equal(
      prisma.medicationSchedule.create.mock.calls[0].arguments[0].data.createdById,
      actor.actorId,
    );
    assert.equal(
      eventBus.publish.mock.calls[0].arguments[0].name,
      "MedicationScheduleCreated",
    );
  });

  it("records an administered medication with actor context", async () => {
    const createdAdministration = {
      id: "administration-1",
      ...administeredDto(),
      facilityId: actor.facilityId,
      administeredById: actor.actorId,
    };
    const { prisma, eventBus, service } = createService();
    prisma.medicationOrder.findFirst.mock.mockImplementationOnce(async () => order);
    prisma.medicationSchedule.findFirst.mock.mockImplementationOnce(
      async () => scheduledSchedule,
    );
    prisma.medicationAdministration.create.mock.mockImplementationOnce(
      async () => createdAdministration,
    );

    const result = await service.recordAdministration(actor, administeredDto());

    assert.equal(result, createdAdministration);
    assert.deepEqual(prisma.medicationOrder.findFirst.mock.calls[0].arguments[0], {
      where: {
        id: order.id,
        residentId: order.residentId,
        facilityId: actor.facilityId,
      },
    });
    assert.equal(
      prisma.medicationAdministration.create.mock.calls[0].arguments[0].data
        .facilityId,
      actor.facilityId,
    );
    assert.equal(
      prisma.medicationAdministration.create.mock.calls[0].arguments[0].data
        .administeredById,
      actor.actorId,
    );
    assert.equal(
      eventBus.publish.mock.calls[0].arguments[0].name,
      "MedicationAdministrationRecorded",
    );
  });

  it("requires reason or notes for exception statuses", async () => {
    const { service } = createService();

    for (const status of [
      MedicationAdministrationStatus.REFUSED,
      MedicationAdministrationStatus.MISSED,
      MedicationAdministrationStatus.HELD,
      MedicationAdministrationStatus.OUT_OF_MEDICATION,
      MedicationAdministrationStatus.MEDICATION_ERROR,
    ]) {
      await assert.rejects(
        () =>
          service.recordAdministration(
            actor,
            administeredDto({
              status,
              administeredAt: undefined,
            }),
          ),
        BadRequestException,
      );
    }
  });

  it("requires indication, follow-up time, and effectiveness for PRN administrations", async () => {
    const prnSchedule = {
      ...scheduledSchedule,
      type: MedicationScheduleType.PRN,
    };
    const { prisma, service } = createService();
    prisma.medicationOrder.findFirst.mock.mockImplementation(async () => order);
    prisma.medicationSchedule.findFirst.mock.mockImplementation(
      async () => prnSchedule,
    );

    await assert.rejects(
      () => service.recordAdministration(actor, administeredDto()),
      BadRequestException,
    );

    await assert.rejects(
      () =>
        service.recordAdministration(
          actor,
          administeredDto({
            prnIndication: "Pain",
            prnFollowUpAt: "2026-05-26T09:00:00.000Z",
          }),
        ),
      BadRequestException,
    );

    await assert.rejects(
      () =>
        service.recordAdministration(
          actor,
          administeredDto({
            prnIndication: "Pain",
            prnEffectiveness: "Effective",
          }),
        ),
      BadRequestException,
    );
  });

  it("rejects cross-facility order and schedule use", async () => {
    const { prisma, service } = createService();
    prisma.medicationOrder.findFirst.mock.mockImplementationOnce(async () => null);

    await assert.rejects(
      () => service.createSchedule(actor, "foreign-order", {
        type: MedicationScheduleType.SCHEDULED,
        scheduledTime: "08:00",
      }),
      NotFoundException,
    );

    prisma.medicationOrder.findFirst.mock.mockImplementationOnce(async () => order);
    prisma.medicationSchedule.findFirst.mock.mockImplementationOnce(async () => null);

    await assert.rejects(
      () => service.recordAdministration(actor, administeredDto()),
      NotFoundException,
    );
  });
});

describe("Medication controllers", () => {
  it("passes actor context when creating schedules and recording administrations", () => {
    const service = {
      createOrder: fn(),
      list: fn(),
      createSchedule: fn(),
      listSchedules: fn(),
      recordAdministration: fn(),
      listAdministrations: fn(),
    };
    const medicationController = new MedicationController(service as any);
    const administrationsController = new MedicationAdministrationsController(
      service as any,
    );
    const request = { actorContext: actor };
    const scheduleDto = {
      type: MedicationScheduleType.SCHEDULED,
      scheduledTime: "08:00",
    };
    const administrationDto = administeredDto();

    medicationController.createSchedule(request, order.id, scheduleDto);
    administrationsController.record(request, administrationDto);

    assert.deepEqual(service.createSchedule.mock.calls[0].arguments, [
      actor,
      order.id,
      scheduleDto,
    ]);
    assert.deepEqual(service.recordAdministration.mock.calls[0].arguments, [
      actor,
      administrationDto,
    ]);
  });
});
