# MODULE_GUIDE.md - 各模組詳細說明

線上程式碼評測系統後端 - 各功能模組詳解

## 目錄
- [模組概覽](#模組概覽)
- [Auth模組](#auth模組)
- [Problems模組](#problems模組)
- [Submissions模組](#submissions模組)
- [Users模組](#users模組)
- [Leaderboard模組](#leaderboard模組)
- [Interviews模組](#interviews模組)
- [Internal模組](#internal模組)
- [其他模組](#其他模組)

---

## 模組概覽

```
AppModule
├── AuthModule              # 認證和權限
├── ProblemsModule          # 項目管理
├── SubmissionsModule       # 程式碼提交
├── UsersModule             # 使用者管理
├── LeaderboardModule       # 排行榜
├── InterviewsModule        # 面試管理
├── InterviewCandidatesModule # 面試候選人
├── AssignmentsModule       # 指派管理
├── JudgeModule             # 內部評測核心
├── InternalModule          # 內部API
├── HealthModule            # 健康檢查
└── PrismaModule            # 資料庫
```

---

## Auth模組

### 檔案結構

```
src/auth/
├── auth.service.ts          # 核心業務邏輯
├── auth.controller.ts       # API 端點
├── auth.module.ts           # 模組定義
├── user-role.ts             # 角色 enum 與正規化工具
├── jwt.strategy.ts          # JWT策略
├── jwt-auth.guard.ts        # JWT守卫
├── roles.guard.ts           # 角色權限守卫
├── roles.decorator.ts       # 角色裝飾器
├── dto/
│   ├── login.dto.ts         # 登入DTO
│   └── signup.dto.ts        # 註冊DTO
└── *.spec.ts                # 測試檔案
```

### 核心功能

#### 使用者註冊
```typescript
// POST /api/v1/auth/signup
{
  "username": "newuser",
  "email": null,
  "passwordSha256": "sha256_hash_of_password",
  "role": "CANDIDATE"
}
```

`role` 預設為 `CANDIDATE`，可選 `ADMIN`、`EXAMINER`、`QUESTIONER`、`CANDIDATE`。`CANDIDATE` 可不填 email；其他角色必須提供 email。

#### 使用者登入
```typescript
// POST /api/v1/auth/login
{
  "username": "admin",
  "passwordSha256": "sha256_hash_of_password"
}
// Response
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "username": "admin",
    "role": "ADMIN"
  }
}
```

### JWT認證流程

1. **生成Token** - 使用者登入時生成JWT
2. **Token驗證** - 請求時驗證JWT签名和過期時間
3. **權限檢查** - 根據角色進行授權

### 使用JWT的API呼叫

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:4100/api/v1/problems
```

### 角色權限

| 角色 | 權限 |
|------|------|
| ADMIN | 系統管理者，可通過所有角色保護端點 |
| EXAMINER | 建立/修改/刪除面試、管理面試候選人、指派面試題目 |
| QUESTIONER | 建立/刪除項目、指派項目 |
| CANDIDATE | 查看項目、提交程式碼、查看排行榜、查詢測驗時間 |

### 裝飾器用法

```typescript
// 需要認證
@UseGuards(JwtAuthGuard)
@Get('profile')
getProfile(@Request() req) {
  return req.user;
}

// 需要 QUESTIONER 角色（ADMIN 會被 RolesGuard 視為 superuser）
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.QUESTIONER)
@Post('problems')
createProblem(@Body() dto: CreateProblemDto) {
  // ...
}
```

---

## Problems模組

### 檔案結構

```
src/problems/
├── problems.service.ts      # 業務邏輯
├── problems.controller.ts   # API 端點
├── problems.module.ts       # 模組定義
├── dto/
│   └── problem.dto.ts       # DTOs
└── *.spec.ts                # 測試
```

### 核心功能

#### 取得項目列表

```typescript
// GET /api/v1/problems?difficulty=MEDIUM&page=1&limit=10
```

Response:
```json
{
  "data": [
    {
      "id": 1,
      "title": "两數之和",
      "description": "给定一个整數數组...",
      "difficulty": "EASY",
      "acceptanceRate": 95.5,
      "createdAt": "2025-05-13T..."
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 10
}
```

#### 取得項目詳情

```typescript
// GET /api/v1/problems/:id
```

Response:
```json
{
  "id": 1,
  "title": "两數之和",
  "description": "...",
  "difficulty": "EASY",
  "timeLimitMs": 1000,
  "memoryLimitMb": 256,
  "functionName": "twoSum",
  "testCases": [
    {
      "id": 1,
      "input": "[2,7,11,15], target=9",
      "output": "[0,1]",
      "isHidden": true
    }
  ]
}
```

#### 建立項目（Admin）

```typescript
// POST /api/v1/problems
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
{
  "title": "新項目",
  "description": "項目描述",
  "difficulty": "MEDIUM",
  "timeLimitMs": 2000,
  "memoryLimitMb": 512,
  "functionName": "solve",
  "testCases": [
    { "input": "...", "output": "..." }
  ]
}
```

#### 刪除項目（Admin）

```typescript
// DELETE /api/v1/problems/:id
```

#### 指派項目（Admin）

```typescript
// POST /api/v1/problems/:id/assign
{
  "userIds": ["user-uuid-1", "user-uuid-2"]
}
```

---

## Submissions模組

### 檔案結構

```
src/submissions/
├── submissions.service.ts    # 業務邏輯
├── submissions.controller.ts # API 端點
├── submissions.module.ts     # 模組定義
├── dto/
│   └── submission.dto.ts     # DTOs
└── *.spec.ts                 # 測試
```

### 核心功能

#### 提交程式碼

```typescript
// POST /api/v1/submissions
@UseGuards(JwtAuthGuard)
{
  "problemId": 1,
  "language": "javascript",
  "sourceCode": "function twoSum(nums, target) { ... }"
}
```

Response:
```json
{
  "id": "submission-uuid",
  "status": "PENDING",
  "score": 0,
  "createdAt": "2025-05-18T10:30:00Z"
}
```

#### 查詢提交結果

```typescript
// GET /api/v1/submissions/:id
```

Response:
```json
{
  "id": "submission-uuid",
  "userId": "user-uuid",
  "problemId": 1,
  "language": "javascript",
  "status": "ACCEPTED",
  "score": 100,
  "executionTimeMs": 45,
  "memoryUsageKb": 2048,
  "userOutput": "[0,1]",
  "createdAt": "2025-05-18T10:30:00Z"
}
```

#### 評測状态

| 状态 | 說明 |
|------|------|
| PENDING | 待評測 |
| COMPILING | 編譯中 |
| RUNNING | 執行中 |
| ACCEPTED | 通過 |
| WRONG_ANSWER | 答案錯誤 |
| TLE | 超時 |
| MLE | 超記憶體 |
| RUNTIME_ERROR | 執行錯誤 |
| COMPILE_ERROR | 編譯錯誤 |

---

## Users模組

### 檔案結構

```
src/users/
├── users.service.ts         # 業務邏輯
├── users.controller.ts      # API 端點
├── users.module.ts          # 模組定義
└── *.spec.ts                # 測試
```

### 核心功能

#### 得得使用者列表

```typescript
// GET /api/v1/users?page=1&limit=20
```

Response:
```json
{
  "data": [
    {
      "id": "user-uuid",
      "username": "alice",
      "email": null,
      "role": "CANDIDATE",
      "solvedCount": 42,
      "rating": 1500,
      "createdAt": "2025-05-13T..."
    }
  ],
  "total": 3
}
```

#### 得得使用者資訊

```typescript
// GET /api/v1/users/:username
```

#### 查詢使用者提交历史

```typescript
// GET /api/v1/users/:username/submissions?page=1&limit=10
```

Response:
```json
{
  "data": [
    {
      "id": "submission-uuid",
      "problemId": 1,
      "problemTitle": "两數之和",
      "status": "ACCEPTED",
      "score": 100,
      "language": "javascript",
      "createdAt": "2025-05-18T..."
    }
  ],
  "total": 25
}
```

---

## Leaderboard模組

### 檔案結構

```
src/leaderboard/
├── leaderboard.service.ts    # 排名計算
├── leaderboard.controller.ts # API 端點
├── leaderboard.module.ts     # 模組定義
└── *.spec.ts                 # 測試
```

### 核心功能

#### 得得排行榜

```typescript
// GET /api/v1/leaderboard?page=1&limit=50&sortBy=rating
```

Response:
```json
{
  "data": [
    {
      "rank": 1,
      "username": "alice",
      "solvedCount": 48,
      "rating": 2100,
      "submissions": 150
    },
    {
      "rank": 2,
      "username": "bob",
      "solvedCount": 45,
      "rating": 1950,
      "submissions": 140
    }
  ],
  "total": 3
}
```

#### 排名計算规则

- **排序優先順序**
  1. 解決項目數 (solvedCount) - 降序
  2. 評分 (rating) - 降序
  3. 提交历史 - 最近提交時間

---

## Interviews模組

### 檔案結構

```
src/interviews/
├── interviews.service.ts     # 業務邏輯
├── interviews.controller.ts  # API 端點
├── interviews.module.ts      # 模組定義
├── dto/
│   └── interview.dto.ts      # DTOs
└── *.spec.ts                 # 測試
```

### 核心功能

#### 建立面試

```typescript
// POST /api/v1/interviews
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
{
  "jobRole": "Senior Backend Engineer"
}
```

#### 得得面試列表

```typescript
// GET /api/v1/interviews
```

#### 得得面試詳情

```typescript
// GET /api/v1/interviews/:id
```

---

## InterviewCandidates模組

### 檔案結構

```
src/interview-candidates/
├── interview-candidates.service.ts    # 業務邏輯
├── interview-candidates.controller.ts # API 端點
├── interview-candidates.module.ts     # 模組定義
├── dto/
│   └── interview-candidate.dto.ts     # DTOs
└── *.spec.ts                          # 測試
```

### 核心功能

#### 新增面試候選人

```typescript
// POST /api/v1/interview-candidates
{
  "jobId": 1,
  "userId": "user-uuid",
  "startTime": 1770000000,
  "endTime": 1770003600
}
```

`startTime`、`endTime` 為選填 Unix timestamp seconds，用於記錄該考生在此面試測驗的開始與結束時間。

#### 取得所有候選人列表

```typescript
// GET /api/v1/interview-candidates
```

#### 更新候選人測驗時間

```typescript
// PATCH /api/v1/interview-candidates/:id/time
{
  "startTime": 1770000000,
  "endTime": 1770003600
}
```

可只更新其中一個欄位；傳 `null` 可清除時間。

#### 查詢候選人測驗剩餘時間

```typescript
// GET /api/v1/interview-candidates/:id/time-status
```

Response:
```json
{
  "serverTime": 1770000300,
  "startTime": 1770000000,
  "endTime": 1770003600,
  "remainingTime": 3300,
  "elapsedTime": 300,
  "duration": 3600,
  "timeUntilStart": 0,
  "status": "IN_PROGRESS"
}
```

`serverTime`、`startTime`、`endTime` 使用 Unix timestamp seconds；其他時間欄位為秒數。

`CANDIDATE` 僅能查詢自己的測驗時間狀態；`ADMIN`、`EXAMINER` 可查詢所有考生記錄。

#### 刪除候選人

```typescript
// DELETE /api/v1/interview-candidates/:id
```

---

## Assignments模組

### 檔案結構

```
src/assignments/
├── assignments.service.ts    # 業務邏輯
├── assignments.controller.ts # API 端點
├── assignments.module.ts     # 模組定義
├── dto/
│   └── assignment.dto.ts     # DTOs
└── *.spec.ts                 # 測試
```

### 核心功能

#### 指派題目給考生

```typescript
// POST /api/v1/assignments
{
  "problemId": 1,
  "userId": "user-uuid"
}
```

#### 取得題目指派列表

```typescript
// GET /api/v1/assignments
```

---

## Judge模組

### 檔案結構

```
src/judge/
├── judge.service.ts       # 評測核心邏輯
├── judge.module.ts        # 模組定義
└── *.spec.ts              # 測試
```

### 核心功能

負責內部呼叫評測沙盒或外部 Judge0 API 執行提交程式碼並回傳結果。

---

## Internal模組

### 檔案結構

```
src/internal/
├── internal.service.ts       # 業務邏輯
├── internal.controller.ts    # API 端點
├── internal.module.ts        # 模組定義
├── internal-auth.guard.ts    # 內部認證守卫
└── *.spec.ts                 # 測試
```

### 用途

提供给外部評測机（Judge Worker）的內部API，用于：
- 得得待評測的提交
- 取得項目測試用例
- 更新評測結果

### 認證方庫

使用 `INTERNAL_API_KEY` 头部認證：

```bash
curl -H "X-API-Key: internal-judge-worker-key" \
  http://localhost:4100/api/v1/internal/testcases/1
```

### API 端點

```typescript
// 得得题目測試用例
// GET /api/v1/internal/testcases/:problemId
// Headers: X-API-Key

// 得得待評測提交
// GET /api/v1/internal/submissions/pending
// Headers: X-API-Key

// 更新提交結果
// PATCH /api/v1/internal/submissions/:submissionId
// Headers: X-API-Key
{
  "status": "ACCEPTED",
  "score": 100,
  "executionTimeMs": 45,
  "memoryUsageKb": 2048,
  "userOutput": "[0,1]"
}
```

---

## 其他模組

### Health模組

健康检查端点，用于監控服務状态

```typescript
// GET /api/v1/health
{
  "status": "ok",
  "timestamp": "2025-05-18T10:30:00Z"
}
```

### Prisma模組

資料庫連接和ORM服務

```typescript
// 在其他服務中注入使用
constructor(private prismaService: PrismaService) {}

// 然后可以直接使用prismaService.user, prismaService.problem等
const users = await this.prismaService.user.findMany();
```

---

## 模組間通訊

### 相相性注入示範

```typescript
// submissions.service.ts
import { ProblemsService } from '../problems/problems.service';

@Injectable()
export class SubmissionsService {
  constructor(
    private prismaService: PrismaService,
    private problemsService: ProblemsService,  // 注入其他服務
  ) {}

  async createSubmission(dto: CreateSubmissionDto) {
    // 呼叫其他服務
    const problem = await this.problemsService.findById(dto.problemId);
    // ...
  }
}
```

---

## 相关檔案

- [API_SPECIFICATION.md](API_SPECIFICATION.md) - API詳細端点
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - 資料模型
- [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md) - 架構設計
