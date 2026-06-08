import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { randomUUID } from 'crypto';
import { RequestActorContext } from '../auth/request-context.interface';

@Injectable()
export class RequestContextGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const canActivate = await super.canActivate(context);
    const request = context.switchToHttp().getRequest();

    const actorContext: RequestActorContext = {
      actorId: request.user.actorId,
      actorRole: request.user.actorRole,
      facilityId: request.user.facilityId,
      requestId:
        request.header?.('x-request-id') ?? request.headers?.['x-request-id'] ?? randomUUID(),
    };

    request.actorContext = actorContext;

    return canActivate as boolean;
  }
}
