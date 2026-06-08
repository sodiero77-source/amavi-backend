import { strict as assert } from 'node:assert';
import { describe, it, mock } from 'node:test';
import { ExecutionContext } from '@nestjs/common';
import { RequestContextGuard } from './request-context.guard';

const fn = () => mock.fn<(...args: any[]) => any>();

describe('RequestContextGuard', () => {
  it('derives actorContext from request.user and ignores spoofed x-facility-id', async () => {
    const guard = new RequestContextGuard();
    const request: any = {
      headers: {
        authorization: 'Bearer token',
        'x-request-id': 'request-123',
        'x-facility-id': 'spoofed-facility',
      },
      header(name: string) {
        return this.headers[name.toLowerCase()];
      },
      user: {
        actorId: 'jwt-user',
        actorRole: 'CLINICIAN',
        facilityId: 'jwt-facility',
      },
    };

    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    const authGuardPrototype = Object.getPrototypeOf(Object.getPrototypeOf(guard));
    const originalCanActivate = authGuardPrototype.canActivate;
    try {
      authGuardPrototype.canActivate = async () => true;
      const result = await guard.canActivate(context);

      assert.equal(result, true);
      assert.equal(request.actorContext.actorId, 'jwt-user');
      assert.equal(request.actorContext.actorRole, 'CLINICIAN');
      assert.equal(request.actorContext.facilityId, 'jwt-facility');
      assert.equal(request.actorContext.requestId, 'request-123');
    } finally {
      authGuardPrototype.canActivate = originalCanActivate;
    }
  });
});
