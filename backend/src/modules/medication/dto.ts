import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import {
  MedicationAdministrationStatus,
  MedicationScheduleType,
} from "@prisma/client";

export class CreateMedicationOrderDto {
  @IsString()
  @IsNotEmpty()
  residentId!: string;

  @IsString()
  @IsNotEmpty()
  medicationName!: string;

  @IsString()
  @IsNotEmpty()
  dose!: string;

  @IsString()
  @IsNotEmpty()
  route!: string;

  @IsString()
  @IsNotEmpty()
  frequency!: string;
}

export class CreateMedicationScheduleDto {
  @IsEnum(MedicationScheduleType)
  @IsOptional()
  type?: MedicationScheduleType;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  scheduledTime?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  scheduledDays?: string[];

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  instructions?: string;
}

export class ListMedicationAdministrationsQueryDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  residentId?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  medicationOrderId?: string;

  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @IsDateString()
  @IsOptional()
  toDate?: string;
}

export class GetMedicationDueQueryDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  residentId?: string;

  @IsDateString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  @IsIn(["medtech", "supervisor"])
  view?: string;
}

export class RecordMedicationAdministrationDto {
  @IsString()
  @IsNotEmpty()
  residentId!: string;

  @IsString()
  @IsNotEmpty()
  medicationOrderId!: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  scheduleId?: string;

  @IsDateString()
  administrationDate!: string;

  @IsEnum(MedicationAdministrationStatus)
  status!: MedicationAdministrationStatus;

  @IsDateString()
  @IsOptional()
  administeredAt?: string;

  @IsString()
  @IsNotEmpty()
  administeredByInitials!: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  notes?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  reason?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  prnIndication?: string;

  @IsDateString()
  @IsOptional()
  prnFollowUpAt?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  prnEffectiveness?: string;
}
