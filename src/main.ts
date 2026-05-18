import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Validation pipe for DTO validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle('Code Judge API')
    .setDescription(
      `## Online Code Judge 後端 API

完整的線上程式評測系統 API，支援：
- 🔐 JWT 認證與 RBAC 授權
- 📝 題目管理（CRUD + 指派）
- 🚀 程式碼提交與非同步評測
- 📊 排行榜
- 💓 系統健康檢查
- 🔒 內部評測機 API

### 認證方式
使用 \`POST /api/v1/auth/login\` 取得 JWT Token，然後在需要認證的端點加上 \`Authorization: Bearer <token>\` Header。

### 密碼傳輸規範
本專案的 \`/auth/login\` 與 \`/auth/signup\` 之 \`password\` 欄位 **必須是前端計算完成的 SHA-256 (hex) 字串**（長度 64）。
後端會將此值再以 bcrypt 儲存/比對。

### 測試帳號
| 帳號 | 明文密碼（僅供人類閱讀） | password (sha256 hex) | 角色 |
|------|------|------|
| admin | admin123 | 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9 | ADMIN |
| alice | user123 | e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446 | USER |
| bob | user123 | e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446 | USER |`,
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addServer(`http://localhost:${process.env.PORT || 4100}`, 'Local Development')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
    },
    customSiteTitle: 'Code Judge API Docs',
  });

  const port = process.env.PORT ?? 4100;
  await app.listen(port);
  console.log(`\n🚀 Code Judge API running on http://localhost:${port}`);
  console.log(`📚 Swagger UI: http://localhost:${port}/api/docs`);
  console.log(`🔑 API Base: http://localhost:${port}/api/v1\n`);
}
bootstrap();
