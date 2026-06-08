import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/db/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';
import { RequestActorContext } from '../../common/auth/request-context.interface';
import { CreateTaskDto } from './dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(actor: RequestActorContext, dto: CreateTaskDto) {
    const task = await this.prisma.task.create({
      data: {
        facilityId: actor.facilityId,
        residentId: dto.residentId,
        title: dto.title,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
      },
    });

    this.eventBus.publish({
      name: 'TaskCreated',
      occurredAt: new Date().toISOString(),
      payload: { taskId: task.id, actorId: actor.actorId },
    });

    return task;
  }

  async list(actor: RequestActorContext) {
    return this.prisma.task.findMany({
      where: { facilityId: actor.facilityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listPendingTasksForToday(
    actor: RequestActorContext,
    start: Date,
    end: Date,
  ) {
    return this.prisma.task.findMany({
      where: {
        facilityId: actor.facilityId,
        status: { not: 'COMPLETED' },
        dueAt: {
          gte: start,
          lte: end,
        },
      },
      select: {
        id: true,
        title: true,
        dueAt: true,
        residentId: true,
      },
      orderBy: {
        dueAt: 'asc',
      },
    });
  }
}
