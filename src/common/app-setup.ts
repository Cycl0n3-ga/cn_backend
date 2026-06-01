import { INestApplication, ValidationPipe } from '@nestjs/common';
import { LoggingInterceptor } from './logging.interceptor.js';
import { GlobalHttpExceptionFilter } from './http-exception.filter.js';

export function configureHttpApp(app: INestApplication) {
  app.setGlobalPrefix('api/v1');

  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
    : ['http://localhost:3000'];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new GlobalHttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  return app;
}
