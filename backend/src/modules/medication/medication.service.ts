import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  MedicationAdministrationStatus,
  MedicationScheduleType,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../../common/db/prisma.service";
import { EventBusService } from "../../common/events/event-bus.service";
import { RequestActorContext } from "../../common/auth/request-context.interface";
import {
  CreateMedicationOrderDto,
  CreateMedicationScheduleDto,
  ListMedicationAdministrationsQueryDto,
  RecordMedicationAdministrationDto,
} from "./dto";

const EXCEPTION_STATUSES: MedicationAdministrationStatus[] = [
  MedicationAdministrationStatus.REFUSED,
  MedicationAdministrationStatus.MISSED,
  MedicationAdministrationStatus.HELD,
  MedicationAdministrationStatus.OUT_OF_MEDICATION,
  MedicationAdministrationStatus.MEDICATION_ERROR,
];

@Injectable()
export class MedicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async createOrder(actor: RequestActorContext, dto: CreateMedicationOrderDto) {
    const resident = await this.prisma.resident.findFirst({
      where: { id: dto.residentId, facilityId: actor.facilityId },
    });

    if (!resident) {
      throw new NotFoundException("Resident not found");
    }

    const order = await this.prisma.medicationOrder.create({
      data: {
        facilityId: actor.facilityId,
        residentId: dto.residentId,
        medicationName: dto.medicationName,
        dose: dto.dose,
        route: dto.route,
        frequency: dto.frequency,
        createdById: actor.actorId,
      },
    });

    this.eventBus.publish({
      name: "MedicationOrderCreated",
      occurredAt: new Date().toISOString(),
      payload: {
        orderId: order.id,
        residentId: dto.residentId,
        actorId: actor.actorId,
      },
    });

    return order;
  }

  async list(actor: RequestActorContext) {
    return this.prisma.medicationOrder.findMany({
      where: { facilityId: actor.facilityId },
      include: {
        schedules: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async createSchedule(
    actor: RequestActorContext,
    medicationOrderId: string,
    dto: CreateMedicationScheduleDto,
  ) {
    const order = await this.getOrderInFacility(actor, medicationOrderId);
    const type = dto.type ?? MedicationScheduleType.SCHEDULED;

    if (type === MedicationScheduleType.SCHEDULED && !dto.scheduledTime) {
      throw new BadRequestException(
        "scheduledTime is required for scheduled medications",
      );
    }

    const schedule = await this.prisma.medicationSchedule.create({
      data: {
        facilityId: actor.facilityId,
        residentId: order.residentId,
        medicationOrderId: order.id,
        type,
        scheduledTime: dto.scheduledTime,
        scheduledDays: dto.scheduledDays ?? [],
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        instructions: dto.instructions,
        createdById: actor.actorId,
      },
    });

    this.eventBus.publish({
      name: "MedicationScheduleCreated",
      occurredAt: new Date().toISOString(),
      payload: {
        scheduleId: schedule.id,
        orderId: order.id,
        residentId: order.residentId,
        actorId: actor.actorId,
      },
    });

    return schedule;
  }

  async listSchedules(actor: RequestActorContext, medicationOrderId: string) {
    await this.getOrderInFacility(actor, medicationOrderId);

    return this.prisma.medicationSchedule.findMany({
      where: {
        facilityId: actor.facilityId,
        medicationOrderId,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async recordAdministration(
    actor: RequestActorContext,
    dto: RecordMedicationAdministrationDto,
  ) {
    this.validateAdministrationDto(dto);

    const order = await this.prisma.medicationOrder.findFirst({
      where: {
        id: dto.medicationOrderId,
        residentId: dto.residentId,
        facilityId: actor.facilityId,
      },
    });

    if (!order) {
      throw new NotFoundException(
        "Medication order not found in this facility",
      );
    }

    const schedule = dto.scheduleId
      ? await this.prisma.medicationSchedule.findFirst({
          where: {
            id: dto.scheduleId,
            facilityId: actor.facilityId,
            residentId: dto.residentId,
            medicationOrderId: dto.medicationOrderId,
            isActive: true,
          },
        })
      : null;

    if (dto.scheduleId && !schedule) {
      throw new NotFoundException(
        "Medication schedule not found in this facility",
      );
    }

    const isPrn =
      schedule?.type === MedicationScheduleType.PRN || !dto.scheduleId;
    if (isPrn) {
      this.validatePrnFields(dto);
    }

    const administration = await this.prisma.medicationAdministration.create({
      data: {
        facilityId: actor.facilityId,
        residentId: dto.residentId,
        medicationOrderId: dto.medicationOrderId,
        scheduleId: dto.scheduleId,
        administrationDate: new Date(dto.administrationDate),
        status: dto.status,
        administeredAt: dto.administeredAt
          ? new Date(dto.administeredAt)
          : null,
        administeredById: actor.actorId,
        administeredByInitials: dto.administeredByInitials,
        notes: dto.notes,
        reason: dto.reason,
        prnIndication: dto.prnIndication,
        prnFollowUpAt: dto.prnFollowUpAt ? new Date(dto.prnFollowUpAt) : null,
        prnEffectiveness: dto.prnEffectiveness,
      },
    });

    this.eventBus.publish({
      name: "MedicationAdministrationRecorded",
      occurredAt: new Date().toISOString(),
      payload: {
        administrationId: administration.id,
        orderId: order.id,
        scheduleId: administration.scheduleId,
        residentId: administration.residentId,
        status: administration.status,
        actorId: actor.actorId,
      },
    });

    return administration;
  }

  async listAdministrations(
    actor: RequestActorContext,
    query: ListMedicationAdministrationsQueryDto,
  ) {
    const where: Prisma.MedicationAdministrationWhereInput = {
      facilityId: actor.facilityId,
      ...(query.residentId && { residentId: query.residentId }),
      ...(query.medicationOrderId && {
        medicationOrderId: query.medicationOrderId,
      }),
      ...((query.fromDate || query.toDate) && {
        administrationDate: {
          ...(query.fromDate && { gte: new Date(query.fromDate) }),
          ...(query.toDate && { lte: new Date(query.toDate) }),
        },
      }),
    };

    return this.prisma.medicationAdministration.findMany({
      where,
      include: {
        medicationOrder: true,
        schedule: true,
      },
      orderBy: { administrationDate: "desc" },
    });
  }

  private async getOrderInFacility(
    actor: RequestActorContext,
    medicationOrderId: string,
  ) {
    const order = await this.prisma.medicationOrder.findFirst({
      where: {
        id: medicationOrderId,
        facilityId: actor.facilityId,
      },
    });

    if (!order) {
      throw new NotFoundException(
        "Medication order not found in this facility",
      );
    }

    return order;
  }

  private validateAdministrationDto(
    dto: RecordMedicationAdministrationDto,
  ): void {
    if (
      EXCEPTION_STATUSES.includes(dto.status) &&
      !this.hasText(dto.reason) &&
      !this.hasText(dto.notes)
    ) {
      throw new BadRequestException(
        "notes or reason is required for exception medication administration statuses",
      );
    }

    if (
      dto.status === MedicationAdministrationStatus.ADMINISTERED &&
      !dto.administeredAt
    ) {
      throw new BadRequestException(
        "administeredAt is required when status is ADMINISTERED",
      );
    }
  }

  private validatePrnFields(dto: RecordMedicationAdministrationDto): void {
    if (!this.hasText(dto.prnIndication)) {
      throw new BadRequestException(
        "prnIndication is required for PRN administrations",
      );
    }

    if (!dto.prnFollowUpAt || !this.hasText(dto.prnEffectiveness)) {
      throw new BadRequestException(
        "prnFollowUpAt and prnEffectiveness are required for PRN administrations",
      );
    }
  }

  private hasText(value?: string): boolean {
    return Boolean(value?.trim());
  }
}
