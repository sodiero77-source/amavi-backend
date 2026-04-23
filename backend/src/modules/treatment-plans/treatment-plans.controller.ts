import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { TreatmentPlansService } from './treatment-plans.service';
import {
  CreateTreatmentPlanDto,
  ListTreatmentPlansQueryDto,
} from './dto';
import { RequestActorContext } from '../../common/auth/request-context.interface';

@Controller('/api/treatment-plans')
export class TreatmentPlansController {
  constructor(
    private readonly treatmentPlansService: TreatmentPlansService,
  ) {}

  @Post()
  create(
    @Req() req: RequestActorContext,
    @Body() dto: CreateTreatmentPlanDto,
  ) {
    return this.treatmentPlansService.create(req, dto);
  }

  @Get()
  list(
    @Req() req: RequestActorContext,
    @Query() query: ListTreatmentPlansQueryDto,
  ) {
    return this.treatmentPlansService.list(req, query);
  }
}
