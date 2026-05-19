import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";

import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RequestContextGuard } from "../../common/guards/request-context.guard";

import {
  CreateResidentDto,
  DeleteResidentParamsDto,
  GetResidentParamsDto,
  UpdateResidentDto,
} from "./dto";

import { ResidentsService } from "./residents.service";

@Controller("residents")
@UseGuards(RequestContextGuard)
export class ResidentsController {
  constructor(private readonly residentsService: ResidentsService) {}

  @Post()
  create(@Body() dto: CreateResidentDto) {
    return this.residentsService.create(dto);
  }

  @Get()
  list(@Req() request: any) {
    return this.residentsService.list(request.actorContext);
  }

  @Get(":id")
  getOne(@Req() request: any, @Param() params: GetResidentParamsDto) {
    return this.residentsService.getOne(request.actorContext, params.id);
  }

  @Patch(":id")
  update(
    @Req() request: any,
    @Param() params: GetResidentParamsDto,
    @Body() dto: UpdateResidentDto,
  ) {
    return this.residentsService.update(request.actorContext, params.id, dto);
  }

  @Delete(":id")
  remove(@Req() request: any, @Param() params: DeleteResidentParamsDto) {
    return this.residentsService.remove(request.actorContext, params.id);
  }
}
