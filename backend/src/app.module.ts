import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./common/auth/auth.module";
import { PrismaModule } from "./common/db/prisma.module";
import { EventBusModule } from "./common/events/event-bus.module";
import { HealthModule } from "./modules/health/health.module";
import { ResidentsModule } from "./modules/residents/residents.module";
import { ClinicalNotesModule } from "./modules/clinical-notes/clinical-notes.module";
import { MedicationModule } from "./modules/medication/medication.module";
import { TasksModule } from "./modules/tasks/tasks.module";
import { ComplianceModule } from "./modules/compliance/compliance.module";
import { TreatmentPlansModule } from "./modules/treatment-plans/treatment-plans.module";
import { AiModule } from "./modules/ai/ai.module";
import { AmaviAssistModule } from "./modules/amavi-assist";
import { FacilitySettingsModule } from "./modules/facility-settings/facility-settings.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    PrismaModule,
    EventBusModule,
    HealthModule,
    ResidentsModule,
    ClinicalNotesModule,
    MedicationModule,
    TasksModule,
    ComplianceModule,
    TreatmentPlansModule,
    AiModule,
    AmaviAssistModule,
    FacilitySettingsModule,
    DashboardModule,
  ],
})
export class AppModule {}
