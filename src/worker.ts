import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { JudgeWorkerModule } from './judge-worker.module.js';
import { validateRuntimeEnv } from './config/env.js';

async function bootstrap() {
  validateRuntimeEnv('worker');
  const app = await NestFactory.createApplicationContext(JudgeWorkerModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });
  app.enableShutdownHooks();
  new Logger('JudgeWorker').log('Judge worker started.');
}

void bootstrap();
