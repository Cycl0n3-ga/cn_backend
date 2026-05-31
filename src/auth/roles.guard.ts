import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator.js';
import { hasUserRole, UserRole } from './user-role.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles) {
      return true;
    }
    const request = context.switchToHttp().getRequest<{
      user?: { role: string };
    }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Insufficient permissions.');
    }

    if (
      !hasUserRole(user.role, UserRole.ADMIN) &&
      !requiredRoles.includes(user.role)
    ) {
      throw new ForbiddenException('Insufficient permissions.');
    }
    return true;
  }
}
