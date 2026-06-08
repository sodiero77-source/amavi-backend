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

const WEEKDAY_LABELS = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
] as const;
import {
  CreateMedicationOrderDto,
  GetMedicationDueQueryDto,
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

    if (dto.startDate && dto.endDate) {
      const startDate = new Date(dto.startDate);
      const endDate = new Date(dto.endDate);
      if (startDate.getTime() > endDate.getTime()) {
        throw new BadRequestException(
          "startDate must be on or before endDate",
        );
      }
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

    if (
      schedule?.type === MedicationScheduleType.SCHEDULED &&
      dto.scheduleId &&
      dto.administrationDate
    ) {
      const administrationDate = new Date(dto.administrationDate);
      const dayStart = this.atMidnight(administrationDate);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
      const existingAdministration = await this.prisma.medicationAdministration.findFirst({
        where: {
          facilityId: actor.facilityId,
          scheduleId: dto.scheduleId,
          administrationDate: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
      });

      if (existingAdministration) {
        throw new BadRequestException(
          "A scheduled medication administration for this schedule already exists for the selected day",
        );
      }
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

  async getDueFeed(
    actor: RequestActorContext,
    query: GetMedicationDueQueryDto,
    nowDate: Date = new Date(Date.now()),
  ) {
    const date = query.date
      ? new Date(`${query.date}T00:00:00`)
      : this.atMidnight(nowDate);
    const todayString = this.formatDate(nowDate);
    const queryDateString = this.formatDate(date);
    const isToday = todayString === queryDateString;
    const startOfDay = this.atMidnight(date);
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
    const now = isToday ? nowDate : null;

    const schedules = await this.prisma.medicationSchedule.findMany({
      where: {
        facilityId: actor.facilityId,
        isActive: true,
        ...(query.residentId && { residentId: query.residentId }),
        AND: [
          {
            OR: [
              { startDate: null },
              { startDate: { lte: date } },
            ],
          },
          {
            OR: [
              { endDate: null },
              { endDate: { gte: date } },
            ],
          },
        ],
      },
      include: {
        medicationOrder: true,
        resident: true,
        administrations: {
          where: {
            facilityId: actor.facilityId,
            administrationDate: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
          orderBy: { administrationDate: "desc" },
        },
      },
    });

    const dueItems = [] as Array<{
      medicationOrderId: string;
      scheduleId: string | null;
      residentId: string;
      residentName: string;
      medicationName: string;
      dose: string;
      route: string;
      scheduledTime: string | null;
      scheduledDays: string[];
      instructions: string | null;
      priority: "OVERDUE" | "DUE_NOW" | "DUE_SOON" | "TODAY";
      administrationStatus: string;
      canAdminister: boolean;
      isDuplicateBlocked: boolean;
      date: string;
    }>;

    let scheduledCount = 0;
    let administeredCount = 0;
    let refusedCount = 0;
    let missedCount = 0;

    for (const schedule of schedules) {
      const scheduleAdministrations = schedule.administrations ?? [];
      const hasDuplicateAdministration = scheduleAdministrations.some(
        (administration) => administration.scheduleId === schedule.id,
      );

      if (schedule.type === MedicationScheduleType.SCHEDULED) {
        if (!this.doesScheduleApplyOnDate(schedule, date)) {
          continue;
        }

        scheduledCount += 1;
      }

      for (const administration of scheduleAdministrations) {
        if (administration.status === MedicationAdministrationStatus.ADMINISTERED) {
          administeredCount += 1;
        }
        if (administration.status === MedicationAdministrationStatus.REFUSED) {
          refusedCount += 1;
        }
        if (administration.status === MedicationAdministrationStatus.MISSED) {
          missedCount += 1;
        }
      }

      if (schedule.type === MedicationScheduleType.SCHEDULED && hasDuplicateAdministration) {
        continue;
      }

      const priority = this.computePriority(
        schedule,
        date,
        now,
        isToday,
        nowDate,
      );

      if (!priority) {
        continue;
      }

      const residentName = [
        schedule.resident?.firstName,
        schedule.resident?.lastName,
      ]
        .filter(Boolean)
        .join(" ");

      dueItems.push({
        medicationOrderId: schedule.medicationOrderId,
        scheduleId: schedule.id,
        residentId: schedule.residentId,
        residentName,
        medicationName: schedule.medicationOrder.medicationName,
        dose: schedule.medicationOrder.dose,
        route: schedule.medicationOrder.route,
        scheduledTime: schedule.scheduledTime ?? null,
        scheduledDays: schedule.scheduledDays ?? [],
        instructions: schedule.instructions,
        priority,
        administrationStatus: "PENDING",
        canAdminister: true,
        isDuplicateBlocked: false,
        date: queryDateString,
      });
    }

    const buckets = {
      overdue: dueItems.filter((item) => item.priority === "OVERDUE"),
      dueNow: dueItems.filter((item) => item.priority === "DUE_NOW"),
      dueToday: dueItems.filter(
        (item) => item.priority === "DUE_SOON" || item.priority === "TODAY",
      ),
    };

    const response: any = {
      buckets,
    };

    if (query.view === "supervisor") {
      response.medPassSummary = {
        scheduled: scheduledCount,
        administered: administeredCount,
        refused: refusedCount,
        missed: missedCount,
        pending: Math.max(
          0,
          scheduledCount - administeredCount - refusedCount - missedCount,
        ),
      };
    }

    return response;
  }

  private doesScheduleApplyOnDate(
    schedule: { scheduledDays?: string[] },
    date: Date,
  ) {
    if (!schedule.scheduledDays?.length) {
      return true;
    }

    const weekdayKey = WEEKDAY_LABELS[date.getDay()];
    return schedule.scheduledDays.includes(weekdayKey);
  }

  private computePriority(
    schedule: { type: MedicationScheduleType; scheduledTime?: string | null },
    date: Date,
    now: Date | null,
    isToday: boolean,
    nowDate: Date,
  ): "OVERDUE" | "DUE_NOW" | "DUE_SOON" | "TODAY" | null {
    if (schedule.type === MedicationScheduleType.PRN) {
      return "TODAY";
    }

    if (!schedule.scheduledTime) {
      return null;
    }

    const scheduledDateTime = this.atDateWithTime(date, schedule.scheduledTime);
    if (!isToday) {
      if (date.getTime() < this.atMidnight(nowDate).getTime()) {
        return "OVERDUE";
      }
      return "TODAY";
    }

    const thirtyMinutesBefore = new Date(scheduledDateTime.getTime() - 30 * 60 * 1000);
    const sixtyMinutesAfter = new Date(scheduledDateTime.getTime() + 60 * 60 * 1000);

    if (!now) {
      return "TODAY";
    }

    if (now > sixtyMinutesAfter) {
      return "OVERDUE";
    }

    if (now >= scheduledDateTime) {
      return "DUE_NOW";
    }

    if (now >= thirtyMinutesBefore) {
      return "DUE_SOON";
    }

    return "TODAY";
  }

  private atMidnight(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private atDateWithTime(date: Date, time: string) {
    const [hours, minutes] = time.split(":").map(Number);
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      hours,
      minutes,
    );
  }

  private formatDate(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0",
    )}-${String(date.getDate()).padStart(2, "0")}`;
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
