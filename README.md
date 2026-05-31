# 代碼評測後端

線上代碼評測系統後端，使用 NestJS + Prisma + SQLite 建構。

**📚 完整文件:** 請查閱 [/docs](docs) 目錄

## 🚀 快速開始

```bash
# 安裝依賴
npm install

# 資料庫遷移 + 種子資料
npx prisma migrate dev
npx ts-node prisma/seed.ts

# 啟動開發伺服器
npm run start:dev
```

啟動後：
- 🚀 API: http://localhost:4100/api/v1
- 📚 Swagger UI: http://localhost:4100/api/docs

## 📖 文件導覽

| 類型 | 文件 | 說明 |
|------|------|------|
| **快速開始** | [SETUP_GUIDE.md](docs/SETUP_GUIDE.md) | 開發環境完整配置 |
| **架構設計** | [BACKEND_ARCHITECTURE.md](docs/BACKEND_ARCHITECTURE.md) | 系統架構和設計模式 |
| **API 文件** | [API_SPECIFICATION.md](docs/API_SPECIFICATION.md) | 所有 API 端點詳解 |
| **資料庫** | [DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) | 資料庫模式和關係 |
| **模組說明** | [MODULE_GUIDE.md](docs/MODULE_GUIDE.md) | 各功能模組詳細說明 |
| **測試指南** | [TESTING_GUIDE.md](docs/TESTING_GUIDE.md) | 測試執行方法 |
| **部署指南** | [DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) | 生產部署和優化 |
| **安全文件** | [SECURITY.md](docs/SECURITY.md) | 安全性和最佳實踐 |
| **故障排除** | [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | 常見問題和解決方案 |
| **貢獻指南** | [CONTRIBUTING.md](docs/CONTRIBUTING.md) | 開發者貢獻流程 |
| **版本日誌** | [CHANGELOG.md](docs/CHANGELOG.md) | 版本變更記錄 |
| **全部文件** | [PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) | 完整的文件結構導覽 |

## 🧪 測試帳號

> `/auth/login` 與 `/auth/signup` 的 `passwordSha256` 欄位為 **SHA-256 hex**（前端送 sha256 後的值），後端再以 bcrypt 儲存/比對。

| 帳號 | 明文密碼（僅供人類閱讀） | passwordSha256 (sha256 hex) | 角色 |
|------|--------------------------|------------------------|------|
| admin | admin123 | 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9 | ADMIN |
| alice | user123 | e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446 | USER |
| bob | user123 | e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446 | USER |

## 🧬 測試

```bash
# 單元測試 (Unit Tests)
npm run test

# 單元測試涵蓋率
npm run test:cov

# 整合測試 (Integration Tests, Jest + 真實 SQLite Test DB)
# 會自動建立 `test/.tmp/` 下的獨立 DB、跑 migrations、灌 seed，結束後自動清理
npm run test:integration

# E2E 測試 (E2E Tests, Jest + Supertest)
# 同上：自動建立獨立 DB + migrations + seed
npm run test:e2e

# Shell 整合測試（需先啟動伺服器）
bash test/api-test.sh

# 壓力/負載/效能測試 (Load/Stress/Performance Tests)
# 請先啟動伺服器與資料庫（建議已灌 seed data）
npm run test:load
npm run test:stress

# CI-friendly 的效能門檻測試（會依 P99/error/timeout 決定 exit code）
npm run test:perf
```

詳細的測試方法請參考 [TESTING_GUIDE.md](docs/TESTING_GUIDE.md)

## 🐳 容器化與部署 (Docker)

本專案支援使用 Docker 進行快速部署。

> 目前程式碼（Prisma Adapter + migrations + seed）以 **SQLite** 為可直接運行的預設設定。
> `npm run deploy` 會建立本機部署設定、建置容器、執行 `prisma migrate deploy`、啟動服務，並等到 health check 通過才結束。

```bash
# 一行部署並啟動 Backend API（SQLite）
npm run deploy

# （可選）啟動時灌入 demo seed data（⚠️ seed 會清空既有資料）
SEED_DB=true npm run deploy

# 檢視日誌
docker compose --env-file .deploy/deploy.env logs -f backend-api

# 停止服務（若要連同 DB 一起刪除，可加 -v）
docker compose --env-file .deploy/deploy.env down
```

部署腳本會自動產生 `.deploy/deploy.env`（已被 git ignore），並掛載 Docker socket 讓評測服務可以建立隔離的 sandbox container。

詳細的部署指南請參考 [DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)

## 🔌 API 端點

| Method | Path | 說明 |
|--------|------|------|
| POST | `/api/v1/auth/login` | 使用者登入 |
| POST | `/api/v1/auth/signup` | 使用者註冊 |
| GET | `/api/v1/problems` | 題目列表 |
| GET | `/api/v1/problems/:id` | 題目詳情 |
| POST | `/api/v1/problems` | 新增題目 (Admin) |
| DELETE | `/api/v1/problems/:id` | 刪除題目 (Admin) |
| POST | `/api/v1/problems/:id/assign` | 指派題目 (Admin) |
| POST | `/api/v1/judge/run` | 使用公開 sample 測資執行程式碼 |
| GET | `/api/v1/judge/queue` | 查詢評測佇列狀態 |
| POST | `/api/v1/submissions` | 提交程式碼 |
| GET | `/api/v1/submissions/:id` | 查詢評測結果 |
| GET | `/api/v1/users` | 使用者列表 |
| GET | `/api/v1/users/:username/submissions` | 提交歷史 |
| GET | `/api/v1/leaderboard` | 排行榜 |
| GET | `/api/v1/health` | 健康檢查 |
| GET | `/api/v1/internal/testcases/:id` | 評測機測資 |

完整的 API 文件請參考 [API_SPECIFICATION.md](docs/API_SPECIFICATION.md)

## ⚖️ Code Judge v2

### Run vs Submit

- `POST /api/v1/judge/run`：前端 Run button 使用，只跑公開 sample test case，不建立 submission。
- `POST /api/v1/submissions`：正式提交，使用所有 test cases，建立 submission 後回傳 `PENDING`，前端輪詢結果。

### 支援語言

- `javascript` / `js`：需 export `solve(input)` function
- `python` / `python3` / `py`：需定義 `solve(input)` function
- `c`：完整 C 程式，會先 compile 再執行
- `cpp` / `c++`：完整 C++17 程式，會先 compile 再執行

### Sandbox 與佇列

- 使用 Docker container 執行不可信任程式碼，不直接在 backend process 執行。
- 關閉 network，限制 CPU、memory、process 數量、timeout 與 stdout/stderr 大小。
- `JUDGE_CONCURRENCY` 可控制同時執行的 container 數量，預設為 `2`。
- `GET /api/v1/judge/queue` 可查看目前 active / queued / concurrency。

### Run 範例

```bash
curl -X POST http://localhost:4100/api/v1/judge/run \
  -H "Content-Type: application/json" \
  -d '{
    "problem_id": 1,
    "language": "python",
    "source_code": "def solve(input: str) -> str:\n    a, b = map(int, input.strip().split())\n    return str(a + b)"
  }'
```

## 🏗️ 核心模組

- **Auth** - JWT 認證、登入、註冊、角色管理
- **Problems** - 題目管理（CRUD、難度、測試用例）
- **Submissions** - 代碼提交、評測結果  
- **Users** - 使用者管理、排名統計
- **Leaderboard** - 排行榜功能
- **Interviews** - 面試系統管理
- **Interview-Candidates** - 面試候選人管理（含測驗 startTime/endTime Unix 時間）
- **Internal** - 內部 API 介面（評測機通信）
- **Health** - 健康檢查

詳細的模組說明請參考 [MODULE_GUIDE.md](docs/MODULE_GUIDE.md)

## ⚙️ 技術棧

- **框架:** NestJS 11.x
- **ORM:** Prisma 7.x
- **認證:** Passport.js + JWT
- **測試:** Jest
- **資料庫:** SQLite (開發) / PostgreSQL (生產)
- **容器:** Docker + Docker Compose
- **API 文件:** Swagger/OpenAPI

## 📋 命令列表

```bash
# 開發
npm run start          # 啟動應用
npm run start:dev      # 啟動開發模式（自動重載）
npm run start:debug    # 啟動調試模式
npm run start:prod     # 啟動生產模式

# 構建
npm run build          # 構建應用
npm run format         # 格式化代碼
npm run lint           # 代碼檢查

# 測試
npm run test           # 運行所有測試
npm run test:watch     # 觀察模式
npm run test:cov       # 生成涵蓋率報告
npm run test:e2e       # E2E 測試
npm run test:integration # 整合測試

# 資料庫
npm run db:migrate     # 執行遷移
npm run db:seed        # 灌入種子資料
```

## 🔐 安全性

本專案遵循安全最佳實踐：
- JWT 認證和授權
- 密碼加密 (bcrypt)
- SQL 注入防護 (Prisma)
- CORS 配置
- 速率限制建議

詳細的安全文件請參考 [SECURITY.md](docs/SECURITY.md)

## 🐛 故障排除

遇到問題？請查閱 [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

常見問題包括：
- 連接埠已被佔用
- 資料庫連接失敗
- JWT 驗證失敗
- CORS 問題

## 📞 需要幫助？

- **開發環境:** [SETUP_GUIDE.md](docs/SETUP_GUIDE.md)
- **測試方法:** [TESTING_GUIDE.md](docs/TESTING_GUIDE.md)
- **部署步驟:** [DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)
- **所有文件:** [docs 目錄](docs)

## 📝 版本資訊

- **當前版本:** 1.0.0
- **發布日期:** 2025-05-13
- **狀態:** ✅ 穩定版

詳細的版本資訊和變更日誌請參考 [CHANGELOG.md](docs/CHANGELOG.md)
| POST | `/api/v1/interviews` | 建立面試 |
| GET | `/api/v1/interviews` | 取得面試列表 |
| PATCH | `/api/v1/interviews/:id` | 更改面試名稱 |
| DELETE | `/api/v1/interviews/:id` | 刪除面試 |
| POST | `/api/v1/interview-candidates` | 新增面試者 |
| PATCH | `/api/v1/interview-candidates/:id/time` | 更新面試者測驗開始/結束時間 |
| DELETE | `/api/v1/interview-candidates/:id` | 移除面試者 |

## 文件

- [API 規格書](docs/API_SPECIFICATION.md) — 前端使用的完整 API 文件
- [後端架構](docs/BACKEND_ARCHITECTURE.md) — 系統架構與開發指南
- [Swagger UI](http://localhost:4100/api/docs) — 互動式 API 文件

## 技術棧

- **NestJS 11** — Node.js 後端框架
- **Prisma 7** — ORM
- **SQLite** — 開發資料庫
- **JWT + Passport** — 認證授權
- **Swagger** — API 文件
- **Jest** — 測試框架
