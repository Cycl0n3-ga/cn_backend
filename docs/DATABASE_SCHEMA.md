# DATABASE_SCHEMA.md - 資料庫模式詳解

線上程式碼評測系統的完整資料庫架構說明

## 概述

專案使用 **Prisma ORM** 管理資料庫，支持：
- **SQLite** - 開發環境預設
- **PostgreSQL** - 生產環境推薦

核心資料模型共 **7 個表**，包含 **10+ 個關鍵關係**。

---

## 核心資料模型

### 1. User（使用者）表

```prisma
model User {
  id           String       @id @default(uuid())
  username     String       @unique
  email        String       @unique
  passwordHash String
  role         String       @default("USER")
  solvedCount  Int          @default(0)
  rating       Int          @default(0)
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
  
  submissions         Submission[]
  assignments         Assignment[]
  interviewsCreated   Interview[]
  interviewCandidates InterviewCandidate[]
}
```

**說明：**
- `id`: UUID 卤一識別碼
- `username`: 使用者名稱（卤一）
- `email`: 郸箱（卤一）
- `passwordHash`: 密碼雜湯（使用 bcryptjs）
- `role`: 使用者角色 - `"ADMIN"` 或 `"USER"`
- `solvedCount`: 已解決的題目數
- `rating`: 使用者評分/等級
- `createdAt/updatedAt`: 時間戳

**關係：**
- 1-N: 一個使用者可以有多個提交記錄
- 1-N: 一個使用者可以被指派多個題目
- 1-N: 一個使用者可以建立多個面試
- 1-N: 一個使用者可以作為多個面試的候選人
- 1-N: 一个使用者可以建立多个面試
- 1-N: 一个使用者可以作为多个面試的候選人

---

### 2. Problem（項目）表

```prisma
model Problem {
  id             Int          @id @default(autoincrement())
  title          String
  description    String
  difficulty     String       @default("EASY")
  timeLimitMs    Int          @default(1000)
  memoryLimitMb  Int          @default(256)
  functionName   String?
  acceptanceRate Float        @default(0)
  isDeleted      Boolean      @default(false)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  
  testCases    TestCase[]
  submissions  Submission[]
  assignments  Assignment[]
}
```

**說明：**
- `id`: 自增整數主鍵
- `title`: 項目標題
- `description`: 項目描述/問題陳述
- `difficulty`: 難度級別 - `"EASY"` | `"MEDIUM"` | `"HARD"`
- `timeLimitMs`: 時間限制（毫秒，預設1000ms）
- `memoryLimitMb`: 記憶體限制（MB，預設256MB）
- `functionName`: 预期實現的函數名称（可选）
- `acceptanceRate`: 通過率（百分比）
- `isDeleted`: 逻辑刪除標誌
- `createdAt/updatedAt`: 時間戳

**關係：**
- 1-N: 一個項目可以有多個測試用例
- 1-N: 一個項目可以有多個提交記錄
- 1-N: 一個項目可以被指派給多個使用者

---

### 3. TestCase（測試用例）表

```prisma
model TestCase {
  id        Int     @id @default(autoincrement())
  problemId Int
  input     String
  output    String
  isHidden  Boolean @default(true)
  
  problem   Problem @relation(fields: [problemId], references: [id], onDelete: Cascade)
}
```

**說明：**
- `id`: 自增整數主鍵
- `problemId`: 關聯的項目ID（外鍵）
- `input`: 輸入資料
- `output`: 預期輸出資料
- `isHidden`: 是否隱藏（在提交前隱藏）

**關係：**
- N-1: 多個測試用例屬於一個項目（級聯刪除）

---

### 4. Submission（提交记錄）表

```prisma
model Submission {
  id              String   @id @default(uuid())
  userId          String
  problemId       Int
  language        String
  sourceCode      String
  status          String   @default("PENDING")
  score           Int      @default(0)
  userOutput      String?
  compileMessage  String   @default("")
  executionTimeMs Int?
  memoryUsageKb   Int?
  createdAt       DateTime @default(now())
  
  user    User    @relation(fields: [userId], references: [id])
  problem Problem @relation(fields: [problemId], references: [id])
}
```

**說明：**
- `id`: UUID唯一標识符
- `userId`: 提交者ID（外鍵）
- `problemId`: 項目ID（外鍵）
- `language`: 程式語言
- `sourceCode`: 原始程式碼
- `status`: 評測状态
  - `PENDING` - 待評測
  - `COMPILING` - 編譯中
  - `RUNNING` - 執行中
  - `ACCEPTED` - 通過
  - `WRONG_ANSWER` - 答案錯誤
  - `TLE` - 超時（Time Limit Exceeded）
  - `MLE` - 超記憶體（Memory Limit Exceeded）
  - `RUNTIME_ERROR` - 執行錯誤
  - `COMPILE_ERROR` - 編譯錯誤
- `score`: 得分
- `userOutput`: 使用者程序的輸出
- `compileMessage`: 編譯資訊/錯誤日誌
- `executionTimeMs`: 執行時間（毫秒）
- `memoryUsageKb`: 記憶體使用數（KB）
- `createdAt`: 提交時間

**關係：**
- N-1: 多個提交屬於一個使用者
- N-1: 多個提交屬於一個項目

---

### 5. Assignment（項目指派）表

```prisma
model Assignment {
  id        Int      @id @default(autoincrement())
  problemId Int
  userId    String
  createdAt DateTime @default(now())
  
  problem Problem @relation(fields: [problemId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id])
  
  @@unique([problemId, userId])
}
```

**說明：**
- `id`: 自增整數主鍵
- `problemId`: 項目ID（外鍵）
- `userId`: 使用者ID（外鍵）
- `createdAt`: 指派時間

**約束：**
- 聯合唯一約束：同一項目不會被指派給同一使用者兩次

**關係：**
- N-1: 多個指派屬於一個項目（級聯刪除）
- N-1: 多個指派屬於一個使用者

---

### 6. Interview（面試）表

```prisma
model Interview {
  id             Int      @id @default(autoincrement())
  jobRole        String
  examinerEmpId  String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  
  examiner       User     @relation(fields: [examinerEmpId], references: [id])
  candidates     InterviewCandidate[]
}
```

**說明：**
- `id`: 自增整數主鍵
- `jobRole`: 崗位/職位名稱
- `examinerEmpId`: 面試官ID（外鍵）
- `createdAt/updatedAt`: 時間戳

**關係：**
- N-1: 多个面試由一个使用者（面試官）建立
- 1-N: 一個面試可以有多個候選人

---

### 7. InterviewCandidate（面試候選人）表

```prisma
model InterviewCandidate {
  id          Int      @id @default(autoincrement())
  jobId       Int
  userId      String
  createdAt   DateTime @default(now())
  
  interview   Interview @relation(fields: [jobId], references: [id], onDelete: Cascade)
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([jobId, userId])
}
```

**說明：**
- `id`: 自增整數主鍵
- `jobId`: 面試ID（外鍵）
- `userId`: 候選人ID（外鍵）
- `createdAt`: 新增時間

**約束：**
- 联合唯一約束：同一候選人不会被新增到同一面試两次

**關係：**
- N-1: 多個候選記錄屬於一個面試（級聯刪除）
- N-1: 多個候選記錄屬於一個使用者（級聯刪除）

---

## 資料關係图

```
User (1)
├─── 1-N ──→ Submission (多)
├─── 1-N ──→ Assignment (多)
├─── 1-N ──→ Interview (as examiner)
└─── 1-N ──→ InterviewCandidate (as candidate)

Problem (1)
├─── 1-N ──→ TestCase (多) [CASCADE]
├─── 1-N ──→ Submission (多)
└─── 1-N ──→ Assignment (多) [CASCADE]

TestCase (N)
└─── N-1 ──→ Problem (1) [CASCADE]

Submission (N)
├─── N-1 ──→ User (1)
└─── N-1 ──→ Problem (1)

Assignment (N)
├─── N-1 ──→ Problem (1) [CASCADE]
└─── N-1 ──→ User (1)

Interview (1)
├─── N-1 ──→ User (as examiner)
└─── 1-N ──→ InterviewCandidate (多) [CASCADE]

InterviewCandidate (N)
├─── N-1 ──→ Interview (1) [CASCADE]
└─── N-1 ──→ User (as candidate) [CASCADE]
```

---

## 索引和效能優化

### 主鍵索引
- 所有主鍵欄位都會自動建立索引
- `User.username`, `User.email` - 唯一索引
- `Problem.title` - 可考虑新增

### 联合唯一約束
- `Assignment(problemId, userId)` - 防止重復指派
- `InterviewCandidate(jobId, userId)` - 防止重復候選

### 建議的额外索引
```sql
-- 提交查詢優化
CREATE INDEX idx_submission_user_id ON submissions(user_id);
CREATE INDEX idx_submission_problem_id ON submissions(problem_id);
CREATE INDEX idx_submission_status ON submissions(status);

-- 问题查詢優化
CREATE INDEX idx_problem_difficulty ON problems(difficulty);
CREATE INDEX idx_problem_is_deleted ON problems(is_deleted);
```

---

## 資料庫遷移

### 遷移历史

1. **20260513053228_init_code_judge**
   - 初始化所有核心表
   - 設置關係和約束

2. **20260513070803_add_fields_for_judge_requirements**
   - 新增 `Problem.functionName` 欄位
   - 新增 `Submission.userOutput` 欄位

3. **20260513072022_add_interview_models**
   - 建立 `Interview` 表
   - 建立 `InterviewCandidate` 表

### 執行遷移

```bash
# 開發環境：建立或更新本地DB
npm run db:migrate

# 生产環境：應用遷移
npx prisma migrate deploy
```

---

## 种子資料

項目套件含 `prisma/seed.ts` 脚本，可灌入演示資料：

```bash
# 執行种子脚本
npm run db:seed

# 或通過Docker Compose
SEED_DB=true docker compose up -d --build
```

### 预置帳戶

| 使用者名 | 密碼 | 角色 |
|--------|------|------|
| admin | admin123 | ADMIN |
| alice | user123 | USER |
| bob | user123 | USER |

---

## 效能考數

### SQLite（開發）vs PostgreSQL（生产）

| 特性 | SQLite | PostgreSQL |
|------|--------|------------|
| 并發效能 | ⚠️ 有限 | ✅ 優秀 |
| 事務支持 | ✅ 是 | ✅ 是 |
| ACID特性 | ✅ 是 | ✅ 是 |
| 索引类型 | 基礎 | 進階 |
| JSON支持 | 基礎 | 優秀 |

### 資料庫連接配置

**SQLite（開發）：**
```
DATABASE_URL=file:./data/code_judge.db
```

**PostgreSQL（生产）：**
```
DATABASE_URL=postgresql://user:password@localhost:5432/code_judge
```

---

## 相关檔案

- [README.md](../README.md) - 項目快速開始
- [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md) - 系統架構
- [MODULE_GUIDE.md](MODULE_GUIDE.md) - 模組詳解
- [prisma/schema.prisma](../prisma/schema.prisma) - 完整schema定義
