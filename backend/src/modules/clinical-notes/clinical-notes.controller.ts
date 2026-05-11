import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { RequestContextGuard } from '../../common/guards/request-context.guard';
import { ClinicalNotesService } from './clinical-notes.service';
import { CreateClinicalNoteDto, UpdateClinicalNoteDto } from './dto';

@Controller('clinical-notes')
@UseGuards(RequestContextGuard)
export class ClinicalNotesController {
  constructor(private readonly clinicalNotesService: ClinicalNotesService) {}

  @Post()
  create(@Req() request: any, @Body() dto: CreateClinicalNoteDto) {
    return this.clinicalNotesService.create(request.actorContext, dto);
  }

  @Post(':id/sign')
  sign(@Req() request: any, @Param('id') id: string) {
    return this.clinicalNotesService.sign(request.actorContext, id);
  }

  @Patch(':id')
  update(@Req() request: any, @Param('id') id: string, @Body() dto: UpdateClinicalNoteDto) {
    return this.clinicalNotesService.update(request.actorContext, id, dto);
  }

  @Delete(':id')
  remove(@Req() request: any, @Param('id') id: string) {
    return this.clinicalNotesService.remove(request.actorContext, id);
  }

  @Get()
  list(@Req() request: any) {
    return this.clinicalNotesService.list(request.actorContext);
  }
}
