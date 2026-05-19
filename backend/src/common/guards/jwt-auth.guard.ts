import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { randomUUID } from 'crypto';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const canActivate = await super.canActivate(context);
    const request = context.switchToHttp().getRequest();

    request.actorContext = {
      ...request.user,
      requestId: request.header('x-request-id') ?? randomUUID(),
    };

    return canActivate as boolean;
  }
}
