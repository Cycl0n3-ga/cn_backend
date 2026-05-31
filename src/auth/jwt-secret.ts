import { randomBytes } from 'node:crypto';
import { Logger } from '@nestjs/common';

let ephemeralSecret: string | null = null;

export function resolveJwtSecret(): string {
  const envSecret = process.env.JWT_SECRET;
  if (envSecret && envSecret.length >= 32) {
    return envSecret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET environment variable is required in production and must be at least 32 characters.',
    );
  }
  if (!ephemeralSecret) {
    ephemeralSecret = randomBytes(32).toString('hex');
    new Logger('AuthModule').warn(
      'JWT_SECRET not set or too short. Using ephemeral random secret.',
    );
  }
  return ephemeralSecret;
}
