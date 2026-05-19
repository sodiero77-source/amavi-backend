import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/db/prisma.service';
import { CreateTreatmentPlanDto, ListTreatmentPlansQueryDto } from './dto';

@Injectable()
export class TreatmentPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async create(actor: any, dto: CreateTreatmentPlanDto) {
    const resident = await this.prisma.resident.findFirst({
      where: { id: dto.residentId, facilityId: actor.facilityId },
    });
    if (!resident) {
      throw new NotFoundException('Resident not found in this facility');
    }
    return this.prisma.treatmentPlanV2.create({
      data: {
        facilityId: actor.facilityId,
        residentId: dto.residentId,
        createdById: actor.actorId,
        status: 'ACTIVE',
        problems: {
          create: dto.problems.map((p) => ({
            description: p.description,
            goals: {
              create: p.goals.map((g) => ({
                description: g.description,
                objectives: {
                  create: g.objectives.map((o) => ({
                    description: o.description,
                    targetDate: o.targetDate ? new Date(o.targetDate) : null,
                  })),
                },
              })),
            },
          })),
        },
      },
      include: { problems: { include: { goals: { include: { objectives: true } } } } },
    });
  }

  async list(actor: any, query: ListTreatmentPlansQueryDto) {
    return this.prisma.treatmentPlanV2.findMany({
      where: {
        facilityId: actor.facilityId,
        ...(query.residentId && { residentId: query.residentId }),
      },
      include: { problems: { include: { goals: { include: { objectives: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}