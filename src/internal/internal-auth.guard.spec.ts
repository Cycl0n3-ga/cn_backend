import { InternalAuthGuard } from './internal-auth.guard';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

describe('InternalAuthGuard', () => {
  let guard: InternalAuthGuard;
  const VALID_KEY = 'my-secret-internal-key';

  function createMockContext(
    headers: Record<string, string> = {},
  ): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    guard = new InternalAuthGuard();
  });

  afterEach(() => {
    delete process.env.INTERNAL_API_KEY;
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should return true when API key matches', () => {
    process.env.INTERNAL_API_KEY = VALID_KEY;
    const context = createMockContext({ 'x-internal-api-key': VALID_KEY });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw UnauthorizedException when API key does not match', () => {
    process.env.INTERNAL_API_KEY = VALID_KEY;
    const context = createMockContext({ 'x-internal-api-key': 'wrong-key' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException with correct message', () => {
    process.env.INTERNAL_API_KEY = VALID_KEY;
    const context = createMockContext({ 'x-internal-api-key': 'wrong-key' });

    expect(() => guard.canActivate(context)).toThrow(
      'Invalid or missing internal API key.',
    );
  });

  it('should throw UnauthorizedException when API key header is missing', () => {
    process.env.INTERNAL_API_KEY = VALID_KEY;
    const context = createMockContext({});

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when INTERNAL_API_KEY env is not set', () => {
    delete process.env.INTERNAL_API_KEY;
    const context = createMockContext({ 'x-internal-api-key': 'any-key' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when both env and header are empty strings', () => {
    process.env.INTERNAL_API_KEY = '';
    const context = createMockContext({ 'x-internal-api-key': '' });

    // Empty string is falsy, so !expectedKey evaluates to true
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should read key from x-internal-api-key header (lowercase)', () => {
    process.env.INTERNAL_API_KEY = VALID_KEY;
    const context = createMockContext({ 'x-internal-api-key': VALID_KEY });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should be case-sensitive for the API key value', () => {
    process.env.INTERNAL_API_KEY = 'MySecretKey';
    const context = createMockContext({ 'x-internal-api-key': 'mysecretkey' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
