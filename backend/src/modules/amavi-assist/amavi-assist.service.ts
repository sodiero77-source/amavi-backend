import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/db/prisma.service';
import { RequestActorContext } from '../../common/auth/request-context.interface';
import { GenerateNoteDraftDto, UpdateFacilityPrintSettingsDto } from './dto';

interface TreatmentPlanTrace {
  treatmentPlanId: string;
  problemId: string;
  problemDescription: string;
  goalId: string;
  goalDescription: string;
  objectiveId: string;
  objectiveDescription: string;
}

interface CalendarObjectiveCandidate {
  treatmentPlanId: string;
  problemId: string;
  problemDescription: string;
  goalId: string;
  goalDescription: string;
  objectiveId: string;
  objectiveDescription: string;
  objectiveStatus: string;
}

interface CalendarTopicTemplate {
  key: string;
  label: string;
  interventionCategory: string;
}

const WEEKLY_TOPIC_ROTATION: CalendarTopicTemplate[] = [
  {
    key: 'psychoeducation',
    label: 'Psychoeducation',
    interventionCategory: 'Psychoeducation',
  },
  {
    key: 'coping_skills',
    label: 'Coping skills',
    interventionCategory: 'Skill building',
  },
  {
    key: 'relapse_prevention',
    label: 'Relapse prevention',
    interventionCategory: 'Relapse prevention',
  },
  {
    key: 'medication_adherence',
    label: 'Medication adherence',
    interventionCategory: 'Medication adherence',
  },
  {
    key: 'emotional_regulation',
    label: 'Emotional regulation',
    interventionCategory: 'CBT intervention',
  },
  {
    key: 'community_integration',
    label: 'Community integration',
    interventionCategory: 'Community integration',
  },
  {
    key: 'crisis_planning',
    label: 'Crisis planning',
    interventionCategory: 'Safety planning',
  },
  {
    key: 'discharge_readiness',
    label: 'Discharge readiness',
    interventionCategory: 'Discharge planning',
  },
];

const DEFAULT_PRINT_SETTINGS = {
  facilityLegalName: null,
  dbaName: null,
  address: null,
  phone: null,
  licenseNumber: null,
  logoUrl: null,
  footerDisclaimer: null,
  printedNoteTitle: 'Clinical Note Draft',
  showAiDraftDisclaimerOnPrintedDrafts: true,
  showStaffCredentials: true,
  showTreatmentPlanLinkageSection: true,
  showAuditMetadataSection: true,
};

@Injectable()
export class AmaviAssistService {
  constructor(private readonly prisma: PrismaService) {}

  async generateNoteDraft(actor: RequestActorContext, dto: GenerateNoteDraftDto) {
    this.validateFacilityScope(actor, dto.facilityId);

    const resident = await this.prisma.resident.findFirst({
      where: {
        id: dto.residentId,
        facilityId: dto.facilityId,
        status: 'ACTIVE',
      },
    });
    if (!resident) {
      throw new NotFoundException('Active resident not found in this facility');
    }

    const trace = await this.validateTreatmentPlanTrace(dto);
    const calendarSession = await this.validateCalendarSession(dto);
    const regenerationCount = await this.getRegenerationCount(dto);
    const promptInput = this.buildPromptInput(dto, trace);
    const generatedOutput = this.buildDeterministicDraft(dto, trace);

    return this.prisma.$transaction(async (tx) => {
      const generation = await tx.clinicalNoteDraftGeneration.create({
        data: {
          facilityId: dto.facilityId,
          residentId: dto.residentId,
          treatmentPlanId: dto.treatmentPlanId,
          problemId: dto.problemId,
          goalId: dto.goalId,
          objectiveId: dto.objectiveId,
          treatmentCalendarSessionId: calendarSession?.id,
          serviceType: dto.serviceType.trim(),
          sessionTopic: dto.sessionTopic.trim(),
          staffId: dto.staffId,
          promptInput,
          generatedOutput,
          regenerationCount,
          reviewedById: null,
          reviewedAt: null,
          createdById: actor.actorId,
          requestId: actor.requestId,
        },
      });

      await tx.noteGenerationAuditLog.create({
        data: {
          facilityId: dto.facilityId,
          residentId: dto.residentId,
          generationId: generation.id,
          action: 'NOTE_DRAFT_GENERATED',
          actorId: actor.actorId,
          actorRole: actor.actorRole,
          requestId: actor.requestId,
          metadata: {
            treatmentPlanId: dto.treatmentPlanId,
            problemId: dto.problemId,
            goalId: dto.goalId,
            objectiveId: dto.objectiveId,
            treatmentCalendarSessionId: calendarSession?.id ?? null,
            regenerationCount,
          },
        },
      });

      return tx.clinicalNoteDraftGeneration.findUnique({
        where: { id: generation.id },
        include: {
          problem: true,
          goal: true,
          objective: true,
          treatmentCalendarSession: true,
          auditLogs: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    });
  }

  async getCalendar(actor: RequestActorContext, residentId: string) {
    await this.ensureMonthlyCalendar(actor, residentId);

    return this.prisma.treatmentCalendarSession.findMany({
      where: {
        facilityId: actor.facilityId,
        residentId,
        calendarMonth: this.getCalendarMonth(new Date()),
      },
      include: {
        problem: true,
        goal: true,
        objective: true,
      },
      orderBy: { scheduledFor: 'asc' },
    });
  }

  async getGenerationHistory(actor: RequestActorContext, residentId: string) {
    await this.ensureResidentInFacility(actor.facilityId, residentId);

    return this.prisma.clinicalNoteDraftGeneration.findMany({
      where: {
        facilityId: actor.facilityId,
        residentId,
      },
      include: {
        problem: true,
        goal: true,
        objective: true,
        treatmentCalendarSession: true,
        auditLogs: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPrintSettings(actor: RequestActorContext) {
    return this.getEffectivePrintSettings(actor.facilityId);
  }

  async updatePrintSettings(
    actor: RequestActorContext,
    dto: UpdateFacilityPrintSettingsDto,
  ) {
    await this.ensureFacilityExists(actor.facilityId);

    return this.prisma.facilityPrintSettings.upsert({
      where: { facilityId: actor.facilityId },
      create: {
        facilityId: actor.facilityId,
        ...dto,
      },
      update: dto,
    });
  }

  async getGeneratedNotePrintOutput(
    actor: RequestActorContext,
    generationId: string,
  ) {
    const generation = await this.prisma.clinicalNoteDraftGeneration.findFirst({
      where: {
        id: generationId,
        facilityId: actor.facilityId,
      },
      include: {
        resident: true,
        facility: true,
        problem: true,
        goal: true,
        objective: true,
        treatmentCalendarSession: true,
        auditLogs: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!generation) {
      throw new NotFoundException(
        'Generated note draft not found in this facility',
      );
    }

    const [printSettings, staff] = await Promise.all([
      this.getEffectivePrintSettings(generation.facilityId),
      this.prisma.user.findFirst({
        where: {
          id: generation.staffId,
          facilityId: generation.facilityId,
        },
        select: {
          id: true,
          fullName: true,
          role: true,
        },
      }),
    ]);

    const generatedOutput = generation.generatedOutput as Record<string, any>;
    const draft = generatedOutput.clinicalNoteDraft ?? generatedOutput;

    return {
      printSettings,
      document: {
        title: printSettings.printedNoteTitle,
        header: {
          facilityLegalName:
            printSettings.facilityLegalName ?? generation.facility.name,
          dbaName: printSettings.dbaName,
          address: printSettings.address,
          phone: printSettings.phone,
          licenseNumber: printSettings.licenseNumber,
          logoUrl: printSettings.logoUrl,
        },
        resident: {
          id: generation.residentId,
          firstName: generation.resident.firstName,
          lastName: generation.resident.lastName,
          dateOfBirth: generation.resident.dateOfBirth,
        },
        service: {
          serviceType: generation.serviceType,
          sessionTopic: generation.sessionTopic,
          scheduledFor: generation.treatmentCalendarSession?.scheduledFor ?? null,
        },
        staff: {
          id: generation.staffId,
          name: staff?.fullName ?? null,
          role: staff?.role ?? null,
          credentials: printSettings.showStaffCredentials ? null : undefined,
        },
        draft,
        aiDraftDisclaimer: printSettings.showAiDraftDisclaimerOnPrintedDrafts
          ? 'This is an AI-assisted draft for clinician review. It is not signed documentation and must not replace clinician judgment.'
          : null,
        treatmentPlanLinkage: printSettings.showTreatmentPlanLinkageSection
          ? {
              treatmentPlanId: generation.treatmentPlanId,
              problemId: generation.problemId,
              problem: generation.problem.description,
              goalId: generation.goalId,
              goal: generation.goal.description,
              objectiveId: generation.objectiveId,
              objective: generation.objective.description,
            }
          : null,
        auditMetadata: printSettings.showAuditMetadataSection
          ? {
              generationId: generation.id,
              requestId: generation.requestId,
              createdAt: generation.createdAt,
              createdById: generation.createdById,
              regenerationCount: generation.regenerationCount,
              reviewedById: generation.reviewedById,
              reviewedAt: generation.reviewedAt,
              auditLogs: generation.auditLogs,
            }
          : null,
        footer: {
          disclaimer: printSettings.footerDisclaimer,
        },
      },
    };
  }

  private validateFacilityScope(
    actor: RequestActorContext,
    bodyFacilityId: string,
  ): void {
    if (actor.facilityId !== bodyFacilityId) {
      throw new BadRequestException(
        'facilityId must match the x-facility-id header',
      );
    }
  }

  private async ensureResidentInFacility(
    facilityId: string,
    residentId: string,
  ): Promise<void> {
    const resident = await this.prisma.resident.findFirst({
      where: { id: residentId, facilityId },
      select: { id: true },
    });
    if (!resident) {
      throw new NotFoundException('Resident not found in this facility');
    }
  }

  private async ensureMonthlyCalendar(
    actor: RequestActorContext,
    residentId: string,
  ): Promise<void> {
    const calendarMonth = this.getCalendarMonth(new Date());
    const existingCount = await this.prisma.treatmentCalendarSession.count({
      where: {
        facilityId: actor.facilityId,
        residentId,
        calendarMonth,
      },
    });

    if (existingCount > 0) {
      return;
    }

    const resident = await this.prisma.resident.findFirst({
      where: {
        id: residentId,
        facilityId: actor.facilityId,
        status: 'ACTIVE',
      },
      include: {
        treatmentPlansV2: {
          where: { status: 'ACTIVE' },
          include: {
            problems: {
              include: {
                goals: {
                  include: {
                    objectives: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        treatmentCalendarSessions: {
          orderBy: { scheduledFor: 'desc' },
          take: 16,
        },
      },
    });

    if (!resident) {
      throw new NotFoundException('Active resident not found in this facility');
    }

    const candidates = this.getCalendarObjectiveCandidates(
      resident.treatmentPlansV2,
    );
    if (candidates.length === 0) {
      throw new BadRequestException(
        'No active treatment plan objectives are available for calendar generation',
      );
    }

    const sessionCount = this.resolveMonthlySessionCount(
      resident.levelOfCare,
      resident.serviceFrequency,
    );
    const priorTopicKeys = new Set(
      resident.treatmentCalendarSessions
        .map((session) => session.topicRotationKey)
        .filter((key): key is string => Boolean(key)),
    );
    const scheduleDates = this.getMonthlyScheduleDates(
      new Date(),
      sessionCount,
    );
    const diagnosisProfile = this.getDiagnosisProfile(
      resident.primaryDiagnosis,
      resident.secondaryDiagnoses,
    );

    const sessions = scheduleDates.map((scheduledFor, index) => {
      const objective = candidates[index % candidates.length];
      const topic = this.selectTopicTemplate(
        diagnosisProfile,
        priorTopicKeys,
        index,
      );
      priorTopicKeys.add(topic.key);
      const expectedProgressFocus = this.getExpectedProgressFocus(
        objective.objectiveStatus,
        resident.levelOfCare,
        index,
        sessionCount,
      );

      return {
        facilityId: actor.facilityId,
        residentId,
        treatmentPlanId: objective.treatmentPlanId,
        problemId: objective.problemId,
        goalId: objective.goalId,
        objectiveId: objective.objectiveId,
        serviceType: this.resolveServiceType(resident.levelOfCare),
        sessionTopic: this.buildSessionTopic(topic, objective, diagnosisProfile),
        interventionCategory: topic.interventionCategory,
        expectedProgressFocus,
        suggestedPrompt: this.buildSuggestedPrompt(
          topic,
          objective,
          expectedProgressFocus,
        ),
        progressionRationale: this.buildProgressionRationale(
          objective,
          resident.levelOfCare,
          resident.serviceFrequency,
          index,
          sessionCount,
        ),
        diagnosisRationale: {
          primaryDiagnosis: resident.primaryDiagnosis ?? null,
          secondaryDiagnoses: resident.secondaryDiagnoses,
          matchedFocus: diagnosisProfile.focus,
          complianceNote:
            'Suggested topic only; clinician must verify medical necessity and document actual presentation.',
        },
        topicRotationKey: topic.key,
        calendarMonth,
        scheduledFor,
        createdById: actor.actorId,
      };
    });

    await this.prisma.treatmentCalendarSession.createMany({
      data: sessions,
    });
  }

  private getCalendarObjectiveCandidates(
    treatmentPlans: Array<{
      id: string;
      problems: Array<{
        id: string;
        description: string;
        goals: Array<{
          id: string;
          description: string;
          objectives: Array<{
            id: string;
            description: string;
            status: string;
          }>;
        }>;
      }>;
    }>,
  ): CalendarObjectiveCandidate[] {
    return treatmentPlans.flatMap((plan) =>
      plan.problems.flatMap((problem) =>
        problem.goals.flatMap((goal) =>
          goal.objectives
            .filter((objective) =>
              ['NOT_STARTED', 'IN_PROGRESS'].includes(objective.status),
            )
            .map((objective) => ({
              treatmentPlanId: plan.id,
              problemId: problem.id,
              problemDescription: problem.description,
              goalId: goal.id,
              goalDescription: goal.description,
              objectiveId: objective.id,
              objectiveDescription: objective.description,
              objectiveStatus: objective.status,
            })),
        ),
      ),
    );
  }

  private getCalendarMonth(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private resolveMonthlySessionCount(
    levelOfCare?: string | null,
    serviceFrequency?: string | null,
  ): number {
    const source = `${levelOfCare ?? ''} ${serviceFrequency ?? ''}`.toLowerCase();

    if (source.includes('daily') || source.includes('php')) return 20;
    if (source.includes('iop') || source.includes('intensive')) return 12;
    if (source.includes('residential')) return 8;
    if (source.includes('biweekly') || source.includes('twice monthly')) return 2;
    if (source.includes('monthly')) return 1;
    if (source.includes('2x') || source.includes('twice weekly')) return 8;
    if (source.includes('3x')) return 12;

    return 4;
  }

  private getMonthlyScheduleDates(anchor: Date, sessionCount: number): Date[] {
    const year = anchor.getUTCFullYear();
    const month = anchor.getUTCMonth();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const interval = Math.max(1, Math.floor(daysInMonth / sessionCount));

    return Array.from({ length: sessionCount }, (_, index) => {
      const day = Math.min(daysInMonth, 1 + index * interval);
      return new Date(Date.UTC(year, month, day, 17, 0, 0));
    });
  }

  private getDiagnosisProfile(
    primaryDiagnosis?: string | null,
    secondaryDiagnoses: string[] = [],
  ) {
    const diagnoses = [primaryDiagnosis, ...secondaryDiagnoses]
      .filter((diagnosis): diagnosis is string => Boolean(diagnosis))
      .join(' ')
      .toLowerCase();

    if (diagnoses.match(/substance|alcohol|opioid|stimulant|cannabis|use disorder/)) {
      return {
        focus: 'substance use recovery',
        preferredTopics: [
          'relapse_prevention',
          'coping_skills',
          'crisis_planning',
          'community_integration',
        ],
      };
    }

    if (diagnoses.match(/depress|bipolar|mood/)) {
      return {
        focus: 'mood stabilization',
        preferredTopics: [
          'emotional_regulation',
          'medication_adherence',
          'coping_skills',
          'crisis_planning',
        ],
      };
    }

    if (diagnoses.match(/anxiety|panic|trauma|ptsd/)) {
      return {
        focus: 'anxiety and trauma symptom management',
        preferredTopics: [
          'coping_skills',
          'emotional_regulation',
          'psychoeducation',
          'crisis_planning',
        ],
      };
    }

    if (diagnoses.match(/psychosis|schizo/)) {
      return {
        focus: 'thought-disorder stabilization',
        preferredTopics: [
          'medication_adherence',
          'psychoeducation',
          'community_integration',
          'crisis_planning',
        ],
      };
    }

    return {
      focus: 'behavioral health stabilization',
      preferredTopics: WEEKLY_TOPIC_ROTATION.map((topic) => topic.key),
    };
  }

  private selectTopicTemplate(
    diagnosisProfile: { preferredTopics: string[] },
    priorTopicKeys: Set<string>,
    index: number,
  ): CalendarTopicTemplate {
    const preferred = diagnosisProfile.preferredTopics
      .map((key) => WEEKLY_TOPIC_ROTATION.find((topic) => topic.key === key))
      .filter((topic): topic is CalendarTopicTemplate => Boolean(topic));
    const rotation = [...preferred, ...WEEKLY_TOPIC_ROTATION].filter(
      (topic, topicIndex, topics) =>
        topics.findIndex((candidate) => candidate.key === topic.key) ===
        topicIndex,
    );

    return (
      rotation.find((topic) => !priorTopicKeys.has(topic.key)) ??
      rotation[index % rotation.length]
    );
  }

  private getExpectedProgressFocus(
    objectiveStatus: string,
    levelOfCare: string | null | undefined,
    index: number,
    sessionCount: number,
  ): string {
    if (index === sessionCount - 1) {
      return 'Review measurable gains, continuing barriers, and next clinically appropriate step.';
    }

    if (objectiveStatus === 'NOT_STARTED') {
      return 'Establish baseline, orient resident to objective, and introduce initial skill practice.';
    }

    if ((levelOfCare ?? '').toLowerCase().includes('residential')) {
      return 'Support structured practice, symptom stabilization, and transfer of skills across milieu settings.';
    }

    return 'Assess objective-linked progress, reinforce skill use, and document barriers without inferring unobserved symptoms.';
  }

  private resolveServiceType(levelOfCare?: string | null): string {
    const loc = (levelOfCare ?? '').toLowerCase();
    if (loc.includes('group')) return 'Group Therapy';
    if (loc.includes('family')) return 'Family Therapy';
    return 'Individual Therapy';
  }

  private buildSessionTopic(
    topic: CalendarTopicTemplate,
    objective: CalendarObjectiveCandidate,
    diagnosisProfile: { focus: string },
  ): string {
    return `${topic.label} for ${diagnosisProfile.focus}: ${objective.objectiveDescription}`;
  }

  private buildSuggestedPrompt(
    topic: CalendarTopicTemplate,
    objective: CalendarObjectiveCandidate,
    expectedProgressFocus: string,
  ): string {
    return [
      `Draft only from clinician-confirmed session details for ${topic.label.toLowerCase()}.`,
      `Map content to objective: ${objective.objectiveDescription}.`,
      `Expected progress focus: ${expectedProgressFocus}`,
      'Do not invent symptoms, diagnoses, medications, incidents, attendance, engagement, or response details.',
    ].join(' ');
  }

  private buildProgressionRationale(
    objective: CalendarObjectiveCandidate,
    levelOfCare: string | null | undefined,
    serviceFrequency: string | null | undefined,
    index: number,
    sessionCount: number,
  ): string {
    const phase =
      index === 0
        ? 'baseline and engagement'
        : index === sessionCount - 1
          ? 'review and transition planning'
          : 'skill practice and measurable progress monitoring';

    return `Payer-defensible sequence uses ${phase} for objective "${objective.objectiveDescription}" at LOC "${levelOfCare ?? 'not specified'}" with frequency "${serviceFrequency ?? 'weekly/default'}"; each session requires clinician-confirmed response and medical necessity documentation.`;
  }

  private async ensureFacilityExists(facilityId: string): Promise<void> {
    const facility = await this.prisma.facility.findUnique({
      where: { id: facilityId },
      select: { id: true },
    });
    if (!facility) {
      throw new NotFoundException('Facility not found');
    }
  }

  private async getEffectivePrintSettings(facilityId: string) {
    const facility = await this.prisma.facility.findUnique({
      where: { id: facilityId },
      include: {
        printSettings: true,
      },
    });

    if (!facility) {
      throw new NotFoundException('Facility not found');
    }

    const settings = facility.printSettings;

    return {
      id: settings?.id ?? null,
      facilityId,
      facilityLegalName: settings?.facilityLegalName ?? facility.name,
      dbaName: settings?.dbaName ?? DEFAULT_PRINT_SETTINGS.dbaName,
      address: settings?.address ?? DEFAULT_PRINT_SETTINGS.address,
      phone: settings?.phone ?? DEFAULT_PRINT_SETTINGS.phone,
      licenseNumber:
        settings?.licenseNumber ?? DEFAULT_PRINT_SETTINGS.licenseNumber,
      logoUrl: settings?.logoUrl ?? DEFAULT_PRINT_SETTINGS.logoUrl,
      footerDisclaimer:
        settings?.footerDisclaimer ?? DEFAULT_PRINT_SETTINGS.footerDisclaimer,
      printedNoteTitle:
        settings?.printedNoteTitle ?? DEFAULT_PRINT_SETTINGS.printedNoteTitle,
      showAiDraftDisclaimerOnPrintedDrafts:
        settings?.showAiDraftDisclaimerOnPrintedDrafts ??
        DEFAULT_PRINT_SETTINGS.showAiDraftDisclaimerOnPrintedDrafts,
      showStaffCredentials:
        settings?.showStaffCredentials ??
        DEFAULT_PRINT_SETTINGS.showStaffCredentials,
      showTreatmentPlanLinkageSection:
        settings?.showTreatmentPlanLinkageSection ??
        DEFAULT_PRINT_SETTINGS.showTreatmentPlanLinkageSection,
      showAuditMetadataSection:
        settings?.showAuditMetadataSection ??
        DEFAULT_PRINT_SETTINGS.showAuditMetadataSection,
      createdAt: settings?.createdAt ?? null,
      updatedAt: settings?.updatedAt ?? null,
    };
  }

  private async validateTreatmentPlanTrace(
    dto: GenerateNoteDraftDto,
  ): Promise<TreatmentPlanTrace> {
    const objective = await this.prisma.treatmentPlanObjective.findFirst({
      where: {
        id: dto.objectiveId,
        goalId: dto.goalId,
        goal: {
          id: dto.goalId,
          problemId: dto.problemId,
          problem: {
            id: dto.problemId,
            treatmentPlanId: dto.treatmentPlanId,
            treatmentPlan: {
              id: dto.treatmentPlanId,
              residentId: dto.residentId,
              facilityId: dto.facilityId,
              status: 'ACTIVE',
            },
          },
        },
      },
      include: {
        goal: {
          include: {
            problem: true,
          },
        },
      },
    });

    if (!objective) {
      throw new BadRequestException(
        'Objective must map to the supplied active treatmentPlanId, problemId, and goalId for this resident',
      );
    }

    return {
      treatmentPlanId: dto.treatmentPlanId,
      problemId: dto.problemId,
      problemDescription: objective.goal.problem.description,
      goalId: dto.goalId,
      goalDescription: objective.goal.description,
      objectiveId: dto.objectiveId,
      objectiveDescription: objective.description,
    };
  }

  private async validateCalendarSession(dto: GenerateNoteDraftDto) {
    if (!dto.treatmentCalendarSessionId) {
      return null;
    }

    const calendarSession =
      await this.prisma.treatmentCalendarSession.findFirst({
        where: {
          id: dto.treatmentCalendarSessionId,
          facilityId: dto.facilityId,
          residentId: dto.residentId,
          treatmentPlanId: dto.treatmentPlanId,
          problemId: dto.problemId,
          goalId: dto.goalId,
          objectiveId: dto.objectiveId,
          serviceType: dto.serviceType,
          sessionTopic: dto.sessionTopic,
        },
      });

    if (!calendarSession) {
      throw new BadRequestException(
        'Treatment calendar session does not match the supplied resident, facility, treatment plan, Problem, Goal, Objective, service type, and session topic',
      );
    }

    return calendarSession;
  }

  private async getRegenerationCount(
    dto: GenerateNoteDraftDto,
  ): Promise<number> {
    return this.prisma.clinicalNoteDraftGeneration.count({
      where: {
        facilityId: dto.facilityId,
        residentId: dto.residentId,
        treatmentPlanId: dto.treatmentPlanId,
        problemId: dto.problemId,
        goalId: dto.goalId,
        objectiveId: dto.objectiveId,
        serviceType: dto.serviceType,
        sessionTopic: dto.sessionTopic,
        staffId: dto.staffId,
        ...(dto.treatmentCalendarSessionId && {
          treatmentCalendarSessionId: dto.treatmentCalendarSessionId,
        }),
      },
    });
  }

  private buildPromptInput(
    dto: GenerateNoteDraftDto,
    trace: TreatmentPlanTrace,
  ): Prisma.InputJsonValue {
    return {
      instruction:
        'Generate a draft therapy note only from supplied treatment calendar and treatment plan fields. Do not invent symptoms, diagnoses, medications, incidents, or participation details.',
      constraints: [
        'Draft only; clinician review and signature required.',
        'Signed clinical notes remain immutable in the clinical-notes workflow.',
        'Map the draft back to Problem, Goal, and Objective.',
      ],
      source: {
        residentId: dto.residentId,
        facilityId: dto.facilityId,
        treatmentPlanId: dto.treatmentPlanId,
        problemId: dto.problemId,
        goalId: dto.goalId,
        objectiveId: dto.objectiveId,
        serviceType: dto.serviceType,
        sessionTopic: dto.sessionTopic,
        staffId: dto.staffId,
        treatmentCalendarSessionId: dto.treatmentCalendarSessionId ?? null,
        clinicalIntervention: dto.clinicalIntervention ?? null,
        nextStep: dto.nextStep ?? null,
      },
      treatmentPlanTrace: { ...trace },
    };
  }

  private buildDeterministicDraft(
    dto: GenerateNoteDraftDto,
    trace: TreatmentPlanTrace,
  ): Prisma.InputJsonValue {
    const intervention =
      dto.clinicalIntervention ??
      `The clinician addressed the scheduled topic "${dto.sessionTopic}" using the documented ${dto.serviceType} service context.`;
    const nextStep =
      dto.nextStep ??
      'Clinician to review this draft, add observed participation and response details from the actual encounter, and sign only after confirming accuracy.';

    // Future LLM integration point: replace this deterministic template with a guarded OpenAI/LLM provider call using promptInput as the only source material.
    return {
      status: 'DRAFT_REQUIRES_CLINICIAN_REVIEW',
      title: `${dto.serviceType} draft note: ${dto.sessionTopic}`,
      clinicalNoteDraft: {
        focus: dto.sessionTopic,
        treatmentPlanAlignment: {
          problem: trace.problemDescription,
          goal: trace.goalDescription,
          objective: trace.objectiveDescription,
        },
        intervention,
        response:
          'Resident response, symptoms, diagnoses, medications, incidents, and participation details were not provided in the source input and must be completed by the reviewing clinician if clinically supported.',
        plan: nextStep,
      },
      safetyNotices: [
        'This is an AI-assisted draft, not a signed clinical note.',
        'No symptoms, diagnoses, medications, incidents, or participation details were inferred.',
        'A human clinician must review, edit as needed, and sign before use as final documentation.',
      ],
    };
  }
}
