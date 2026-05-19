import { IsDefined, IsNotEmpty, IsString } from "class-validator";

export class GenerateNoteDto {
  @IsDefined()
  residentContext!: unknown;

  @IsString()
  @IsNotEmpty()
  mood!: string;

  @IsString()
  @IsNotEmpty()
  intervention!: string;

  @IsString()
  @IsNotEmpty()
  observations!: string;
}

export interface SoapNoteResponse {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}
