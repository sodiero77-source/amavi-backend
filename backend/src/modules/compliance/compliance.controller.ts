import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ComplianceService } from './compliance.service';
import { CreateComplianceAlertDto } from './dto';

@Controller('compliance-alerts')
@UseGuards(JwtAuthGuard)
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Post()
  create(@Req() request: any, @Body() dto: CreateComplianceAlertDto) {
    return this.complianceService.create(request.actorContext, dto);
  }

  @Get()
  list(@Req() request: any) {
    return this.complianceService.list(request.actorContext);
  }
}
