import { IsNotEmpty, IsString, IsEnum } from 'class-validator';
import { ProgressIndicator } from '@prisma/client';

export class CreateClinicalNoteDto {
  @IsString()
  @IsNotEmpty()
  residentId!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsString()
  @IsNotEmpty()
  objectiveId!: string;

  @IsEnum(ProgressIndicator)
  @IsNotEmpty()
  progressIndicator!: ProgressIndicator;
}