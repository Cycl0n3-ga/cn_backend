# 項目檔案結構

Online Code Judge 線上程式碼評測系統 - 完整項目檔案清單

## 目錄結構總览

```
cn_22_backend/
├── src/                           # 原始程式碼目錄
│   ├── auth/                      # 認證模組（JWT、登入、註冊、權限）
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.module.ts
│   │   ├── jwt.strategy.ts        # JWT策略
│   │   ├── jwt-auth.guard.ts      # JWT守卫
│   │   ├── roles.guard.ts         # 角色權限守卫
│   │   ├── roles.decorator.ts     # 角色裝飾器
│   │   ├── dto/                   # 資料传輸對象
│   │   │   ├── login.dto.ts
│   │   │   └── signup.dto.ts
│   │   ├── *.spec.ts              # 單元測試
│   │
│   ├── problems/                  # 項目管理模組
│   │   ├── problems.controller.ts
│   │   ├── problems.service.ts
│   │   ├── problems.module.ts
│   │   ├── dto/
│   │   │   └── problem.dto.ts     # 項目資料對象
│   │   ├── *.spec.ts
│   │
│   ├── submissions/               # 程式碼提交模組
│   │   ├── submissions.controller.ts
│   │   ├── submissions.service.ts
│   │   ├── submissions.module.ts
│   │   ├── dto/
│   │   │   └── submission.dto.ts  # 提交資料對象
│   │   ├── *.spec.ts
│   │
│   ├── users/                     # 使用者管理模組
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── users.module.ts
│   │   ├── *.spec.ts
│   │
│   ├── leaderboard/               # 排行榜模組
│   │   ├── leaderboard.controller.ts
│   │   ├── leaderboard.service.ts
│   │   ├── leaderboard.module.ts
│   │   ├── *.spec.ts
│   │
│   ├── interviews/                # 面試管理模組
│   │   ├── interviews.controller.ts
│   │   ├── interviews.service.ts
│   │   ├── interviews.module.ts
│   │   ├── dto/
│   │   │   └── interview.dto.ts
│   │   ├── *.spec.ts
│   │
│   ├── interview-candidates/      # 面試候選人模組
│   │   ├── interview-candidates.controller.ts
│   │   ├── interview-candidates.service.ts
│   │   ├── interview-candidates.module.ts
│   │   ├── dto/
│   │   │   └── interview-candidate.dto.ts
│   │   ├── *.spec.ts
│   │
│   ├── assignments/               # 指派模組
│   │   ├── assignments.controller.ts
│   │   ├── assignments.service.ts
│   │   ├── assignments.module.ts
│   │   ├── dto/
│   │   │   └── assignment.dto.ts
│   │   ├── *.spec.ts
│   │
│   ├── judge/                     # 內部評測核心模組
│   │   ├── judge.service.ts
│   │   ├── judge.module.ts
│   │   ├── *.spec.ts
│   │
│   ├── internal/                  # 內部API模組（用於評測机）
│   │   ├── internal.controller.ts
│   │   ├── internal.module.ts
│   │   ├── internal-auth.guard.ts
│   │   ├── *.spec.ts
│   │
│   ├── health/                    # 健康检查模組
│   │   ├── health.controller.ts
│   │   ├── health.module.ts
│   │   ├── *.spec.ts
│   │
│   ├── prisma/                    # Prisma ORM服務
│   │   ├── prisma.service.ts
│   │   ├── prisma.module.ts
│   │   ├── *.spec.ts
│   │
│   ├── app.module.ts              # 根模組
│   ├── main.ts                    # 應用入口
│   └── *.spec.ts                  # 單元測試
│
├── prisma/                        # Prisma配置與遷移
│   ├── schema.prisma              # 資料庫模庫定義
│   ├── seed.ts                    # 种子資料脚本
│   └── migrations/                # 資料庫遷移记錄
│
├── test/                          # 測試目錄
│   ├── app.e2e-spec.ts           # E2E測試
│   ├── integration/
│   │   ├── auth.integration-spec.ts
│   │   ├── users.integration-spec.ts
│   │   ├── problems.integration-spec.ts
│   │   └── leaderboard.integration-spec.ts
│   ├── jest-e2e.json              # E2E Jest配置
│   ├── jest-integration.json      # 整合測試Jest配置
│   ├── jest.global-setup.js       # Jest全局設置
│   ├── jest.global-teardown.js    # Jest全局清理
│   ├── api-test.sh                # API整合測試脚本
│   ├── load-test.js               # 負載測試
│   ├── stress-test.js             # 壓力測試
│   └── performance-test.js        # 效能測試
│
├── docs/                          # 檔案目錄
│   ├── README.md                  # 項目概述（根目錄）
│   ├── PROJECT_STRUCTURE.md       # 本檔案 - 檔案結構總览
│   ├── API_SPECIFICATION.md       # API檔案
│   ├── BACKEND_ARCHITECTURE.md    # 架構設計
│   ├── CHANGELOG.md               # 版本變更日誌
│   ├── DATABASE_SCHEMA.md         # 資料庫模庫詳解
│   ├── MODULE_GUIDE.md            # 各模組詳細說明
│   ├── SETUP_GUIDE.md             # 開發環境設置
│   ├── TESTING_GUIDE.md           # 測試指南
│   ├── DEPLOYMENT_GUIDE.md        # 部署指南
│   ├── SECURITY.md                # 安全性檔案
│   ├── TROUBLESHOOTING.md         # 故障排除指南
│   └── CONTRIBUTING.md            # 貢獻指南
│
├── coverage/                      # 測試涵蓋率報告
├── .eslintrc.js                   # ESLint配置
├── docker-compose.yml             # Docker Compose配置
├── Dockerfile                     # 生产镜像配置
├── package.json                   # npm相相性配置
├── package-lock.json              # npm相相性锁定
├── tsconfig.json                  # TypeScript配置
├── tsconfig.build.json            # TypeScript構建配置
├── nest-cli.json                  # NestJS CLI配置
├── eslint.config.mjs              # ESLint模組配置
├── prisma.config.ts               # Prisma配置
└── README.md                       # 項目README
```

## 源程庫碼統計

### 模組數數
- **11** 个功能模組（auth, problems, submissions等）
- **10** 个資料传輸對象（DTO）模組
- **1** 个服務模組（Prisma ORM）

### 檔案統計
- **源檔案 (.ts)**: ~85个
- **單元測試 (.spec.ts)**: ~30个
- **整合測試**: 4个
- **E2E測試**: 1个
- **配置檔案 (.json/.yml)**: ~10个

### 測試涵蓋
- 單元測試: 每个模組都有對應的 `.spec.ts` 檔案
- 整合測試: auth, users, problems, leaderboard
- E2E測試: 完整API流程測試
- 效能測試: 負載測試、壓力測試、效能測試脚本

## 資料庫模庫

項目使用 Prisma ORM，支持：
- **SQLite** (開發環境預設)
- **PostgreSQL** (生产環境推荐)

核心資料模型：
- `User` - 使用者帳戶
- `Problem` - 程庫設計题目
- `TestCase` - 測試用例
- `Submission` - 程庫碼提交记錄
- `Assignment` - 题目指派
- `Interview` - 面試记錄
- `InterviewCandidate` - 面試候選人

## 关键配置檔案

### 環境配置
- `DATABASE_URL` - 資料庫連接字符串
- `JWT_SECRET` - JWT签名密钥
- `JWT_EXPIRES_IN` - JWT過期時間
- `INTERNAL_API_KEY` - 內部API密钥
- `PORT` - 服務連接埠（預設4100）

### 開發工具
- **框架**: NestJS 11.x
- **ORM**: Prisma 7.x
- **認證**: Passport.js + JWT
- **測試**: Jest
- **容器**: Docker + Docker Compose
- **程庫碼检查**: ESLint + Prettier

## API基礎URL
- 本地開發: `http://localhost:4100/api/v1`
- Swagger檔案: `http://localhost:4100/api/docs`

## 檔案導覽

| 檔案 | 用途 |
|------|------|
| [README.md](../README.md) | 項目快速開始 |
| [API_SPECIFICATION.md](API_SPECIFICATION.md) | API端点詳解 |
| [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md) | 系統架構設計 |
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | 資料庫模型 |
| [MODULE_GUIDE.md](MODULE_GUIDE.md) | 各模組功能說明 |
| [SETUP_GUIDE.md](SETUP_GUIDE.md) | 開發環境配置 |
| [TESTING_GUIDE.md](TESTING_GUIDE.md) | 測試執行指南 |
| [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) | 部署說明 |
| [SECURITY.md](SECURITY.md) | 安全性檔案 |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | 常见问题 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 貢獻指南 |
