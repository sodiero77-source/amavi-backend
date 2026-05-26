import { Module } from "@nestjs/common";
import {
  MedicationAdministrationsController,
  MedicationController,
} from "./medication.controller";
import { MedicationService } from "./medication.service";

@Module({
  controllers: [MedicationController, MedicationAdministrationsController],
  providers: [MedicationService],
})
export class MedicationModule {}
