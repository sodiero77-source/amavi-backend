import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MedicationService } from './medication.service';
import { CreateMedicationOrderDto } from './dto';

@Controller('medication-orders')
@UseGuards(JwtAuthGuard)
export class MedicationController {
  constructor(private readonly medicationService: MedicationService) {}

  @Post()
  createOrder(@Req() request: any, @Body() dto: CreateMedicationOrderDto) {
    return this.medicationService.createOrder(request.actorContext, dto);
  }

  @Get()
  list(@Req() request: any) {
    return this.medicationService.list(request.actorContext);
  }
}
