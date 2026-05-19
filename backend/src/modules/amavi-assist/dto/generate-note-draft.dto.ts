import { IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class GenerateNoteDraftDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  residentId!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  facilityId!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  treatmentPlanId!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  problemId!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  goalId!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  objectiveId!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  serviceType!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  sessionTopic!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  staffId!: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  treatmentCalendarSessionId?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  clinicalIntervention?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nextStep?: string;
}
