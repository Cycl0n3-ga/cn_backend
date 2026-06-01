import { Reflector } from '@nestjs/core';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { RequestAwareThrottlerGuard } from './request-aware-throttler.guard.js';

class TestRequestAwareThrottlerGuard extends RequestAwareThrottlerGuard {
  constructor() {
    super([], {} as ThrottlerStorage, new Reflector());
  }

  track(req: Record<string, unknown>) {
    return this.getTracker(req);
  }
}

function tokenWithPayload(payload: Record<string, unknown>) {
  return [
    'header',
    Buffer.from(JSON.stringify(payload)).toString('base64url'),
    'signature',
  ].join('.');
}

describe('RequestAwareThrottlerGuard', () => {
  let guard: TestRequestAwareThrottlerGuard;

  beforeEach(() => {
    guard = new TestRequestAwareThrottlerGuard();
  });

  it('should use JWT subject as tracker when bearer token is present', async () => {
    const tracker = await guard.track({
      headers: {
        authorization: `Bearer ${tokenWithPayload({ sub: 'user-uuid-1' })}`,
      },
      ip: '127.0.0.1',
    });

    expect(tracker).toBe('user:user-uuid-1');
  });

  it('should fall back to ip address without a valid bearer token', async () => {
    const tracker = await guard.track({
      headers: { authorization: 'Bearer invalid-token' },
      ip: '127.0.0.1',
    });

    expect(tracker).toBe('ip:127.0.0.1');
  });

  it('should use socket remote address when ip is unavailable', async () => {
    const tracker = await guard.track({
      headers: {},
      socket: { remoteAddress: '::1' },
    });

    expect(tracker).toBe('ip:::1');
  });
});
