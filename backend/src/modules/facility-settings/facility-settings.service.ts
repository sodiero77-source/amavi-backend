import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { RequestActorContext } from "../../common/auth/request-context.interface";
import { PrismaService } from "../../common/db/prisma.service";
import { UpdateFacilitySettingsDto } from "./dto";

const REQUIRED_SETTINGS_FIELDS = [
  "companyName",
  "providerNpiOrTaxNumber",
  "email",
  "programType",
  "addressLine1",
  "city",
  "state",
  "postalCode",
  "timeZone",
  "clientLabel",
  "residentReportLabel",
  "governingBodyLabel",
  "residentIdLabel",
  "serviceCoordinatorLabel",
  "evaluatorLeadLabel",
  "goalsLabel",
] as const;

const ARRAY_FIELDS = [
  "shifts",
  "servicesProvided",
  "levelsOfFunctioning",
  "urgentNotificationEmails",
  "residentAttendanceOptions",
] as const;

@Injectable()
export class FacilitySettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(actor: RequestActorContext) {
    await this.ensureFacilityExists(actor.facilityId);

    return this.prisma.facilitySettings.findUnique({
      where: { facilityId: actor.facilityId },
    });
  }

  async update(actor: RequestActorContext, dto: UpdateFacilitySettingsDto) {
    await this.ensureFacilityExists(actor.facilityId);

    const existing = await this.prisma.facilitySettings.findUnique({
      where: { facilityId: actor.facilityId },
    });
    const data = this.buildData(dto);

    if (!existing) {
      this.validateCreatePayload(dto);
      const createData: Prisma.FacilitySettingsUncheckedCreateInput = {
        ...(data as Prisma.FacilitySettingsUncheckedCreateInput),
        facilityId: actor.facilityId,
      };

      return this.prisma.facilitySettings.create({
        data: createData,
      });
    }

    return this.prisma.facilitySettings.update({
      where: { facilityId: actor.facilityId },
      data,
    });
  }

  private async ensureFacilityExists(facilityId: string): Promise<void> {
    const facility = await this.prisma.facility.findUnique({
      where: { id: facilityId },
      select: { id: true },
    });

    if (!facility) {
      throw new NotFoundException("Facility not found");
    }
  }

  private validateCreatePayload(dto: UpdateFacilitySettingsDto): void {
    const missing = REQUIRED_SETTINGS_FIELDS.filter(
      (field) => !this.hasText(dto[field]),
    );

    if (missing.length > 0) {
      throw new BadRequestException(
        `Missing required facility settings fields: ${missing.join(", ")}`,
      );
    }
  }

  private buildData(
    dto: UpdateFacilitySettingsDto,
  ): Prisma.FacilitySettingsUpdateInput {
    const data: Prisma.FacilitySettingsUpdateInput = {};

    for (const field of REQUIRED_SETTINGS_FIELDS) {
      if (dto[field] !== undefined) {
        data[field] = dto[field];
      }
    }

    for (const field of ARRAY_FIELDS) {
      if (dto[field] !== undefined) {
        data[field] = dto[field].map((value) => value.trim()).filter(Boolean);
      }
    }

    if (dto.logoUrl !== undefined) {
      data.logoUrl = dto.logoUrl;
    }

    if (dto.addressLine2 !== undefined) {
      data.addressLine2 = dto.addressLine2;
    }

    if (dto.secondaryResidentIdLabel !== undefined) {
      data.secondaryResidentIdLabel = dto.secondaryResidentIdLabel;
    }

    return data;
  }

  private hasText(value?: string): boolean {
    return Boolean(value?.trim());
  }
}
