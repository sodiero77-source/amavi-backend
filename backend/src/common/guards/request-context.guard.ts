import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RequestActorContext } from '../auth/request-context.interface';

@Injectable()
export class RequestContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const actorId = request.header('x-actor-id');
    const actorRole = request.header('x-actor-role');
    const facilityId = request.header('x-facility-id');

    if (!actorId || !actorRole || !facilityId) {
      throw new UnauthorizedException(
        'Missing x-actor-id, x-actor-role, or x-facility-id header.',
      );
    }

    const actorContext: RequestActorContext = {
      actor: {
        actorId,
        role: actorRole,
      },
      facilityId,
      requestId: request.header('x-request-id') ?? randomUUID(),
    };

    request.actorContext = actorContext;
    return true;
  }
}
