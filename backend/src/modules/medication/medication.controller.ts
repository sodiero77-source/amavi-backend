import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { MedicationService } from "./medication.service";
import {
  CreateMedicationOrderDto,
  CreateMedicationScheduleDto,
  GetMedicationDueQueryDto,
  ListMedicationAdministrationsQueryDto,
  RecordMedicationAdministrationDto,
} from "./dto";

@Controller("medication-orders")
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

  @Post(":orderId/schedules")
  createSchedule(
    @Req() request: any,
    @Param("orderId") orderId: string,
    @Body() dto: CreateMedicationScheduleDto,
  ) {
    return this.medicationService.createSchedule(
      request.actorContext,
      orderId,
      dto,
    );
  }

  @Get(":orderId/schedules")
  listSchedules(@Req() request: any, @Param("orderId") orderId: string) {
    return this.medicationService.listSchedules(request.actorContext, orderId);
  }
}

@Controller("medication-administrations")
@UseGuards(JwtAuthGuard)
export class MedicationAdministrationsController {
  constructor(private readonly medicationService: MedicationService) {}

  @Post()
  record(@Req() request: any, @Body() dto: RecordMedicationAdministrationDto) {
    return this.medicationService.recordAdministration(
      request.actorContext,
      dto,
    );
  }

  @Get()
  list(
    @Req() request: any,
    @Query() query: ListMedicationAdministrationsQueryDto,
  ) {
    return this.medicationService.listAdministrations(
      request.actorContext,
      query,
    );
  }
}

@Controller("mar")
@UseGuards(JwtAuthGuard)
export class MarController {
  constructor(private readonly medicationService: MedicationService) {}

  @Get("due")
  getDueFeed(
    @Req() request: any,
    @Query() query: GetMedicationDueQueryDto,
  ) {
    return this.medicationService.getDueFeed(request.actorContext, query);
  }
}
