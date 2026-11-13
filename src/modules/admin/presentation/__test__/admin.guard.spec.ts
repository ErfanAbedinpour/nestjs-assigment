import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { AdminApiKeyGuard } from '../admin.guard';

describe('AdminApiKeyGuard', () => {
  const guard = new AdminApiKeyGuard({
    getOrThrow: () => 'secret-key',
  } as unknown as ConfigService);
  const context = (key?: string) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ header: () => key }) }),
    }) as unknown as ExecutionContext;
  it('allows the configured key', () =>
    expect(guard.canActivate(context('secret-key'))).toBe(true));
  it.each([undefined, 'wrong', 'secret-kez'])(
    'rejects a missing or incorrect key',
    (key) => {
      expect(() => guard.canActivate(context(key))).toThrow(UnauthorizedException);
    },
  );
});
