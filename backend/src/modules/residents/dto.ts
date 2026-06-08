import { ResidentStatus } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

export class CreateResidentDto {
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsDateString()
  dateOfBirth!: string;

  @IsDateString()
  admissionDate!: string;
}

export class ListResidentsQueryDto {
  @IsString()
  @IsOptional()
  facilityId?: string;
}

export class GetResidentParamsDto {
  @IsString()
  @IsNotEmpty()
  id!: string;
}

export class UpdateResidentDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsDateString()
  @IsOptional()
  dob?: string;

  @IsEnum(ResidentStatus)
  @IsOptional()
  status?: ResidentStatus;

  @IsString()
  @IsOptional()
  diagnosisCode?: string;
}

export class DeleteResidentParamsDto {
  @IsString()
  @IsNotEmpty()
  id!: string;
}
