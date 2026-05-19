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
    await this.ensureResidentInFacility(actor.facilityId, residentId);

    return this.prisma.treatmentCalendarSession.findMany({
      where: {
        facilityId: actor.facilityId,
        residentId,
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
