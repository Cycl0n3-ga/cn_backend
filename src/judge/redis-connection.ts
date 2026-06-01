import IORedis from 'ioredis';
import { getRedisUrl } from '../config/env.js';

export function createRedisConnectionOptions() {
  const url = new URL(getRedisUrl());
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
  };
}

export function createRedisConnection() {
  return new IORedis(getRedisUrl(), {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}
