# CHANGELOG - 版本變更日誌

線上程式碼評測系統後端版本變更記錄

## 格式說明

遵循 [Keep a Changelog](https://keepachangelog.com/) 規範

## [Unreleased]

### 待開發功能
- [ ] 支持更多程式設計語言（Python、Java、Go等）
- [ ] 程式碼執行超時優化
- [ ] 快取層優化（Redis整合）
- [ ] 批次操作API
- [ ] 進階搜尋和過滤功能

## [1.0.0] - 2025-05-13

### 新增功能

#### 核心功能
- ✨ 使用者認證系統（登入、註冊、JWT）
- ✨ 角色權限管理（Admin、User）
- ✨ 程式碼題庫管理（CRUD、難度分級）
- ✨ 程式碼提交和評測系統
- ✨ 使用者排行榜
- ✨ 面試管理系統
- ✨ 面試候選人管理

#### 技術特性
- 🔐 JWT 認證 + Passport 策略
- 🗄️ Prisma ORM + SQLite/PostgreSQL 支持
- 🐳 Docker + Docker Compose容器化
- 📊 Swagger API檔案
- ✅ 完整測試套件（單元、整合、E2E）
- ⚡ 效能測試（負載、壓力、效能門檻）

### 資料庫遷移

#### 初始化 (2025-05-13 05:32:28)
- `20260513053228_init_code_judge`
  - 建立基礎表：User, Problem, TestCase, Submission, Assignment
  - 配置關係和約束

#### 欄位擴展 (2025-05-13 07:08:03)
- `20260513070803_add_fields_for_judge_requirements`
  - Problem: 新增 `functionName` 欄位
  - Submission: 新增 `userOutput` 欄位

#### 面試系統 (2025-05-13 07:20:22)
- `20260513072022_add_interview_models`
  - 新增 Interview 表
  - 新增 InterviewCandidate 表

#### 面試考生測驗時間 (2026-05-31 06:10:00)
- `20260531061000_add_interview_candidate_times`
  - InterviewCandidate: 新增 `startTime` / `endTime` Unix timestamp seconds 欄位
  - API: 新增 `PATCH /api/v1/interview-candidates/:id/time`

### 測試涵蓋率
- 單元測試: 主要服務和控制器
- 整合測試: auth, users, problems, leaderboard
- E2E測試: 完整API流程
- 效能測試: 負載測試、壓力測試、效能基準

### API版本
- API前缀: `/api/v1`
- Swagger檔案: `/api/docs`

### 已知限制
- ⚠️ 當前仅支持JavaScript/TypeScript評測
- ⚠️ 評測執行通過內部API（評測机需單独部署）
- ⚠️ SQLite在并發场景效能有限（生产建議使用PostgreSQL）

### 相关檔案
- [API_SPECIFICATION.md](API_SPECIFICATION.md) - API詳細檔案
- [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md) - 架構設計
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - 資料庫模庫
