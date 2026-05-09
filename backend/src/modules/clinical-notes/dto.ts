import { IsNotEmpty, IsString, IsUUID, IsEnum } from 'class-validator';
import { ProgressIndicator } from '@prisma/client';

export class CreateClinicalNoteDto {
  @IsUUID()
  @IsNotEmpty()
  residentId!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsUUID()
  @IsNotEmpty()
  objectiveId!: string;

  @IsEnum(ProgressIndicator)
  @IsNotEmpty()
  progressIndicator!: ProgressIndicator;
}