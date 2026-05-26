import { Transform } from "class-transformer";
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from "class-validator";

const trimString = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class UpdateFacilitySettingsDto {
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  companyName?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  providerNpiOrTaxNumber?: string;

  @Transform(trimString)
  @IsOptional()
  @IsEmail()
  email?: string;

  @Transform(trimString)
  @IsOptional()
  @IsUrl({ require_tld: false })
  logoUrl?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  programType?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  addressLine1?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  addressLine2?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  city?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  state?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  postalCode?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  timeZone?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  shifts?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  servicesProvided?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  levelsOfFunctioning?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  urgentNotificationEmails?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  residentAttendanceOptions?: string[];

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  clientLabel?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  residentReportLabel?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  governingBodyLabel?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  residentIdLabel?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  secondaryResidentIdLabel?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  serviceCoordinatorLabel?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  evaluatorLeadLabel?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  goalsLabel?: string;
}
