import { IsArray, IsString, IsOptional, ValidateNested, IsUUID, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class ObjectiveDto {
  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  targetDate?: string;
}

export class GoalDto {
  @IsString()
  description!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ObjectiveDto)
  objectives!: ObjectiveDto[];
}

export class ProblemDto {
  @IsString()
  description!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GoalDto)
  goals!: GoalDto[];
}

export class CreateTreatmentPlanDto {
  @IsString()
  @IsNotEmpty()
  residentId!: string;

  @IsString()
  title!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProblemDto)
  problems!: ProblemDto[];
}
