import { Module } from "@nestjs/common";
import {
  MarController,
  MedicationAdministrationsController,
  MedicationController,
} from "./medication.controller";
import { MedicationService } from "./medication.service";

@Module({
  controllers: [MedicationController, MedicationAdministrationsController, MarController],
  providers: [MedicationService],
})
export class MedicationModule {}
