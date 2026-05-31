# Code Judge Backend 架構介紹

> Online Code Judge 後端系統架構檔案

---

## 1. 系統概述

本系統是一個 **Online Code Judge（線上程庫評測系統）** 的後端服務，使用 NestJS 框架構建，提供題目管理、程庫碼提交與評測、使用者管理、排行榜等核心功能。

### 技術棧

| 層級 | 技術 |
|------|------|
| **框架** | NestJS 11 (TypeScript) |
| **ORM** | Prisma 7 |
| **資料庫** | SQLite（目前預設/可直接運行：Prisma driver adapter + migrations + seed）／PostgreSQL（規劃：需另行提供對應 provider 與 migrations） |
| **認證** | JWT + Passport |
| **密碼雜湊** | bcryptjs（儲存 `bcrypt(sha256(password))`） |
| **API 檔案** | Swagger / OpenAPI 3.0 |
| **測試** | Jest（Unit/Integration/E2E）+ Supertest（E2E）+ autocannon（Load/Stress/Perf） |

---

## 2. 系統架構圖

> 下圖為 **可擴展目標架構**。本 repo 目前可直接運行的實作為：單體 NestJS API + SQLite + Mock Judge（無獨立 Queue/Worker）。

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (SPA)                     │
│              React / Vue / Angular                    │
│         (傳送 sha256(password)，不傳明文)              │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP/HTTPS
                       ▼
┌──────────────────────────────────────────────────────┐
│               API Gateway / Nginx                     │
│           (Reverse Proxy + Load Balancer)             │
└──────────────────────┬──────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌──────────┐   ┌──────────┐   ┌──────────┐
│ NestJS   │   │ NestJS   │   │ NestJS   │
│ Instance │   │ Instance │   │ Instance │
│    #1    │   │    #2    │   │    #3    │
└────┬─────┘   └────┬─────┘   └────┬─────┘
     │              │              │
     └──────────────┼──────────────┘
                    │
        ┌───────────┼───────────┐
        ▼                       ▼
┌──────────────┐      ┌──────────────────┐
│   Database   │      │   Message Queue   │
│ PostgreSQL   │      │  (Redis/RabbitMQ) │
└──────────────┘      └────────┬─────────┘
                               │
                    ┌──────────┼──────────┐
                    ▼          ▼          ▼
              ┌─────────┐ ┌────────┐ ┌────────┐
              │ Judge   │ │ Judge  │ │ Judge  │
              │ Worker  │ │ Worker │ │ Worker │
              │   #1    │ │   #2   │ │   #3   │
              └─────────┘ └────────┘ └────────┘
                 (Docker Sandbox Execution)
```

> ⚠️ 目前開發版本使用模擬評測（Mock Judge），Judge Worker 部分尚未實作。
> 生產環境應使用 Docker 容器隔離執行使用者程庫碼。

---

## 3. 模組架構

```
src/
├── main.ts                    # 應用程庫入口 (Swagger, CORS, Validation)
├── app.module.ts              # 根模組
│
├── auth/                      # 🔐 認證模組
│   ├── auth.module.ts
│   ├── auth.controller.ts     # POST /auth/login, /auth/signup
│   ├── auth.service.ts        # JWT 簽發、密碼驗證
│   ├── auth.controller.spec.ts  # 9 個測試
│   ├── auth.service.spec.ts     # 21 個測試
│   ├── jwt.strategy.ts        # Passport JWT 策略
│   ├── jwt.strategy.spec.ts   # 6 個測試 ⬅ 新增
│   ├── jwt-auth.guard.ts      # JWT 認證 Guard
│   ├── roles.guard.ts         # RBAC 角色 Guard
│   ├── roles.guard.spec.ts    # 11 個測試 ⬅ 新增
│   ├── roles.decorator.ts     # @Roles() 裝飾器
│   └── dto/
│       ├── index.ts
│       ├── login.dto.ts       # LoginDto (username + passwordSha256)
│       └── signup.dto.ts      # SignupDto (username + email + passwordSha256 + role?)
│
├── problems/                  # 📝 題目管理模組
│   ├── problems.module.ts
│   ├── problems.controller.ts # CRUD + Assign
│   ├── problems.controller.spec.ts  # 24 個測試 ⬅ 重寫
│   ├── problems.service.ts    # 業務邏輯
│   ├── problems.service.spec.ts     # 27 個測試
│   └── dto/
│       ├── index.ts
│       └── problem.dto.ts     # CreateProblemDto, AssignProblemDto
│
├── submissions/               # 🚀 評測提交模組
│   ├── submissions.module.ts
│   ├── submissions.controller.ts    # POST submit, GET poll
│   ├── submissions.controller.spec.ts  # 11 個測試 ⬅ 重寫
│   ├── submissions.service.ts       # 提交 + Mock Judge
│   ├── submissions.service.spec.ts  # 23 個測試
│   └── dto/
│       ├── index.ts
│       └── submission.dto.ts  # CreateSubmissionDto
│
├── users/                     # 👤 使用者模組
│   ├── users.module.ts
│   ├── users.controller.ts    # 列表 + 提交歷史
│   ├── users.controller.spec.ts  # 8 個測試
│   ├── users.service.ts
│   └── users.service.spec.ts     # 17 個測試
│
├── leaderboard/               # 🏆 排行榜模組
│   ├── leaderboard.module.ts
│   ├── leaderboard.controller.ts
│   ├── leaderboard.controller.spec.ts  # 8 個測試 ⬅ 重寫
│   ├── leaderboard.service.ts
│   └── leaderboard.service.spec.ts     # 8 個測試
│
├── health/                    # 💓 健康檢查模組
│   ├── health.module.ts
│   ├── health.controller.ts
│   └── health.controller.spec.ts  # 9 個測試
│
├── internal/                  # 🔒 內部 API 模組（供 Judge Worker 使用）
│   ├── internal.module.ts
│   ├── internal.controller.ts       # GET /internal/testcases/:id
│   ├── internal.controller.spec.ts  # 9 個測試
│   ├── internal-auth.guard.ts       # API Key Guard（x-internal-api-key）
│   └── internal-auth.guard.spec.ts  # 9 個測試 ⬅ 新增
│
├── interviews/                # 🎤 面試管理模組
│   ├── interviews.module.ts
│   ├── interviews.controller.ts     # CRUD
│   ├── interviews.controller.spec.ts  # 14 個測試 ⬅ 重寫
│   ├── interviews.service.ts
│   ├── interviews.service.spec.ts     # 12 個測試
│   └── dto/
│       └── interview.dto.ts   # CreateInterviewDto, UpdateInterviewDto
│
├── interview-candidates/      # 👥 面試候選人模組
│   ├── interview-candidates.module.ts
│   ├── interview-candidates.controller.ts
│   ├── interview-candidates.controller.spec.ts  # 19 個測試
│   ├── interview-candidates.service.ts
│   ├── interview-candidates.service.spec.ts     # 17 個測試
│   └── dto/
│       └── interview-candidate.dto.ts
│
├── assignments/               # 📋 指派模組
│   ├── assignments.module.ts
│   ├── assignments.controller.ts
│   ├── assignments.service.ts
│   └── dto/
│       └── assignment.dto.ts
│
├── judge/                     # ⚖️ 內部評測核心模組
│   ├── judge.module.ts
│   └── judge.service.ts
│
└── prisma/                    # 🗄️ 資料庫模組
    ├── prisma.module.ts
    └── prisma.service.ts
   └── prisma.service.spec.ts  # 3 個測試 ⬅ 新增
```

---

## 4. 資料模型 (Database Schema)

```
┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│     User     │     │    Problem    │     │   TestCase   │
├──────────────┤     ├───────────────┤     ├──────────────┤
│ id (UUID)    │     │ id (Auto)     │────▸│ id (Auto)    │
│ username     │     │ title         │     │ problemId    │
│ email        │     │ description   │     │ input        │
│ passwordHash │     │ difficulty    │     │ output       │
│ role         │     │ timeLimitMs   │     │ isHidden     │
│ solvedCount  │     │ memoryLimitMb │     └──────────────┘
│ rating       │     │ functionName? │
│ createdAt    │     │ acceptanceRate│
│ updatedAt    │     │ isDeleted     │
└──────┬───────┘     │ createdAt     │
       │             │ updatedAt     │
       │             └───────┬───────┘
       │                     │
       │    ┌────────────────┴────────────────┐
       │    │                                  │
       ▼    ▼                                  ▼
┌──────────────────┐               ┌──────────────────┐
│    Submission    │               │    Assignment    │
├──────────────────┤               ├──────────────────┤
│ id (UUID)        │               │ id (Auto)        │
│ userId ──────────┤               │ problemId ───────┤
│ problemId ───────┤               │ userId ──────────┤
│ language         │               │ createdAt        │
│ sourceCode       │               └──────────────────┘
│ status           │
│ score            │
│ userOutput?      │   ← 使用者程庫輸出
│ compileMessage   │
│ executionTimeMs? │
│ memoryUsageKb?   │
│ createdAt        │
└──────────────────┘

┌──────────────────┐               ┌──────────────────────┐
│    Interview     │               │  InterviewCandidate  │
├──────────────────┤               ├──────────────────────┤
│ id (Auto)        │               │ id (Auto)            │
│ jobRole          │               │ jobId ───────────────┤─▸ Interview.id
│ examinerEmpId ───┤─▸ User.id     │ userId ──────────────┤─▸ User.id
│                  │               │ startTime? (Unix sec)│
│                  │               │ endTime? (Unix sec)  │
│ createdAt        │               │ createdAt            │
│ updatedAt        │               │ [UNIQUE: jobId+userId]│
└──────────────────┘               └──────────────────────┘
```

### Submission Status 狀態機

```
     ┌─────────┐
     │ PENDING │   ← 提交後初始狀態
     └────┬────┘
          │
     ┌────▼────┐
     │COMPILING│
     └────┬────┘
          │
    ┌─────┴─────┐
    │           │
    ▼           ▼
┌───────┐  ┌──────────────┐
│RUNNING│  │COMPILE_ERROR │
└───┬───┘  └──────────────┘
    │
    ├──────────────────────┬───────────────────┐
    │          │           │          │         │
    ▼          ▼           ▼          ▼         ▼
┌────────┐ ┌──────────┐ ┌───┐  ┌──────┐  ┌────────────┐
│ACCEPTED│ │WRONG_ANS │ │TLE│  │ MLE  │  │RUNTIME_ERR │
└────────┘ └──────────┘ └───┘  └──────┘  └────────────┘
```

---

## 5. 密碼安全規範

### 前端責任
前端在送出登入或註冊請求前，**必須先在 client 端計算 SHA-256 雜湊**：

```javascript
// 前端 JavaScript
const sha256Hash = await crypto.subtle.digest(
  'SHA-256',
  new TextEncoder().encode(plainPassword)
);
const passwordSha256 = Array.from(new Uint8Array(sha256Hash))
  .map(b => b.toString(16).padStart(2, '0'))
  .join('');
// 結果為 64 位 hex 字串，例如 "240be518fabd2724..."
```

### 後端儲存
後端**再次以 bcrypt 雜湊**後儲存，永遠不儲存明文密碼或 SHA-256 值：

```
儲存於 DB 的 passwordHash = bcrypt(sha256(plainPassword), cost=10)
```

### 驗證流程
```
Client: sha256(plainPassword) → "240be518..."
Request Body: { passwordSha256: "240be518..." }
Server: bcrypt.compare("240be518...", user.passwordHash) → true/false
```

### 測試帳號

| 帳號 | 明文密碼（人類閱讀） | passwordSha256 (64 位 hex) | 角色 |
|------|---------------------|---------------------------|------|
| `admin` | `admin123` | `240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9` | ADMIN |
| `examiner` | `user123` | `e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446` | EXAMINER |
| `questioner` | `user123` | `e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446` | QUESTIONER |
| `alice` | `user123` | `e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446` | CANDIDATE |
| `bob` | `user123` | `e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446` | CANDIDATE |

---

## 6. 認證與授權流程

### JWT 認證流程

```
Client                          Server
  │                                │
  │  POST /api/v1/auth/login       │
  │  { username,                   │
  │    passwordSha256: sha256(pwd) }│
  │ ──────────────────────────────▸│
  │                                │──▸ findUnique(username)
  │                                │──▸ bcrypt.compare(sha256, passwordHash)
  │                                │──▸ jwtService.signAsync({sub, username, role})
  │  { token, expires_in,          │
  │    user_role }                 │
  │ ◂──────────────────────────────│
  │                                │
  │  GET /api/v1/problems          │
  │  (公開端點，不需 token)          │
  │ ──────────────────────────────▸│
  │                                │
  │  POST /api/v1/submissions      │
  │  Authorization: Bearer <token> │
  │ ──────────────────────────────▸│
  │                                │──▸ JwtAuthGuard: 驗證 token
  │                                │──▸ 得得 req.user.id
  │  { submission_id, PENDING }    │
  │ ◂──────────────────────────────│
```

### RBAC 角色控制

| 角色 | 權限 |
|------|------|
| `ADMIN` | 系統管理者，可通過所有角色保護端點 |
| `EXAMINER` | 建立/修改/刪除面試、管理面試候選人、指派面試題目 |
| `QUESTIONER` | 建立/刪除題目、指派題目 |
| `CANDIDATE` | 查看題目、提交程式碼、查看排行榜、查詢自己的測驗時間狀態 |

---

## 7. 程庫碼評測流程

### 目前版本（模擬評測）

```
1. 使用者提交程庫碼
   POST /api/v1/submissions { problem_id, language, source_code }
   
2. 系統建立 Submission 記錄 (status: PENDING)
   回傳 202 Accepted + submission_id

3. [模擬] 非同步評測開始（setTimeout 模擬延遲）
   status: PENDING → COMPILING (500ms)
   
4. [模擬] 執行中
   status: COMPILING → RUNNING (1000ms)
   
5. [模擬] 得得測資（從 DB）
   查詢 TestCase 表
   
6. [模擬] 隨機產生結果（ACCEPTED 偏高機率）
   status → ACCEPTED / WRONG_ANSWER / ...
   
7. 更新 Submission 結果 + 使用者統計（若 ACCEPTED 則 solvedCount++, rating+=10）

8. 前端輪詢 GET /api/v1/submissions/{id} 得得最終結果
```

### 生產環境應有架構（Code Runner 實作規劃）

**實作位置：**

```
src/submissions/submissions.service.ts
  └── create() 方法中，改為將 job 推入 Message Queue（得程庫 simulateJudging()）

workers/                           ← 獨立 process / container
  └── judge-worker/
      ├── worker.ts                # 消費 Queue job 的主程序
      ├── sandbox.ts               # Docker/nsjail 沙盒執行邏輯
      └── result-handler.ts        # 將結果寫回 DB
```

**完整生產評測流程：**

```
1. POST /submissions
   → SubmissionsService.create() 建立 Submission (PENDING)
   → 推送 job { submissionId, problemId, language, sourceCode } 至 Redis/RabbitMQ

2. Judge Worker（獨立 process）監聽 Queue
   → 拉得 job
   → 呼叫 GET /api/v1/internal/testcases/{problemId}
     （帶 x-internal-api-key，得得含隱藏測資的完整測資）
   → 更新 Submission status: COMPILING

3. Docker Sandbox 執行使用者程庫碼
   → 建立隔離容器（限制 CPU / 記憶體 / 網路）
   → 執行程庫，比對各測資輸出
   → 測數執行時間 / 記憶體用數

4. 結果寫回 DB
   → 更新 Submission status (ACCEPTED / WRONG_ANSWER / TLE / MLE / etc.)
   → 更新 User.solvedCount / User.rating

5. 前端繼續輪詢 GET /submissions/{id} 直到 status 為終態
```

**所需額外相賴（生產）：**
- `bullmq` — Redis-based queue
- `ioredis` — Redis 連線
- `dockerode` — Docker API
- `@nestjs/bull` — NestJS Queue 整合

---

## 8. 與主流 Code Judge API 架構之比較

本系統的 API 設計參考了目前業界主流的 Online Judge (OJ) 平台（如 LeetCode, HackerRank, Judge0），並做了部分簡化以適合獨立部署。

### 1.非同步評測模型 (Asynchronous Execution)
- **主流作法 (Judge0, HackerRank)**：提交程庫碼後回傳 `token` 或 `submission_id`，客戶端透過輪詢 (Polling) 或 Webhook 得得最終結果。
- **本系統作法**：與主流完全一致。`POST /api/v1/submissions` 回傳 202 Accepted 與 `submission_id`，客戶端透過輪詢 `GET /api/v1/submissions/:id` 得得狀態。

### 2. 隔離執行與安全性 (Sandbox Security)
- **主流作法 (LeetCode)**：將使用者程庫碼放入高度受限的 Docker 容器或 nsjail 中執行，嚴格限制系統呼叫 (Syscalls)、網路存得與資源配額 (CPU/Memory limits)。
- **本系統作法**：架構上已預留 `Internal API` 供獨立 Worker 存得隱藏測資，確保測試資料不外洩給 API 端點。未來的 Judge Worker 將實作 Docker Sandbox，完全符合業界安全標準。

### 3. 可擴展性與部署 (Scalability & Deployment)
- **無狀態 API (Stateless API)**：本系統的 API 層（NestJS）為完全無狀態，相賴 JWT 進行認證，可輕易部署於 Kubernetes 並透過 Load Balancer 進行水平擴展 (Horizontal Pod Autoscaling)。
- **資料庫擴展 (Database Scaling)**：預設提供 SQLite 供快速啟動，但架構上使用 Prisma ORM，生產環境只需更改 `DATABASE_URL` 即可無縫切換至 PostgreSQL，並可配置 Connection Pooling。
- **快得機制預留 (Caching)**：排行榜 (`GET /leaderboard`) 等高頻讀得 API，未來可直接整合 Redis Cache 降低資料庫負擔。

---

## 9. 環境變數 (.env)

| 變數名稱 | 必填 | 說明 | 預設值（開發） |
|---------|------|------|----------------|
| `DATABASE_URL` | ✅ | 資料庫連線字串 | `file:./dev.db` |
| `JWT_SECRET` | ✅ | JWT 簽署密鑰（生產須隨機生成） | `code-judge-dev-secret-key-change-in-production` |
| `JWT_EXPIRES_IN` | ✅ | JWT 有效期（秒） | `3600` |
| `PORT` | ✅ | 伺服器監聽 Port | `4100` |
| `INTERNAL_API_KEY` | ✅ | 內部評測機 API Key（生產須隨機生成） | `internal-judge-worker-key-change-in-production` |

> ⚠️ **生產環境注意事項：**
> - `JWT_SECRET` 必須是至少 256-bit 的隨機字串
> - `INTERNAL_API_KEY` 必須是高熵隨機字串
> - 若要切換 PostgreSQL：需搭配對應的 Prisma `provider` 與 migrations（本 repo 目前 migrations 為 SQLite 產出，避免直接套用造成 migration 失敗）。

---

## 9. 開發環境設定

### 前置需求

- Node.js 20+
- npm 10+

### 啟動步驟

```bash
# 1. 安裝相賴
npm install

# 2. 建立 .env 檔案（已有 .env.example 可複製）
cp .env.example .env

# 3. 執行資料庫遷移
npx prisma migrate dev

# 4. 填入種子資料（3 個使用者 + 5 道題目 + 範例提交）
npx ts-node prisma/seed.ts
# 或使用 npm script:
npm run db:seed

# 5. 啟動開發伺服器
npm run start:dev
```

### 有用的指令

```bash
npm run start:dev           # 開發模庫（hot reload）
npm run build               # 建置生產版本
npm run test                # 執行所有單元測試
npm run test -- --verbose   # 詳細測試輸出
npm run test:cov            # 測試涵蓋率報告
npm run test:e2e            # E2E 整合測試
npm run test:load           # 壓力/負載測試（使用 autocannon）
bash test/api-test.sh       # Shell 整合測試（需先啟動伺服器）
npx prisma studio           # Prisma 資料庫 GUI
npm run db:migrate          # 執行資料庫遷移
npm run db:seed             # 填入種子資料
```

### 容器化與擴展性 (Docker & Scalability)

為了確保系統容易部署並具備橫向擴展的能力，專案已經配置了 `Dockerfile` 與 `docker-compose.yml`：

```bash
# 建立並啟動 Backend API (SQLite)
docker compose up -d --build

# （可選）啟動時灌入 demo seed data（⚠️ seed 會清空既有資料）
SEED_DB=true docker compose up -d --build

# 停止並移除容器
docker compose down
```

使用 Docker 部署的好處：
1. **環境一致性**：開發與生產環境完全一致。
2. **零外部相賴（目前）**：預設使用 SQLite DB 檔案並持久化在 volume。
3. **可擴展性（規劃）**：未來可加入 Queue/Worker/外部 DB（PostgreSQL/Redis），並透過 Kubernetes 水平擴充。

---

## 10. API 端點總覽

| # | Method | Path | 認證 | 說明 |
|---|--------|------|------|------|
| 1 | `POST` | `/api/v1/auth/login` | ❌ | 使用者登入（傳 passwordSha256） |
| 2 | `POST` | `/api/v1/auth/signup` | ❌ | 使用者註冊（傳 passwordSha256） |
| 3 | `GET` | `/api/v1/problems` | ❌ | 題目列表（分頁 + 難度篩選） |
| 4 | `GET` | `/api/v1/problems/:id` | ❌ | 題目詳情（含公開測資） |
| 5 | `POST` | `/api/v1/problems` | 🔒 ADMIN / QUESTIONER | 新增題目 |
| 6 | `DELETE` | `/api/v1/problems/:id` | 🔒 ADMIN / QUESTIONER | 軟刪除題目 |
| 7 | `POST` | `/api/v1/problems/:id/assign` | 🔒 ADMIN / EXAMINER / QUESTIONER | 指派題目給使用者 |
| 8 | `POST` | `/api/v1/submissions` | 🔒 ADMIN / CANDIDATE | 提交程庫碼（非同步評測） |
| 9 | `GET` | `/api/v1/submissions/:id` | ❌ | 輪詢評測結果 |
| 10 | `GET` | `/api/v1/users` | ❌ | 使用者列表 |
| 11 | `GET` | `/api/v1/users/:username/submissions` | ❌ | 使用者提交歷史 |
| 12 | `GET` | `/api/v1/leaderboard` | ❌ | 全站排行榜 |
| 13 | `GET` | `/api/v1/health` | ❌ | 系統健康檢查 |
| 14 | `GET` | `/api/v1/internal/testcases/:id` | 🔑 Internal Key | 評測機得得測資（含隱藏） |
| 15 | `POST` | `/api/v1/interviews` | 🔒 ADMIN / EXAMINER | 建立面試 |
| 16 | `GET` | `/api/v1/interviews` | ❌ | 得得面試列表 |
| 17 | `PATCH` | `/api/v1/interviews/:id` | 🔒 ADMIN / EXAMINER | 更新面試 jobRole |
| 18 | `DELETE` | `/api/v1/interviews/:id` | 🔒 ADMIN / EXAMINER | 刪除面試 |
| 19 | `POST` | `/api/v1/interview-candidates` | 🔒 ADMIN / EXAMINER | 新增面試候選人 |
| 20 | `GET` | `/api/v1/interview-candidates` | ❌ | 取得所有面試考生列表 |
| 21 | `PATCH` | `/api/v1/interview-candidates/:id/time` | 🔒 ADMIN / EXAMINER | 更新面試候選人測驗時間 |
| 22 | `GET` | `/api/v1/interview-candidates/:id/time-status` | 🔒 ADMIN / EXAMINER / CANDIDATE | 取得伺服器時間與剩餘時間 |
| 23 | `DELETE` | `/api/v1/interview-candidates/:id` | 🔒 ADMIN / EXAMINER | 移除面試候選人 |
| 24 | `POST` | `/api/v1/assignments` | 🔒 ADMIN / EXAMINER / QUESTIONER | 指派題目給考生 |
| 25 | `GET` | `/api/v1/assignments` | ❌ | 取得題目指派列表 |
| 26 | `GET` | `/api/v1/assignments/user/:userId` | ❌ | 取得特定使用者的指派 |
| 27 | `GET` | `/api/v1/assignments/:id` | ❌ | 取得單一指派 |
| 28 | `DELETE` | `/api/v1/assignments/:id` | 🔒 ADMIN / EXAMINER / QUESTIONER | 刪除題目指派 |

---

## 11. 測試策略與涵蓋率

### 測試金字塔

```
   ╱  Stress/Load/Perf  ╲    ← 3 腳本（autocannon）
       ╱       E2E Tests       ╲   ← 65 個測試（自動建 DB + migrations + seed）
      ╱   Integration Tests     ╲   ← Jest 13 個測試（真實 DB）
     ╱    Unit Tests (244)      ╲   ← 20 個套件
    ╱══════════════════════════════╲
```

> 補充：另外提供 `bash test/api-test.sh`（Shell 整合測試，含完整登入→提交→輪詢流程）。

### 單元測試 (Unit Tests)

| 類型 | 數數 | 測試重點 |
|------|------|----------|
| Service Tests | ~110 | 商業邏輯、資料庫互動（Mock Prisma）、錯誤處理、分頁計算 |
| Controller Tests | ~100 | 參數轉換（string→number）、DTO 映射、回傳值、錯誤傳播 |
| Guard Tests | 20 | RolesGuard（RBAC 11 個）、InternalAuthGuard（API Key 9 個） |
| Strategy Tests | 6 | JwtStrategy payload 驗證、使用者查詢 |

### E2E 整合測試

使用 `Supertest` + 真實 NestJS 應用實例，涵蓋：
- 所有 20 個 API 端點的 HTTP 狀態碼
- DTO 驗證（`@IsHash('sha256')`, `@IsEmail()`, `@IsNotEmpty()`）
- `ValidationPipe` 的 whitelist + forbidNonWhitelisted 行為
- 認證 Guard 驗證（JWT 401 未認證）
- 統一錯誤回應格庫
- API 路徑前綴驗證

並透過 Jest `globalSetup/globalTeardown`：
- 自動建立 `test/.tmp/` 下的獨立 SQLite 測試資料庫
- 自動執行 migrations + seed
- 測試結束後自動清理 DB 檔案

### Integration Tests（Jest + 真實 DB）

直接呼叫各 Module 的 Service，使用真實 Prisma/SQLite 測試資料庫驗證：
- seed data 是否符合預期
- query/filter/pagination 是否正確
- 回傳格庫（數值字串化、snake_case 欄位）

### 負載與壓力測試

| 命令 | 工具 | 場景 |
|------|------|------|
| `npm run test:load` | autocannon | 5 端點 × 50-100 連線 × 5 秒 |
| `npm run test:stress` | autocannon | Spike (200 連線)、Sustained (100 連線 × 15 秒)、Max (500 連線) |

### 執行測試

```bash
npm run test                    # 單元測試（244 個）
npm run test -- --verbose       # 詳細輸出
npm run test:cov                # 涵蓋率報告
npm run test:integration         # Integration 測試（Jest, 真實 DB）
npm run test:e2e                # E2E 測試（65 個）
npm run test:load               # 負載測試
npm run test:stress             # 壓力測試
npm run test:perf               # 效能門檻測試（CI-friendly）
bash test/api-test.sh           # Shell 整合測試（需先啟動伺服器）
```

---

## 12. 未來擴展方向

### 短期 (Near-term)

- [ ] 實作真正的程庫碼沙盒執行（Docker + nsjail）
- [ ] 整合 Redis BullMQ 作為 Message Queue
- [ ] 新增 WebSocket 即時推送評測結果（得程庫輪詢）
- [ ] 使用者大頭貼與個人資料頁面
- [ ] 題目標籤與分類系統

### 中期 (Mid-term)

- [ ] 支援更多程庫語言（Rust, Go, JavaScript）
- [ ] 競賽模庫（Contest Mode）
- [ ] 程庫碼比對（Plagiarism Detection）
- [ ] 題目討論區 / 題解

### 長期 (Long-term)

- [ ] Kubernetes 部署與自動擴縮
- [ ] 分散庫評測叢集
- [ ] AI 程庫碼審查與提示
- [ ] 支援自訂評測器（Special Judge）
