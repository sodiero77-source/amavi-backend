import { Body, Controller, Get, Patch, Req, UseGuards } from "@nestjs/common";
import { RequestContextGuard } from "../../common/guards/request-context.guard";
import { UpdateFacilitySettingsDto } from "./dto";
import { FacilitySettingsService } from "./facility-settings.service";

@Controller("facility-settings")
@UseGuards(RequestContextGuard)
export class FacilitySettingsController {
  constructor(
    private readonly facilitySettingsService: FacilitySettingsService,
  ) {}

  @Get()
  get(@Req() request: any) {
    return this.facilitySettingsService.get(request.actorContext);
  }

  @Patch()
  update(@Req() request: any, @Body() dto: UpdateFacilitySettingsDto) {
    return this.facilitySettingsService.update(request.actorContext, dto);
  }
}
