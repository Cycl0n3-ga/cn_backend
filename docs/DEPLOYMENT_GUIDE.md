# DEPLOYMENT_GUIDE.md - 部署指南

線上程式碼評測系統後端 - 完整的部署說明

## 目錄

- [部署概覽](#部署概覽)
- [Docker部署](#docker部署)
- [生產環境配置](#生產環境配置)
- [資料庫部署](#資料庫部署)
- [效能優化](#效能優化)
- [監控和日誌](#監控和日誌)

---

## Docker部署

### 快速啟動

#### 1. 一行指令部署

```bash
# 建立部署設定、構建、執行 migration、啟動服務、等待 health check
npm run deploy

# 查看 API / worker / Redis 日誌
docker compose --env-file .deploy/deploy.env logs -f backend-api judge-worker redis

# 停止服務
docker compose --env-file .deploy/deploy.env down
```

`scripts/deploy.sh` 會自動產生 `.deploy/deploy.env`，其中包含 SQLite DB URL、JWT secret、internal API key、`HOST_PORT`、Redis queue 與 judge 暫存目錄設定。Backend 會映射到 `HOST_PORT`（預設 `4100`），Caddy 另提供 80/443 反向代理。

部署會啟動 `backend-api`、`judge-worker`、`redis` 與 `caddy`。API container 不掛 Docker socket；只有 `judge-worker` 透過 Docker socket 建立隔離的程式執行容器。請只在信任的主機上使用這份預設 Compose 設定。

#### 2. 啟動時灌入种子資料

```bash
SEED_DB=true npm run deploy
```

> 注意：seed 會清空既有資料，只建議在 demo 或測試部署時使用。

#### 3. 直接使用Docker Compose啟動

```bash
docker compose --env-file .deploy/deploy.env up -d --build
```

### Compose 服務角色

| Service        | 角色                                              | 安全邊界                         |
| -------------- | ------------------------------------------------- | -------------------------------- |
| `backend-api`  | HTTP API、auth、submission enqueue、readiness     | non-root、no docker.sock         |
| `judge-worker` | BullMQ worker、Docker sandbox execution、寫回結果 | internal only、mount docker.sock |
| `redis`        | durable queue / retry state                       | not public                       |
| `caddy`        | reverse proxy / TLS                               | public ingress                   |

### 單容器部署

不建議 production 用單容器部署，因為 API 與 judge worker 應分離。若只做本機開發，可以使用 `JUDGE_QUEUE_DRIVER=inline npm run start:dev`；若要 production，請使用 Compose 或等價的多服務部署。

#### 構建镜像

```bash
docker build --target production-api -t code-judge-backend-api:1.0.0 .
docker build --target production-worker -t code-judge-worker:1.0.0 .
```

#### 執行容器

```bash
docker run -d \
  --name code-judge-backend \
  -p 4100:4100 \
  -e DATABASE_URL=file:/app/data/code_judge.db \
  -e JUDGE_QUEUE_DRIVER=redis \
  -e REDIS_URL=redis://redis:6379 \
  -e JWT_SECRET=your-production-secret \
  -e JWT_EXPIRES_IN=86400 \
  -e INTERNAL_API_KEY=internal-key \
  -v backend_data:/app/data \
  code-judge-backend-api:1.0.0
```

此範例仍需要另行啟動 Redis 與 judge worker，否則 submission 只會進入 queue，不會被消費。

### 多容器部署（應用 + 資料庫）

> 目前 repository 內的 Prisma provider 與 migrations 為 SQLite。下方 PostgreSQL compose 範例是規劃/改造參考，不能直接套用現有 migrations；可直接運行的預設部署請使用本專案根目錄的 `docker-compose.yml` 或 `npm run deploy`。

#### docker-compose.yml (生產配置)

```yaml
version: '3.8'

services:
  backend-api:
    image: code-judge-backend:1.0.0
    container_name: code-judge-backend
    ports:
      - '4100:4100'
    environment:
      DATABASE_URL: postgresql://judge_user:${DB_PASSWORD}@db:5432/code_judge
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRES_IN: 86400
      INTERNAL_API_KEY: ${INTERNAL_API_KEY}
      PORT: 4100
      NODE_ENV: production
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./logs:/app/logs
    restart: always
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:4100/api/v1/health/ready']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  db:
    image: postgres:15-alpine
    container_name: code-judge-db
    environment:
      POSTGRES_DB: code_judge
      POSTGRES_USER: judge_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U judge_user']
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  backend_data:
```

#### 啟動生產環境

```bash
# 設置環境變數
export JWT_SECRET="your-very-long-secure-secret-key-here"
export INTERNAL_API_KEY="internal-judge-worker-secret-key"
export DB_PASSWORD="secure-db-password-here"

# 啟動
docker compose -f docker-compose.prod.yml up -d

# 驗證服務狀態
docker compose ps
```

---

## 生產環境配置

### 環境變數清單

**.env.production**

```bash
# 應用配置
NODE_ENV=production
PORT=4100
API_PREFIX=/api/v1

# 資料庫
DATABASE_URL=postgresql://judge_user:password@db.example.com:5432/code_judge

# JWT
JWT_SECRET=<生成的长隨機字符串>
JWT_EXPIRES_IN=86400

# 內部API
INTERNAL_API_KEY=<生成的強金鑰>
INTERNAL_API_ALLOWED_IPS=10.0.0.0/8,192.168.0.0/16

# Judge queue
JUDGE_QUEUE_DRIVER=redis
REDIS_URL=redis://redis:6379
JUDGE_CONCURRENCY=2
JUDGE_JOB_ATTEMPTS=3
JUDGE_STUCK_AFTER_SECONDS=300

# 日誌
LOG_LEVEL=info
```

### Health checks

| Endpoint               | 用途                        |
| ---------------------- | --------------------------- |
| `/api/v1/health/live`  | process liveness            |
| `/api/v1/health/ready` | DB + Redis/BullMQ readiness |
| `/api/v1/health/stats` | dashboard/statistics        |

Docker Compose healthcheck 使用 `/health/ready`，因此 Redis 或 DB 不可用時，API 不會被標記為 healthy。

### Rollback

1. 確認不要設定 `SEED_DB=true`，避免覆蓋正式資料。
2. 切回上一個 git commit 或上一版 image tag。
3. 執行 `docker compose --env-file .deploy/deploy.env up -d --build`。
4. 觀察 `backend-api`、`judge-worker`、`redis` logs。
5. 檢查 `/api/v1/health/ready` 與卡住的 submissions。啟動 recovery 會自動 requeue 超過 `JUDGE_STUCK_AFTER_SECONDS` 的 `PENDING/RUNNING` submission。

### 生成安全金鑰

```bash
# 生成JWT_SECRET
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# 生成INTERNAL_API_KEY
node -e "console.log('INTERNAL_API_KEY=' + require('crypto').randomBytes(32).toString('hex'))"

# 生成資料庫密碼
node -e "console.log('DB_PASSWORD=' + require('crypto').randomBytes(16).toString('hex'))"
```

### 應用啟動命令

```bash
# 構建應用
npm run build

# 執行遷移
npx prisma migrate deploy

# 啟動應用
npm run start:prod
```

---

## 資料庫部署

### PostgreSQL 部署（規劃支援）

> 目前 `prisma/schema.prisma` 與 `prisma/migrations` 是 SQLite 版本。切換 PostgreSQL 前，需先建立 PostgreSQL provider 與對應 migrations。

#### 在服務器上安裝PostgreSQL

**Ubuntu/Debian**

```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib -y

# 啟動服務
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Docker**

```bash
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:15-alpine
```

#### 初始化資料庫

```bash
# 連接PostgreSQL
psql -U postgres

# 建立資料庫
CREATE DATABASE code_judge;

# 建立使用者
CREATE USER judge_user WITH PASSWORD 'secure_password';

# 授予權限
ALTER ROLE judge_user WITH CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE code_judge TO judge_user;

# 退出
\q
```

#### 執行遷移

```bash
# 使用應用的遷移命令
DATABASE_URL=postgresql://judge_user:password@localhost:5432/code_judge \
  npx prisma migrate deploy
```

### 資料庫備份

#### 定期備份策略

```bash
#!/bin/bash
# backup.sh
BACKUP_DIR="/backups/code-judge"
DB_NAME="code_judge"
DB_USER="judge_user"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 建立備份目錄
mkdir -p $BACKUP_DIR

# 執行備份
pg_dump -U $DB_USER -d $DB_NAME | gzip > $BACKUP_DIR/backup_$TIMESTAMP.sql.gz

# 刪除7天前的備份
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete

echo "資料庫備份完成: $BACKUP_DIR/backup_$TIMESTAMP.sql.gz"
```

#### Cron定時備份

```bash
# 每天凌晨2点執行備份
0 2 * * * /usr/local/bin/backup.sh
```

#### 復原備份

```bash
# 解壓備份
gunzip < /backups/code-judge/backup_20250518_020000.sql.gz | psql -U judge_user -d code_judge
```

---

## 效能優化

### 應用層優化

#### 1. 啟用快取

在應用中新增快取層（future feature）

```typescript
// 快取問題列表
@Cacheable('problems', { ttl: 3600 })
async getProblems() {
  return this.prismaService.problem.findMany();
}
```

#### 2. 連接池優化

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")

  // 連接池配置
  directUrl = env("DATABASE_DIRECT_URL")
}
```

#### 3. 查詢優化

```typescript
// ✅ 好：只查詢需要的欄位
await this.prismaService.user.findMany({
  select: {
    id: true,
    username: true,
    rating: true,
  },
  take: 10,
});

// ✅ 好：使用關係加載
await this.prismaService.problem.findMany({
  include: {
    testCases: true,
  },
});
```

### 資料庫層優化

#### 1. 索引優化

```sql
-- 常用查詢索引
CREATE INDEX idx_submission_user_id ON submissions(user_id);
CREATE INDEX idx_submission_problem_id ON submissions(problem_id);
CREATE INDEX idx_submission_status ON submissions(status);
CREATE INDEX idx_user_username ON users(username);
CREATE INDEX idx_problem_difficulty ON problems(difficulty);
```

#### 2. 定期維護

```sql
-- 重建索引
REINDEX INDEX idx_submission_user_id;

-- 清理死元组
VACUUM ANALYZE;

-- 查看表大小
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 網路層優化

#### 1. 啟用GZIP壓缩

```typescript
// main.ts
import * as compression from 'compression';

app.use(compression());
```

#### 2. 啟用CORS

```typescript
// app.module.ts
app.enableCors({
  origin: ['https://example.com', 'https://app.example.com'],
  credentials: true,
});
```

#### 3. 速率限制

```bash
npm install @nestjs/throttler
```

```typescript
// app.module.ts
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
  ],
})
export class AppModule {}
```

---

## 監控和日誌

### 日誌配置

#### Winston日誌程式庫

```bash
npm install winston
```

```typescript
// main.ts
import * as winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});
```

### 健康檢查

```bash
# 檢查應用 readiness
curl http://localhost:4100/api/v1/health/ready

# 響應
{
  "status": "UP",
  "services": {
    "database": "OK",
    "judge_queue": "OK"
  }
}
```

### Prometheus監控（可选）

```bash
npm install @nestjs/terminus prom-client
```

### 錯誤跟踪（Sentry）

```bash
npm install @sentry/node
```

```typescript
// main.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

---

## 部署檢查清單

- [ ] 環境變數已配置
- [ ] 資料庫已建立並遷移
- [ ] SSL/TLS證书已配置
- [ ] 備份策略已實施
- [ ] 監控告警已設置
- [ ] 日誌收集已配置
- [ ] 健康檢查已驗證
- [ ] 效能基準已測試
- [ ] 安全審計已完成
- [ ] 檔案已更新

---

## 故障復原

### 應用崩溃復原

```bash
# 查看容器日誌
docker logs code-judge-backend

# 重新啟動容器
docker restart code-judge-backend

# 查看容器狀態
docker ps | grep code-judge
```

### 資料庫連接問題

```bash
# 測試連接
psql -U judge_user -d code_judge -h localhost

# 查看連接數
SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;
```

---

## 相关檔案

- [SETUP_GUIDE.md](SETUP_GUIDE.md) - 開發環境設置
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - 資料庫模式
- [SECURITY.md](SECURITY.md) - 安全性檔案
- [Dockerfile](../Dockerfile) - Docker配置
