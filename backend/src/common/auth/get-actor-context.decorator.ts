import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestActorContext } from './request-context.interface';

export const GetActorContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): RequestActorContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.actorContext;
  },
);
