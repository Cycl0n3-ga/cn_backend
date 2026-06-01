import { Logger } from '@nestjs/common';

const logger = new Logger('Env');

export type RuntimeProcess = 'api' | 'worker' | 'test';

export function isProduction() {
  return process.env.NODE_ENV === 'production';
}

export function getQueueDriver() {
  const configured = (process.env.JUDGE_QUEUE_DRIVER || '').trim();

  if (isProduction()) {
    return configured === 'inline' ? 'inline' : 'redis';
  }

  return configured === 'redis' ? 'redis' : 'inline';
}

export function getPositiveIntEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (raw == null || raw === '') {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

export function getRedisUrl() {
  return process.env.REDIS_URL || 'redis://localhost:6379';
}

export function validateRuntimeEnv(processName: RuntimeProcess) {
  const env = process.env;
  const isProductionEnv = env.NODE_ENV === 'production';
  const effectiveQueueDriver =
    env.NODE_ENV === 'production'
      ? (env.JUDGE_QUEUE_DRIVER ?? 'redis')
      : env.JUDGE_QUEUE_DRIVER === 'redis'
        ? 'redis'
        : 'inline';

  if (isProductionEnv) {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error(
        'JWT_SECRET is required in production and must be at least 32 characters.',
      );
    }
    if (
      !process.env.INTERNAL_API_KEY ||
      process.env.INTERNAL_API_KEY.length < 32
    ) {
      throw new Error(
        'INTERNAL_API_KEY is required in production and must be at least 32 characters.',
      );
    }
    if (
      isProductionEnv &&
      effectiveQueueDriver !== 'inline' &&
      effectiveQueueDriver !== 'redis'
    ) {
      throw new Error('JUDGE_QUEUE_DRIVER must be either "inline" or "redis".');
    }
    if (effectiveQueueDriver !== 'redis') {
      throw new Error('JUDGE_QUEUE_DRIVER must be "redis" in production.');
    }
    if (isProductionEnv && effectiveQueueDriver === 'redis' && !env.REDIS_URL) {
      throw new Error(
        'REDIS_URL is required when using the Redis judge queue.',
      );
    }
  }

  if (processName === 'worker' && effectiveQueueDriver !== 'redis') {
    logger.warn(
      'Judge worker started with inline queue driver. No durable Redis jobs will be consumed.',
    );
  }
}
