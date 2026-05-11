import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/db/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';
import { RequestActorContext } from '../../common/auth/request-context.interface';
import { CreateClinicalNoteDto, UpdateClinicalNoteDto } from './dto';

@Injectable()
export class ClinicalNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(actor: RequestActorContext, dto: CreateClinicalNoteDto) {
    // 1. Validate resident belongs to actor's facility
    const resident = await this.prisma.resident.findFirst({
      where: {
        id: dto.residentId,
        facilityId: actor.facilityId,
      },
    });
    if (!resident) {
      throw new NotFoundException('Resident not found in this facility');
    }

    // 2. Validate objective traces back to active treatment plan
    const objective = await this.prisma.treatmentPlanObjective.findFirst({
      where: {
        id: dto.objectiveId,
        status: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
        goal: {
          problem: {
            treatmentPlan: {
              residentId: dto.residentId,
              facilityId: actor.facilityId,
              status: 'ACTIVE',
            },
          },
        },
      },
    });
    if (!objective) {
      throw new NotFoundException(
        'No active treatment plan objective found for this resident',
      );
    }

    // 3. Create note + linkage atomically
    const result = await this.prisma.$transaction(async (tx) => {
      const note = await tx.clinicalNote.create({
        data: {
          facilityId: actor.facilityId,
          residentId: dto.residentId,
          title: dto.title,
          content: dto.content,
          status: 'DRAFT',
          createdById: actor.actorId,
        },
        include: {
          treatmentPlanLinks: {
            include: {
              objective: true,
            },
          },
          signature: true,
        },
      });

      await tx.clinicalNoteTreatmentPlanLink.create({
        data: {
          noteId: note.id,
          objectiveId: dto.objectiveId,
          progressIndicator: dto.progressIndicator,
        },
      });

      // Return note with links included
      return tx.clinicalNote.findUnique({
        where: { id: note.id },
        include: {
          treatmentPlanLinks: {
            include: {
              objective: {
                include: {
                  goal: {
                    include: {
                      problem: true,
                    },
                  },
                },
              },
            },
          },
          signature: true,
        },
      });
    });

    // 4. Publish event
    this.eventBus.publish({
      name: 'ClinicalNoteCreated',
      occurredAt: new Date().toISOString(),
      payload: {
        noteId: result!.id,
        residentId: dto.residentId,
        objectiveId: dto.objectiveId,
        actorId: actor.actorId,
      },
    });

    return result;
  }

  async list(actor: RequestActorContext) {
    return this.prisma.clinicalNote.findMany({
      where: { facilityId: actor.facilityId },
      include: {
        treatmentPlanLinks: {
          include: {
            objective: {
              include: {
                goal: {
                  include: {
                    problem: true,
                  },
                },
              },
            },
          },
        },
        signature: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }  
async sign(actor: RequestActorContext, noteId: string) {
    const note = await this.prisma.clinicalNote.findFirst({
      where: { id: noteId, facilityId: actor.facilityId },
      include: {
        treatmentPlanLinks: {
          include: {
            objective: {
              include: {
                goal: { include: { problem: { include: { treatmentPlan: true } } } }
              },
            },
          },
        },
        signature: true,
      },
    });
    if (!note) throw new NotFoundException('Clinical note not found in this facility');
    if (note.status !== 'DRAFT') throw new BadRequestException(`Note cannot be signed — current status is ${note.status}`);
    if (!note.treatmentPlanLinks || note.treatmentPlanLinks.length === 0) throw new BadRequestException('Note cannot be signed — no treatment plan linkage found');
    const link = note.treatmentPlanLinks[0];
    const treatmentPlan = link.objective.goal.problem.treatmentPlan;
    if (treatmentPlan.status !== 'ACTIVE') throw new BadRequestException('Note cannot be signed — linked treatment plan is no longer active');
    if (treatmentPlan.residentId !== note.residentId) throw new BadRequestException('Note cannot be signed — treatment plan resident mismatch');
    if (treatmentPlan.facilityId !== actor.facilityId) throw new BadRequestException('Note cannot be signed — cross-facility signing not permitted');
    if (note.signature) throw new BadRequestException('Note has already been signed');
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.clinicalNote.update({ where: { id: noteId }, data: { status: 'SIGNED' } });
      await tx.clinicalNoteSignature.create({ data: { noteId, signedById: actor.actorId } });
      await tx.treatmentPlanObjective.updateMany({
        where: { id: link.objectiveId, status: 'NOT_STARTED' },
        data: { status: 'IN_PROGRESS' },
      });
      return tx.clinicalNote.findUnique({
        where: { id: noteId },
        include: {
          treatmentPlanLinks: { include: { objective: true } },
          signature: true,
        },
      });
    });
    this.eventBus.publish({
      name: 'ClinicalNoteSigned',
      occurredAt: new Date().toISOString(),
      payload: { noteId, residentId: note.residentId, signedById: actor.actorId, objectiveId: link.objectiveId },
    });
    return result;
  }
async update(actor: RequestActorContext, noteId: string, dto: UpdateClinicalNoteDto) {
    const note = await this.prisma.clinicalNote.findFirst({
      where: { id: noteId, facilityId: actor.facilityId },
    });
    if (!note) {
      throw new NotFoundException('Clinical note not found in this facility');
    }
    if (note.status === 'SIGNED') {
      throw new BadRequestException('SIGNED clinical notes cannot be edited');
    }
    return this.prisma.clinicalNote.update({
      where: { id: noteId },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.content && { content: dto.content }),
      },
      include: {
        treatmentPlanLinks: { include: { objective: true } },
        signature: true,
      },
    });
  }

  async remove(actor: RequestActorContext, noteId: string) {
    const note = await this.prisma.clinicalNote.findFirst({
      where: { id: noteId, facilityId: actor.facilityId },
    });
    if (!note) {
      throw new NotFoundException('Clinical note not found in this facility');
    }
    if (note.status === 'SIGNED') {
      throw new BadRequestException('SIGNED clinical notes cannot be deleted');
    }
    await this.prisma.clinicalNote.delete({
      where: { id: noteId },
    });
    return { message: 'Clinical note deleted successfully' };
  }
}