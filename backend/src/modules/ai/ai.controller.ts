import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AiService } from "./ai.service";
import { GenerateNoteDto } from "./dto";

@Controller("ai")
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post("generate-note")
  generateNote(@Body() dto: GenerateNoteDto) {
    return this.aiService.generateNote(dto);
  }
}
