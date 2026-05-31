import { BadRequestException } from '@nestjs/common';

export enum UserRole {
  ADMIN = 'ADMIN',
  EXAMINER = 'EXAMINER',
  QUESTIONER = 'QUESTIONER',
  CANDIDATE = 'CANDIDATE',
}

export const USER_ROLES = Object.values(UserRole);
export const DEFAULT_USER_ROLE = UserRole.CANDIDATE;

export function hasUserRole(
  role: string | null | undefined,
  expectedRole: UserRole,
) {
  return role === (expectedRole as string);
}

export function hasAnyUserRole(
  role: string | null | undefined,
  expectedRoles: readonly UserRole[],
) {
  return expectedRoles.some((expectedRole) => hasUserRole(role, expectedRole));
}

export function normalizeUserRole(role?: string | null): UserRole {
  if (!role) {
    return DEFAULT_USER_ROLE;
  }

  const normalized = role.toUpperCase();
  if (USER_ROLES.includes(normalized as UserRole)) {
    return normalized as UserRole;
  }

  throw new BadRequestException(
    `role must be one of: ${USER_ROLES.join(', ')}.`,
  );
}

export function normalizeEmail(email?: string | null) {
  if (email == null) {
    return null;
  }

  const normalized = email.trim();
  return normalized.length > 0 ? normalized : null;
}
