import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/db/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';
import { RequestActorContext } from '../../common/auth/request-context.interface';
import { CreateClinicalNoteDto } from './dto';

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
    // scoped to this exact resident and facility — full chain enforced
    const objective = await this.prisma.treatmentPlanObjective.findFirst({
      where: {
        id: dto.objectiveId,
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
          problem: '',
          goal: '',
          objective: '',
          status: 'DRAFT',
          createdById: actor.actorId,
        },
      });

      await tx.clinicalNoteTreatmentPlanLink.create({
        data: {
          noteId: note.id,
          objectiveId: dto.objectiveId,
          progressIndicator: dto.progressIndicator,
        },
      });

      return note;
    });

    // 4. Publish event after successful commit
    this.eventBus.publish({
      name: 'ClinicalNoteCreated',
      occurredAt: new Date().toISOString(),
      payload: {
        noteId: result.id,
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
}