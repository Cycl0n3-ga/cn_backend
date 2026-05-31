import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  function createMockContext(user?: any): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should return true when no roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext({ role: 'CANDIDATE' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should return true when required roles is empty array', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);
    const context = createMockContext({ role: 'CANDIDATE' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should return true when user has the required ADMIN role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    const context = createMockContext({ role: 'ADMIN' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should return true when user has the required CANDIDATE role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['CANDIDATE']);
    const context = createMockContext({ role: 'CANDIDATE' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should return true when ADMIN accesses any role-protected endpoint', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['QUESTIONER']);
    const context = createMockContext({ role: 'ADMIN' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should return true when user role matches one of multiple required roles', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['EXAMINER', 'CANDIDATE']);
    const context = createMockContext({ role: 'CANDIDATE' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException when user role does not match', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    const context = createMockContext({ role: 'CANDIDATE' });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException with correct message', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    const context = createMockContext({ role: 'CANDIDATE' });

    expect(() => guard.canActivate(context)).toThrow(
      'Insufficient permissions.',
    );
  });

  it('should throw ForbiddenException when user is undefined', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    const context = createMockContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when user is null', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    const context = createMockContext(null);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when user has no role property', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    const context = createMockContext({ id: 'user-1', username: 'test' });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should use reflector.getAllAndOverride with handler and class', () => {
    const spy = jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(undefined);
    const context = createMockContext({ role: 'CANDIDATE' });

    guard.canActivate(context);

    expect(spy).toHaveBeenCalledWith('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
  });
});
