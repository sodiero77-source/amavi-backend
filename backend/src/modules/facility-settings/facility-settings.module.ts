import { Module } from "@nestjs/common";
import { FacilitySettingsController } from "./facility-settings.controller";
import { FacilitySettingsService } from "./facility-settings.service";

@Module({
  controllers: [FacilitySettingsController],
  providers: [FacilitySettingsService],
})
export class FacilitySettingsModule {}
