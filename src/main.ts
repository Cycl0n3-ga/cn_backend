import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { configureHttpApp } from './common/app-setup.js';
import { validateRuntimeEnv } from './config/env.js';

function buildSwaggerDescription() {
  const baseDescription = `## Online Code Judge 後端 API

完整的線上程式評測系統 API，支援：
- JWT 認證與 RBAC 授權
- 題目管理（CRUD + 指派）
- 程式碼提交與非同步評測
- Redis/BullMQ durable judge queue
- API / judge worker 分離
- 系統健康檢查與 readiness
- 內部評測機 API

### 認證方式
使用 \`POST /api/v1/auth/login\` 取得 JWT Token，然後在需要認證的端點加上 \`Authorization: Bearer <token>\` Header。

### 密碼傳輸規範
本專案的 \`/auth/login\` 與 \`/auth/signup\` 之 \`passwordSha256\` 欄位必須是前端計算完成的 SHA-256 hex 字串（長度 64）。
後端會將此值再以 bcrypt 儲存/比對。`;

  if (process.env.NODE_ENV === 'production') {
    return baseDescription;
  }

  return `${baseDescription}

### 測試帳號（僅非 production 顯示）
| 帳號 | 明文密碼（僅供人類閱讀） | passwordSha256 | 角色 |
|------|------|------|------|
| admin | admin123 | 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9 | ADMIN |
| examiner | user123 | e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446 | EXAMINER |
| questioner | user123 | e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446 | QUESTIONER |
| alice | user123 | e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446 | CANDIDATE |
| bob | user123 | e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446 | CANDIDATE |`;
}

async function bootstrap() {
  validateRuntimeEnv('api');
  const app = await NestFactory.create(AppModule);
  configureHttpApp(app);

  // Swagger / OpenAPI
  const configBuilder = new DocumentBuilder()
    .setTitle('Code Judge API')
    .setDescription(buildSwaggerDescription())
    .setVersion('1.0')
    .addBearerAuth();

  const domainName = process.env.DOMAIN_NAME;
  const port = process.env.PORT ?? 4100;

  if (domainName) {
    const cleanDomain = domainName.startsWith('http')
      ? domainName
      : `http://${domainName}`;
    configBuilder.addServer(cleanDomain, 'Remote Server (HTTP)');
    if (!domainName.startsWith('http')) {
      configBuilder.addServer(`https://${domainName}`, 'Remote Server (HTTPS)');
    }
  }

  configBuilder.addServer(`http://localhost:${port}`, 'Local Development');
  configBuilder.addServer('/', 'Auto-detect Host (Relative)');

  const config = configBuilder.build();

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

  await app.listen(port);
  console.log(`\n🚀 Code Judge API running on http://localhost:${port}`);
  console.log(`📚 Swagger UI: http://localhost:${port}/api/docs`);
  console.log(`🔑 API Base: http://localhost:${port}/api/v1\n`);
}
void bootstrap();
