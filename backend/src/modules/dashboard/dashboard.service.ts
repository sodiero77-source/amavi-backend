import { Injectable } from '@nestjs/common';
import { RequestActorContext } from '../../common/auth/request-context.interface';
import { MedicationService } from '../medication/medication.service';
import { ClinicalNotesService } from '../clinical-notes/clinical-notes.service';
import { TreatmentPlansService } from '../treatment-plans/treatment-plans.service';
import { TasksService } from '../tasks/tasks.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly medicationService: MedicationService,
    private readonly clinicalNotesService: ClinicalNotesService,
    private readonly treatmentPlansService: TreatmentPlansService,
    private readonly tasksService: TasksService,
  ) {}

  private atMidnight(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private endOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  async getTodayView(
    actor: RequestActorContext,
    view: 'staff' | 'supervisor' = 'staff',
  ) {
    const now = new Date();
    const startOfToday = this.atMidnight(now);
    const endOfToday = this.endOfDay(now);

    // Fetch all data concurrently
    const [medicationFeed, unsignedNotesCount, activePlansCount, pendingTasks] =
      await Promise.all([
        this.medicationService.getDueFeed(actor, { view }, now),
        this.clinicalNotesService.countUnsigned(actor),
        this.treatmentPlansService.countActivePlans(actor),
        this.tasksService.listPendingTasksForToday(actor, startOfToday, endOfToday),
      ]);

    const dateStr = startOfToday.toISOString().split('T')[0];

    if (view === 'supervisor') {
      // Supervisor view: aggregated metrics
      const overdueMeds = medicationFeed.overdue || [];
      const dueNowMeds = medicationFeed.dueNow || [];
      const dueSoonMeds = medicationFeed.dueSoon || [];
      const todayMeds = medicationFeed.today || [];

      const allMeds = [
        ...overdueMeds,
        ...dueNowMeds,
        ...dueSoonMeds,
        ...todayMeds,
      ];

      return {
        view: 'supervisor',
        date: dateStr,
        summary: {
          medicationsDueCount: allMeds.length,
          overdueMedicationsCount: overdueMeds.length,
          tasksDueTodayCount: pendingTasks.length,
          unsignedNotesCount,
          activeTreatmentPlansCount: activePlansCount,
          medPassSummary: medicationFeed.medPassSummary || {
            expected: allMeds.length,
            administered: 0,
            missed: 0,
          },
        },
      };
    }

    // Staff view: actionable lists
    const medicationsDue = {
      overdue: medicationFeed.overdue || [],
      dueNow: medicationFeed.dueNow || [],
      dueSoon: medicationFeed.dueSoon || [],
      today: medicationFeed.today || [],
    };

    const tasksDueToday = pendingTasks.map((task) => ({
      id: task.id,
      title: task.title,
      dueAt: task.dueAt,
      residentId: task.residentId,
    }));

    return {
      view: 'staff',
      date: dateStr,
      medicationsDue,
      tasksDueToday,
      unsignedNotesCount,
      activeTreatmentPlansCount: activePlansCount,
    };
  }
}
