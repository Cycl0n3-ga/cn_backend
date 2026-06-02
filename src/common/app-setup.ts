import { INestApplication, ValidationPipe } from '@nestjs/common';
import { LoggingInterceptor } from './logging.interceptor.js';
import { GlobalHttpExceptionFilter } from './http-exception.filter.js';

export function configureHttpApp(app: INestApplication) {
  app.setGlobalPrefix('api/v1');

  const rawOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
    : ['http://localhost:3000', 'https://cn-22.vercel.app'];

  const allowedOrigins: (string | RegExp)[] = [];

  for (const origin of rawOrigins) {
    if (origin.includes('*')) {
      // Convert wildcard (e.g. "https://*.vercel.app") to a RegExp object
      const escaped = origin.replace(/[.+*?^${}()|[\]\\]/g, '\\$&');
      const regexStr = '^' + escaped.replace(/\\\*/g, '.*') + '$';
      allowedOrigins.push(new RegExp(regexStr));
    } else {
      allowedOrigins.push(origin);

      // Automatically support Vercel dynamic preview domains if a Vercel domain is configured
      const vercelMatch = origin.match(/^https:\/\/([a-zA-Z0-9_.-]+)\.vercel\.app$/);
      if (vercelMatch) {
        const projectName = vercelMatch[1];
        allowedOrigins.push(new RegExp(`^https://${projectName}-[a-zA-Z0-9_.-]+\\.vercel\\.app$`));
      }
    }
  }

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
