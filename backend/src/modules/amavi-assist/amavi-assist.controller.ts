import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RequestContextGuard } from '../../common/guards/request-context.guard';
import { AmaviAssistService } from './amavi-assist.service';
import { GenerateNoteDraftDto, UpdateFacilityPrintSettingsDto } from './dto';

@Controller('amavi-assist')
@UseGuards(RequestContextGuard)
export class AmaviAssistController {
  constructor(private readonly amaviAssistService: AmaviAssistService) {}

  @Post('generate-note-draft')
  generateNoteDraft(@Req() request: any, @Body() dto: GenerateNoteDraftDto) {
    return this.amaviAssistService.generateNoteDraft(
      request.actorContext,
      dto,
    );
  }

  @Get('calendar/:residentId')
  getCalendar(@Req() request: any, @Param('residentId') residentId: string) {
    return this.amaviAssistService.getCalendar(
      request.actorContext,
      residentId,
    );
  }

  @Get('generation-history/:residentId')
  getGenerationHistory(
    @Req() request: any,
    @Param('residentId') residentId: string,
  ) {
    return this.amaviAssistService.getGenerationHistory(
      request.actorContext,
      residentId,
    );
  }

  @Get('print-settings')
  getPrintSettings(@Req() request: any) {
    return this.amaviAssistService.getPrintSettings(request.actorContext);
  }

  @Patch('print-settings')
  updatePrintSettings(
    @Req() request: any,
    @Body() dto: UpdateFacilityPrintSettingsDto,
  ) {
    return this.amaviAssistService.updatePrintSettings(
      request.actorContext,
      dto,
    );
  }

  @Get('generated-note-drafts/:generationId/print')
  getGeneratedNotePrintOutput(
    @Req() request: any,
    @Param('generationId') generationId: string,
  ) {
    return this.amaviAssistService.getGeneratedNotePrintOutput(
      request.actorContext,
      generationId,
    );
  }
}
