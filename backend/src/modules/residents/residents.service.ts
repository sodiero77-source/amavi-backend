import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { RequestActorContext } from "../../common/auth/request-context.interface";
import { PrismaService } from "../../common/db/prisma.service";
import { EventBusService } from "../../common/events/event-bus.service";
import { CreateResidentDto, UpdateResidentDto } from "./dto";

@Injectable()
export class ResidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(dto: CreateResidentDto) {
    const resident = await this.prisma.resident.create({
      data: {
        facilityId: dto.facilityId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        dateOfBirth: new Date(dto.dateOfBirth),
        admissionDate: new Date(dto.admissionDate),
      },
    });

    this.eventBus.publish({
      name: "ResidentCreated",
      occurredAt: new Date().toISOString(),
      payload: {
        residentId: resident.id,
        facilityId: dto.facilityId,
      },
    });

    return resident;
  }

  async list(actor: RequestActorContext) {
    return this.prisma.resident.findMany({
      where: { facilityId: actor.facilityId },
      orderBy: { createdAt: "desc" },
    });
  }

  async getOne(actor: RequestActorContext, residentId: string) {
    const resident = await this.prisma.resident.findFirst({
      where: { id: residentId, facilityId: actor.facilityId },
    });

    if (!resident) {
      throw new NotFoundException("Resident not found");
    }

    return resident;
  }

  async update(
    actor: RequestActorContext,
    residentId: string,
    dto: UpdateResidentDto,
  ) {
    const data: Prisma.ResidentUpdateManyMutationInput = {
      ...(dto.firstName !== undefined && { firstName: dto.firstName }),
      ...(dto.lastName !== undefined && { lastName: dto.lastName }),
      ...(dto.dob !== undefined && { dateOfBirth: new Date(dto.dob) }),
      ...(dto.status !== undefined && { status: dto.status }),
    };

    const result = await this.prisma.resident.updateMany({
      where: { id: residentId, facilityId: actor.facilityId },
      data,
    });

    if (result.count === 0) {
      throw new NotFoundException("Resident not found");
    }

    return this.prisma.resident.findFirst({
      where: { id: residentId, facilityId: actor.facilityId },
    });
  }

  async remove(actor: RequestActorContext, residentId: string) {
    const result = await this.prisma.resident.updateMany({
      where: { id: residentId, facilityId: actor.facilityId },
      data: { status: "DISCHARGED" },
    });

    if (result.count === 0) {
      throw new NotFoundException("Resident not found");
    }

    return this.prisma.resident.findFirst({
      where: { id: residentId, facilityId: actor.facilityId },
    });
  }
}
