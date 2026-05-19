import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUrl, IsNotEmpty } from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateFacilityPrintSettingsDto {
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  facilityLegalName?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  dbaName?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  address?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phone?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  licenseNumber?: string;

  @Transform(trimString)
  @IsOptional()
  @IsUrl({ require_tld: false })
  logoUrl?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  footerDisclaimer?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  printedNoteTitle?: string;

  @IsOptional()
  @IsBoolean()
  showAiDraftDisclaimerOnPrintedDrafts?: boolean;

  @IsOptional()
  @IsBoolean()
  showStaffCredentials?: boolean;

  @IsOptional()
  @IsBoolean()
  showTreatmentPlanLinkageSection?: boolean;

  @IsOptional()
  @IsBoolean()
  showAuditMetadataSection?: boolean;
}
