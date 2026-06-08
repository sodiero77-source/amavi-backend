import { Module } from '@nestjs/common';
import { MedicationModule } from '../medication/medication.module';
import { ClinicalNotesModule } from '../clinical-notes/clinical-notes.module';
import { TreatmentPlansModule } from '../treatment-plans/treatment-plans.module';
import { TasksModule } from '../tasks/tasks.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    MedicationModule,
    ClinicalNotesModule,
    TreatmentPlansModule,
    TasksModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
