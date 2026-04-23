import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { TreatmentPlansService } from './treatment-plans.service';
import {
  CreateTreatmentPlanDto,
  ListTreatmentPlansQueryDto,
} from './dto';
import { RequestActorContext } from '../../common/auth/request-context.interface';

type RequestWithActorContext = Request & {
  actorContext: RequestActorContext;
};

@Controller('/api/treatment-plans')
export class TreatmentPlansController {
  constructor(
    private readonly treatmentPlansService: TreatmentPlansService,
  ) {}

  @Post()
  create(
    @Req() req: RequestWithActorContext,
    @Body() dto: CreateTreatmentPlanDto,
  ) {
    return this.treatmentPlansService.create(req.actorContext, dto);
  }

  @Get()
  list(
    @Req() req: RequestWithActorContext,
    @Query() query: ListTreatmentPlansQueryDto,
  ) {
    return this.treatmentPlansService.list(req.actorContext, query);
  }
}
