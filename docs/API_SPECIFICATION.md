# Code Judge API 規格說明書 v1.0

> 完整的線上程式評測系統 API 文件，供前端開發團隊參考使用。

---

## 1. 全域規範 (Global Specifications)

| 項目           | 說明                                                            |
| -------------- | --------------------------------------------------------------- |
| **Base URL**   | `http://localhost:4100/api/v1`                                  |
| **Swagger UI** | `http://localhost:4100/api/docs`                                |
| **資料格式**   | `application/json`                                              |
| **字元編碼**   | UTF-8                                                           |
| **認證機制**   | JWT Bearer Token                                                |
| **資料類型**   | **所有數值與 ID 欄位均以 Text (String) 形式回傳**，供前端預處理 |
| **分頁參數**   | `page` (頁碼, 預設 1), `limit` (每頁筆數, 預設 20)              |

### 認證方式

除公開端點外，所有需要認證的請求需在 Header 夾帶：

```
Authorization: Bearer <JWT_TOKEN>
```

### 測試帳號

> 注意：本專案 `passwordSha256` 欄位 **不是明文密碼**，而是 `sha256(明文密碼)` 的 64 位 hex 字串。

| 帳號    | 明文密碼（僅供人類閱讀） | passwordSha256 (sha256 hex)                                        | 角色  |
| ------- | ------------------------ | ------------------------------------------------------------------ | ----- |
| `admin` | `admin123`               | `240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9` | ADMIN |
| `examiner` | `user123`             | `e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446` | EXAMINER |
| `questioner` | `user123`           | `e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446` | QUESTIONER |
| `alice` | `user123`                | `e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446` | CANDIDATE |
| `bob`   | `user123`                | `e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446` | CANDIDATE |

### 角色權限

| 角色 | 說明 |
|------|------|
| `ADMIN` | 系統管理者，可通過所有角色保護端點 |
| `EXAMINER` | 管理面試、面試候選人、面試題目指派 |
| `QUESTIONER` | 管理題庫與題目指派 |
| `CANDIDATE` | 參與測驗與提交程式碼；帳號可不填 email |

### 統一錯誤回應格式

所有 HTTP 4xx/5xx 錯誤回應採用以下格式：

```json
{
  "statusCode": 400,
  "message": "人類可讀的錯誤訊息",
  "error": "Bad Request"
}
```

---

## 2. 認證模組 (Authentication)

### 2.1 使用者登入

| 項目       | 值            |
| ---------- | ------------- |
| **Method** | `POST`        |
| **Path**   | `/auth/login` |
| **認證**   | 不需要        |

**Request Body:**

```json
{
  "username": "admin",
  "passwordSha256": "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9"
}
```

> `passwordSha256` 為 `sha256(明文密碼)` 的 hex 字串（長度 64）。

**Response (200 OK):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": "3600",
  "user_role": "ADMIN"
}
```

**Error Responses:**

- `401 Unauthorized` — 帳號或密碼錯誤

---

### 2.2 使用者註冊

| 項目       | 值             |
| ---------- | -------------- |
| **Method** | `POST`         |
| **Path**   | `/auth/signup` |
| **認證**   | 不需要         |

**Request Body:**

```json
{
  "username": "newuser",
  "email": null,
  "passwordSha256": "e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446",
  "role": "CANDIDATE"
}
```

> `passwordSha256` 請傳送 `sha256(明文密碼)` 的 hex 字串（長度 64）。

> `role` 為選填，預設 `CANDIDATE`。可選值：`ADMIN`, `EXAMINER`, `QUESTIONER`, `CANDIDATE`。

> `email` 對 `CANDIDATE` 為選填；`ADMIN`、`EXAMINER`、`QUESTIONER` 必填。

**Response (201 Created):**

```json
{
  "id": "uuid-string",
  "username": "newuser",
  "email": null,
  "role": "CANDIDATE",
  "createdAt": "2026-05-13T12:00:00.000Z"
}
```

**Error Responses:**

- `400 Bad Request` — role 不合法，或非 CANDIDATE 帳號未提供 email
- `409 Conflict` — 帳號或信箱已存在

---

## 3. 題目管理模組 (Problem Management)

### 3.1 取得題目清單

| 項目       | 值          |
| ---------- | ----------- |
| **Method** | `GET`       |
| **Path**   | `/problems` |
| **認證**   | 不需要      |

**Query Parameters:**

| 參數         | 型別   | 必填 | 說明                                |
| ------------ | ------ | ---- | ----------------------------------- |
| `page`       | number | 否   | 頁碼，預設 1                        |
| `limit`      | number | 否   | 每頁筆數，預設 20                   |
| `difficulty` | string | 否   | 難度篩選 (`EASY`, `MEDIUM`, `HARD`) |

**Response (200 OK):**

```json
{
  "total": "5",
  "page": "1",
  "items": [
    {
      "problem_id": "1",
      "title": "Two Sum",
      "difficulty": "EASY",
      "acceptance_rate": "0.49",
      "creator": {
        "id": "uuid-string",
        "username": "admin",
        "email": "admin@codejudge.dev"
      },
      "assignedCount": "1",
      "submittedCount": "2",
      "acceptedCount": "1",
      "failedCount": "1"
    },
    {
      "problem_id": "2",
      "title": "Add Two Numbers",
      "difficulty": "MEDIUM",
      "acceptance_rate": "0.39",
      "creator": null,
      "assignedCount": "0",
      "submittedCount": "0",
      "acceptedCount": "0",
      "failedCount": "0"
    }
  ]
}
```

> `failedCount` 統計已完成且未通過的提交狀態：`WRONG_ANSWER`, `TLE`, `MLE`, `RUNTIME_ERROR`, `COMPILE_ERROR`。

---

### 3.2 取得題目詳情

| 項目       | 值               |
| ---------- | ---------------- |
| **Method** | `GET`            |
| **Path**   | `/problems/{id}` |
| **認證**   | 不需要           |

**Response (200 OK):**

```json
{
  "problem_id": "1",
  "title": "Two Sum",
  "description": "Markdown 格式的題目敘述...",
  "difficulty": "EASY",
  "function_name": "twoSum",
  "creator": {
    "id": "uuid-string",
    "username": "admin",
    "email": "admin@codejudge.dev"
  },
  "assignedCount": "1",
  "submittedCount": "2",
  "acceptedCount": "1",
  "failedCount": "1",
  "constraints": {
    "time_limit_ms": "1000",
    "memory_limit_mb": "256"
  },
  "sample_test_cases": [
    { "input": "[2,7,11,15]\n9", "output": "[0,1]" },
    { "input": "[3,2,4]\n6", "output": "[1,2]" }
  ]
}
```

> ⚠️ `description` 使用 Markdown 格式，前端需渲染。
> ⚠️ `sample_test_cases` 僅包含公開測資，隱藏測資不會回傳。

**Error Responses:**

- `404 Not Found` — 題目不存在或已被刪除

---

### 3.3 新增題目 (Admin Only)

| 項目       | 值                      |
| ---------- | ----------------------- |
| **Method** | `POST`                  |
| **Path**   | `/problems`             |
| **認證**   | ✅ Bearer Token (`ADMIN`, `QUESTIONER`) |

**Request Body:**

```json
{
  "title": "New Problem",
  "description": "## Description\n\nProblem text in Markdown...",
  "difficulty": "HARD",
  "function_name": "solve",
  "time_limit_ms": 2000,
  "memory_limit_mb": 256,
  "test_cases": [
    { "input": "[1,2,3]", "output": "6", "is_hidden": false },
    { "input": "[0,0]", "output": "0", "is_hidden": true }
  ]
}
```

| 欄位                     | 型別    | 必填 | 說明                           |
| ------------------------ | ------- | ---- | ------------------------------ |
| `title`                  | string  | ✅   | 題目標題                       |
| `description`            | string  | ✅   | 題目描述 (Markdown)            |
| `difficulty`             | enum    | ✅   | `EASY`, `MEDIUM`, `HARD`       |
| `function_name`          | string  | 否   | 預期使用者實作的 function 名稱 |
| `time_limit_ms`          | number  | 否   | 時間限制（毫秒），預設 1000    |
| `memory_limit_mb`        | number  | 否   | 記憶體限制（MB），預設 256     |
| `test_cases`             | array   | ✅   | 測試資料                       |
| `test_cases[].input`     | string  | ✅   | 輸入                           |
| `test_cases[].output`    | string  | ✅   | 預期輸出                       |
| `test_cases[].is_hidden` | boolean | 否   | 是否隱藏，預設 true            |

**Response (201 Created):**

```json
{
  "problem_id": "6",
  "title": "New Problem",
  "creator": {
    "id": "uuid-string",
    "username": "admin",
    "email": "admin@codejudge.dev"
  }
}
```

---

### 3.4 編輯題目 (Admin Only)

| 項目       | 值                      |
| ---------- | ----------------------- |
| **Method** | `PATCH`                  |
| **Path**   | `/problems/{id}`        |
| **認證**   | ✅ Bearer Token (`ADMIN`, `QUESTIONER`) |

**Request Body:**

```json
{
  "title": "Updated Problem Title",
  "description": "## Description\n\nNew markdown text...",
  "difficulty": "MEDIUM",
  "function_name": "solve",
  "time_limit_ms": 1500,
  "memory_limit_mb": 512,
  "test_cases": [
    { "input": "[1,2,3]", "output": "6", "is_hidden": false }
  ]
}
```

| 欄位                     | 型別    | 必填 | 說明                           |
| ------------------------ | ------- | ---- | ------------------------------ |
| `title`                  | string  | 否   | 題目標題                       |
| `description`            | string  | 否   | 題目描述 (Markdown)            |
| `difficulty`             | enum    | 否   | `EASY`, `MEDIUM`, `HARD`       |
| `function_name`          | string  | 否   | 預期使用者實作的 function 名稱 |
| `time_limit_ms`          | number  | 否   | 時間限制（毫秒）               |
| `memory_limit_mb`        | number  | 否   | 記憶體限制（MB）               |
| `test_cases`             | array   | 否   | 新的測試資料（傳入會完全覆蓋舊測資） |
| `test_cases[].input`     | string  | ✅   | 輸入                           |
| `test_cases[].output`    | string  | ✅   | 預期輸出                       |
| `test_cases[].is_hidden` | boolean | 否   | 是否隱藏，預設 true            |

**Response (200 OK):**

```json
{
  "problem_id": "1",
  "title": "Updated Problem Title",
  "creator": {
    "id": "uuid-string",
    "username": "admin",
    "email": "admin@codejudge.dev"
  }
}
```

---

### 3.5 刪除題目 (Admin Only)

| 項目       | 值                      |
| ---------- | ----------------------- |
| **Method** | `DELETE`                |
| **Path**   | `/problems/{id}`        |
| **認證**   | ✅ Bearer Token (`ADMIN`, `QUESTIONER`) |

**Response:** `204 No Content`（無回傳本體）

> 使用軟刪除 (Soft Delete)，資料仍保留在資料庫中。

---

### 3.6 指派題目 (Admin Only)

| 項目       | 值                      |
| ---------- | ----------------------- |
| **Method** | `POST`                  |
| **Path**   | `/problems/{id}/assign` |
| **認證**   | ✅ Bearer Token (`ADMIN`, `EXAMINER`, `QUESTIONER`) |

**Request Body:**

```json
{
  "assignee_username": "alice"
}
```

**Response (200 OK):**

```json
{
  "message": "Assignment created successfully.",
  "assignment_id": "1",
  "problem_id": "1",
  "assignee": "alice"
}
```

---

## 4. 評測與提交模組 (Submission & Judging)

### 4.1 提交程式碼 (非同步)

| 項目       | 值              |
| ---------- | --------------- |
| **Method** | `POST`          |
| **Path**   | `/submissions`  |
| **認證**   | ✅ Bearer Token (`ADMIN`, `CANDIDATE`) |

**Request Body:**

```json
{
  "problem_id": 1,
  "language": "python3",
  "source_code": "def twoSum(nums, target):\n    pass"
}
```

| 欄位          | 型別   | 必填 | 說明                                          |
| ------------- | ------ | ---- | --------------------------------------------- |
| `problem_id`  | number | ✅   | 題目 ID                                       |
| `language`    | string | ✅   | 程式語言 (`python3`, `cpp`, `java`, `golang`) |
| `source_code` | string | ✅   | 原始碼                                        |

**Response (202 Accepted):**

```json
{
  "submission_id": "uuid-v4-string",
  "status": "PENDING"
}
```

> ⚠️ 此端點回傳 **202 Accepted**，表示提交已接收但尚未完成評測。
> 前端應使用 `submission_id` 輪詢 `GET /submissions/{id}` 取得最終結果。

---

### 4.2 查詢提交結果

| 項目       | 值                             |
| ---------- | ------------------------------ |
| **Method** | `GET`                          |
| **Path**   | `/submissions/{submission_id}` |
| **認證**   | 不需要                         |

**Response (200 OK):**

```json
{
  "submission_id": "uuid-v4-string",
  "problem_id": "1",
  "language": "python3",
  "status": "ACCEPTED",
  "score": "100",
  "user_answer": "[0,1]",
  "compile_message": "",
  "metrics": {
    "execution_time_ms": "45",
    "memory_usage_kb": "2048"
  },
  "submitted_at": "2026-05-13T12:00:00.000Z"
}
```

**Status 可能的值：**

| Status          | 說明                                  |
| --------------- | ------------------------------------- |
| `PENDING`       | 等待評測                              |
| `COMPILING`     | 編譯中                                |
| `RUNNING`       | 執行中                                |
| `ACCEPTED`      | ✅ 通過                               |
| `WRONG_ANSWER`  | ❌ 答案錯誤                           |
| `TLE`           | ⏰ 超時 (Time Limit Exceeded)         |
| `MLE`           | 💾 記憶體超限 (Memory Limit Exceeded) |
| `RUNTIME_ERROR` | 💥 執行時錯誤                         |
| `COMPILE_ERROR` | 🔧 編譯錯誤                           |

**前端輪詢建議：**

```
1. POST /submissions → 取得 submission_id
2. 每 1~2 秒 GET /submissions/{id}
3. 當 status 不是 PENDING/COMPILING/RUNNING 時停止輪詢
```

---

## 5. 使用者模組 (Users)

### 5.1 取得所有使用者

| 項目       | 值       |
| ---------- | -------- |
| **Method** | `GET`    |
| **Path**   | `/users` |
| **認證**   | 不需要   |

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": "uuid",
      "username": "alice",
      "email": null,
      "role": "CANDIDATE",
      "solvedCount": "3",
      "rating": "1500",
      "createdAt": "2026-05-13T12:00:00.000Z"
    }
  ]
}
```

---

### 5.2 取得使用者提交歷史

| 項目       | 值                              |
| ---------- | ------------------------------- |
| **Method** | `GET`                           |
| **Path**   | `/users/{username}/submissions` |
| **認證**   | 不需要                          |

**Query Parameters:**

| 參數    | 型別   | 必填 | 說明              |
| ------- | ------ | ---- | ----------------- |
| `page`  | number | 否   | 頁碼，預設 1      |
| `limit` | number | 否   | 每頁筆數，預設 20 |

**Response (200 OK):**

```json
{
  "total": "5",
  "page": "1",
  "data": [
    {
      "submission_id": "uuid",
      "problem_id": "1",
      "language": "python3",
      "status": "ACCEPTED",
      "score": "100",
      "source_code": "def twoSum...",
      "execution_result": "[0,1]",
      "submitted_at": "2026-05-13T12:00:00.000Z"
    }
  ]
}
```

---

## 6. 排行榜 (Leaderboard)

### 6.1 全站排行榜

| 項目       | 值             |
| ---------- | -------------- |
| **Method** | `GET`          |
| **Path**   | `/leaderboard` |
| **認證**   | 不需要         |

**Query Parameters:**

| 參數    | 型別   | 必填 | 說明              |
| ------- | ------ | ---- | ----------------- |
| `page`  | number | 否   | 頁碼，預設 1      |
| `limit` | number | 否   | 每頁筆數，預設 20 |

**Response (200 OK):**

```json
{
  "total": "100",
  "page": "1",
  "data": [
    { "rank": "1", "username": "bob", "solved_count": "5", "rating": "1800" },
    { "rank": "2", "username": "alice", "solved_count": "3", "rating": "1500" }
  ]
}
```

> 排序依據：先依 `rating` 降序，再依 `solved_count` 降序。

---

## 7. 系統內部模組 (System & Internal)

### 7.1 系統健康檢查

| 項目       | 值        |
| ---------- | --------- |
| **Method** | `GET`     |
| **Path**   | `/health` |
| **認證**   | 不需要    |

**Response (200 OK):**

```json
{
  "status": "UP",
  "services": {
    "database": "OK",
    "judge_queue": "OK"
  },
  "queue_depth": "0",
  "uptime": "3600s",
  "timestamp": "2026-05-13T15:30:00.000Z"
}
```

---

### 7.2 評測機獲取測資 (Internal Only)

| 項目       | 值                         |
| ---------- | -------------------------- |
| **Method** | `GET`                      |
| **Path**   | `/internal/testcases/{id}` |
| **認證**   | ✅ Internal API Key        |

**Header:**

```
x-internal-api-key: <INTERNAL_API_KEY>
```

> ⚠️ 此端點僅供評測機 (Judge Worker) 使用，**嚴禁暴露給前端或外部使用者**。

**Response (200 OK):**

```json
{
  "problem_id": "1",
  "time_limit_ms": "1000",
  "memory_limit_mb": "256",
  "test_cases": [
    { "input": "[2,7,11,15]\n9", "output": "[0,1]" },
    { "input": "[3,2,4]\n6", "output": "[1,2]" },
    { "input": "[3,3]\n6", "output": "[0,1]" }
  ]
}
```

---

## 8. 面試管理與考生模組 (Interviews & Candidates)

### 8.1 建立面試 (輔助測試)

| 項目       | 值              |
| ---------- | --------------- |
| **Method** | `POST`          |
| **Path**   | `/interviews`   |
| **認證**   | ✅ Bearer Token (`ADMIN`, `EXAMINER`) |

**Request Body:**

```json
{
  "jobRole": "Backend Developer",
  "examinerEmpId": "uuid-string",
  "candidateUserId": "candidate-uuid-string",
  "problemCounts": {
    "easy": 2,
    "medium": 1,
    "hard": 0
  }
}
```

`candidateUserId` 與 `problemCounts` 為選填；若 `problemCounts` 任一題數大於 0，必須一併提供 `candidateUserId`。系統會依難度從未刪除題目中取指定數量，建立面試時同步新增候選人與面試題目指派。

**Response (201 Created):**

```json
{
  "id": "1",
  "jobRole": "Backend Developer",
  "examinerEmpId": "uuid-string",
  "candidate": {
    "id": "1",
    "jobId": "1",
    "userId": "candidate-uuid-string"
  },
  "problemCounts": {
    "easy": 2,
    "medium": 1,
    "hard": 0
  },
  "assignments": [
    {
      "id": "1",
      "jobId": "1",
      "userId": "candidate-uuid-string",
      "problemId": "1",
      "createdAt": "2026-05-31T00:00:00.000Z",
      "problem": {
        "id": 1,
        "title": "Two Sum",
        "difficulty": "EASY"
      }
    }
  ]
}
```

若未提供 `candidateUserId`，回應維持原本格式，只包含 `id`、`jobRole`、`examinerEmpId`。

---

### 8.2 更改面試名稱

| 項目       | 值                 |
| ---------- | ------------------ |
| **Method** | `PATCH`            |
| **Path**   | `/interviews/{id}` |
| **認證**   | ✅ Bearer Token (`ADMIN`, `EXAMINER`) |

**Request Body:**

```json
{
  "jobRole": "Senior Backend Developer"
}
```

**Response (200 OK):**

```json
{
  "id": "1",
  "jobRole": "Senior Backend Developer",
  "examinerEmpId": "uuid-string"
}
```

---

### 8.3 刪除面試

| 項目       | 值                 |
| ---------- | ------------------ |
| **Method** | `DELETE`           |
| **Path**   | `/interviews/{id}` |
| **認證**   | ✅ Bearer Token (`ADMIN`, `EXAMINER`) |

**Response (204 No Content):** 無回傳本體

---

### 8.4 新增面試者到面試

| 項目       | 值                      |
| ---------- | ----------------------- |
| **Method** | `POST`                  |
| **Path**   | `/interview-candidates` |
| **認證**   | ✅ Bearer Token (`ADMIN`, `EXAMINER`) |

**Request Body:**

```json
{
  "jobId": 1,
  "userId": "uuid-string",
  "startTime": 1770000000,
  "endTime": 1770003600
}
```

`startTime` 與 `endTime` 為選填，使用 Unix timestamp seconds。若尚未設定可省略，或在更新 API 傳 `null` 清除。

**Response (201 Created):**

```json
{
  "id": "1",
  "jobId": "1",
  "userId": "uuid-string",
  "startTime": 1770000000,
  "endTime": 1770003600
}
```

---

### 8.5 取得所有面試考生列表

| 項目       | 值                      |
| ---------- | ----------------------- |
| **Method** | `GET`                   |
| **Path**   | `/interview-candidates` |
| **認證**   | ❌ (公開)               |

**Response (200 OK):**

```json
[
  {
    "id": "1",
    "jobId": "1",
    "userId": "uuid-string",
    "startTime": 1770000000,
    "endTime": 1770003600,
    "createdAt": "2026-05-18T08:00:00.000Z",
    "interview": {
      "id": "1",
      "jobRole": "Senior Backend Developer",
      "examinerEmpId": "uuid-string"
    },
    "user": {
      "id": "uuid-string",
      "username": "candidate_alice",
      "role": "CANDIDATE"
    }
  }
]
```

---

### 8.6 更新面試考生測驗時間

| 項目       | 值                                |
| ---------- | --------------------------------- |
| **Method** | `PATCH`                           |
| **Path**   | `/interview-candidates/{id}/time` |
| **認證**   | ✅ Bearer Token (`ADMIN`, `EXAMINER`) |

**Request Body:**

```json
{
  "startTime": 1770000000,
  "endTime": 1770003600
}
```

可只更新其中一個欄位；傳 `null` 可清除對應時間。若 `startTime` 與 `endTime` 都有值，`endTime` 必須大於或等於 `startTime`。

**Response (200 OK):**

```json
{
  "id": "1",
  "jobId": "1",
  "userId": "uuid-string",
  "startTime": 1770000000,
  "endTime": 1770003600
}
```

---

### 8.7 取得面試考生測驗剩餘時間

| 項目 | 值 |
|------|------|
| **Method** | `GET` |
| **Path** | `/interview-candidates/{id}/time-status` |
| **認證** | ✅ Bearer Token (`ADMIN`, `EXAMINER`, `CANDIDATE`) |

`CANDIDATE` 僅能查詢自己的面試考生記錄；`ADMIN`、`EXAMINER` 可查詢所有記錄。

**Response (200 OK):**

```json
{
  "id": "1",
  "jobId": "1",
  "userId": "uuid-string",
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

`serverTime`、`startTime`、`endTime` 為 Unix timestamp seconds；`remainingTime`、`elapsedTime`、`duration`、`timeUntilStart` 為秒數。若尚未設定完整時間，`remainingTime` 會是 `null`，`status` 會是 `NOT_SCHEDULED`。

---

### 8.8 從面試中移除考生

| 項目       | 值                           |
| ---------- | ---------------------------- |
| **Method** | `DELETE`                     |
| **Path**   | `/interview-candidates/{id}` |
| **認證**   | ✅ Bearer Token (`ADMIN`, `EXAMINER`) |

**Response (204 No Content):** 無回傳本體

---

## 9. 題目指派模組 (Assignments)

此模組用於管理特定面試中的題目指派給特定考生。

### 9.1 指派題目給考生

| 項目       | 值              |
| ---------- | --------------- |
| **Method** | `POST`          |
| **Path**   | `/assignments`  |
| **認證**   | ✅ Bearer Token (`ADMIN`, `EXAMINER`, `QUESTIONER`) |

**Request Body:**

```json
{
  "jobId": 1,
  "userId": "uuid-string",
  "problemId": 1
}
```

**Response (201 Created):**

```json
{
  "id": "1",
  "jobId": "1",
  "userId": "uuid-string",
  "problemId": "1",
  "createdAt": "2026-05-18T08:00:00.000Z"
}
```

---

### 9.2 取得題目指派列表

| 項目       | 值             |
| ---------- | -------------- |
| **Method** | `GET`          |
| **Path**   | `/assignments` |
| **認證**   | ❌ (公開)      |

**Response (200 OK):**

```json
[
  {
    "id": "1",
    "jobId": "1",
    "userId": "uuid-string",
    "problemId": "1",
    "createdAt": "2026-05-18T08:00:00.000Z"
  }
]
```

---

### 9.3 取得特定使用者的指派列表

| 項目       | 值                           |
| ---------- | ---------------------------- |
| **Method** | `GET`                        |
| **Path**   | `/assignments/user/{userId}` |
| **認證**   | ❌ (公開)                    |

**Response (200 OK):**

```json
[
  {
    "id": "1",
    "jobId": "1",
    "userId": "uuid-string",
    "problemId": "1"
  }
]
```

---

### 9.4 取得單一題目指派

| 項目       | 值                  |
| ---------- | ------------------- |
| **Method** | `GET`               |
| **Path**   | `/assignments/{id}` |
| **認證**   | ❌ (公開)           |

**Response (200 OK):**

```json
{
  "id": "1",
  "jobId": "1",
  "userId": "uuid-string",
  "problemId": "1"
}
```

---

### 9.5 刪除題目指派

| 項目       | 值                  |
| ---------- | ------------------- |
| **Method** | `DELETE`            |
| **Path**   | `/assignments/{id}` |
| **認證**   | ✅ Bearer Token (`ADMIN`, `EXAMINER`, `QUESTIONER`) |

**Response (204 No Content):** 無回傳本體

---

## 10. 壓力測試報告 (Stress Test Reports)

此模組用於收集與展示系統的壓力測試結果，並提供即時的 Dashboard。

### 10.1 新增壓力測試報告

| 項目 | 值 |
|------|------|
| **Method** | `POST` |
| **Path** | `/stress-test-reports` |
| **認證** | 不需要 (內部工具調用) |

**Request Body:**

```json
{
  "testName": "Login Stress Test",
  "endpoint": "/api/v1/auth/login",
  "method": "POST",
  "connections": 100,
  "duration": 30,
  "totalRequests": 5000,
  "successfulReqs": 4900,
  "failedReqs": 50,
  "errors": 50,
  "timeouts": 0,
  "avgLatencyMs": 45.2,
  "p50LatencyMs": 40.1,
  "p99LatencyMs": 120.5,
  "maxLatencyMs": 300.0,
  "avgThroughput": 166.67,
  "statusCodes": "{\"200\":4900,\"500\":100}",
  "assessment": "PASSED",
  "assessmentMsg": "All metrics within acceptable bounds."
}
```

**Response (201 Created):** 建立的報告物件。

---

### 10.2 取得壓力測試報告列表

| 項目 | 值 |
|------|------|
| **Method** | `GET` |
| **Path** | `/stress-test-reports` |
| **認證** | 不需要 |

**Query Parameters:**
- `endpoint` (可選): 篩選特定端點的報告
- `limit` (可選): 限制回傳筆數，預設 50，最大 100

**Response (200 OK):** 報告陣列。

---

### 10.3 取得特定端點最新報告

| 項目 | 值 |
|------|------|
| **Method** | `GET` |
| **Path** | `/stress-test-reports/latest` |
| **認證** | 不需要 |

**Query Parameters:**
- `endpoint` (必填): 端點路徑

**Response (200 OK):** 最新一筆報告物件或 null。

---

### 10.4 取得各端點壓力測試摘要

| 項目 | 值 |
|------|------|
| **Method** | `GET` |
| **Path** | `/stress-test-reports/summary` |
| **認證** | 不需要 |

**Query Parameters:**
- `endpoint` (可選): 篩選特定端點

**Response (200 OK):**

```json
[
  {
    "endpoint": "/api/v1/auth/login",
    "latestReportAt": "2026-05-31T08:00:00.000Z",
    "reportsCount": 5,
    "avgSuccessRate": 98.5,
    "avgP99Latency": 150.2,
    "overallAssessment": "HEALTHY"
  }
]
```

---

### 10.5 取得壓力測試 Dashboard (HTML)

| 項目 | 值 |
|------|------|
| **Method** | `GET` |
| **Path** | `/stress-test-reports/dashboard` |
| **認證** | 不需要 |

**Response (200 OK):** 回傳 HTML 格式的監控儀表板。

---

## 11. API 端點總覽

| #   | Method   | Path                             | 認證        | 說明                 |
| --- | -------- | -------------------------------- | ----------- | -------------------- |
| 1   | `POST`   | `/auth/login`                    | ❌          | 使用者登入           |
| 2   | `POST`   | `/auth/signup`                   | ❌          | 使用者註冊           |
| 3   | `GET`    | `/problems`                      | ❌          | 題目列表             |
| 4   | `GET`    | `/problems/:id`                  | ❌          | 題目詳情             |
| 5   | `POST`   | `/problems`                      | 🔒 ADMIN / QUESTIONER | 新增題目             |
| 6   | `PATCH`  | `/problems/:id`                  | 🔒 ADMIN / QUESTIONER | 編輯題目             |
| 7   | `DELETE` | `/problems/:id`                  | 🔒 ADMIN / QUESTIONER | 刪除題目             |
| 8   | `POST`   | `/problems/:id/assign`           | 🔒 ADMIN / EXAMINER / QUESTIONER | 指派題目             |
| 9   | `POST`   | `/submissions`                   | 🔒 ADMIN / CANDIDATE | 提交程式碼           |
| 10  | `GET`    | `/submissions/:id`               | ❌          | 查詢評測結果         |
| 11  | `GET`    | `/users`                         | ❌          | 使用者列表           |
| 12  | `GET`    | `/users/:username/submissions`   | ❌          | 使用者提交歷史       |
| 13  | `GET`    | `/leaderboard`                   | ❌          | 排行榜               |
| 14  | `GET`    | `/health`                        | ❌          | 健康檢查             |
| 15  | `GET`    | `/internal/testcases/:id`        | 🔑 Internal | 評測機測資           |
| 16  | `POST`   | `/interviews`                    | 🔒 ADMIN / EXAMINER | 建立面試             |
| 17  | `GET`    | `/interviews`                    | ❌          | 取得面試列表         |
| 18  | `PATCH`  | `/interviews/:id`                | 🔒 ADMIN / EXAMINER | 更改面試名稱         |
| 19  | `DELETE` | `/interviews/:id`                | 🔒 ADMIN / EXAMINER | 刪除面試             |
| 20  | `POST`   | `/interview-candidates`          | 🔒 ADMIN / EXAMINER | 新增面試者           |
| 21  | `GET`    | `/interview-candidates`          | ❌          | 取得所有面試考生列表 |
| 22  | `PATCH`  | `/interview-candidates/:id/time` | 🔒 ADMIN / EXAMINER | 更新面試考生測驗時間 |
| 23  | `GET`    | `/interview-candidates/:id/time-status` | 🔒 ADMIN / EXAMINER / CANDIDATE | 取得伺服器時間與剩餘時間 |
| 24  | `DELETE` | `/interview-candidates/:id`      | 🔒 ADMIN / EXAMINER | 移除面試者           |
| 25  | `POST`   | `/assignments`                   | 🔒 ADMIN / EXAMINER / QUESTIONER | 指派題目給考生       |
| 26  | `GET`    | `/assignments`                   | ❌          | 取得題目指派列表     |
| 27  | `GET`    | `/assignments/user/:userId`      | ❌          | 取得特定使用者的指派 |
| 28  | `GET`    | `/assignments/:id`               | ❌          | 取得單一指派         |
| 29  | `DELETE` | `/assignments/:id`               | 🔒 ADMIN / EXAMINER / QUESTIONER | 刪除題目指派         |
| 30  | `POST`   | `/stress-test-reports`           | ❌          | 新增壓力測試報告     |
| 31  | `GET`    | `/stress-test-reports`           | ❌          | 取得壓力測試報告列表 |
| 32  | `GET`    | `/stress-test-reports/latest`    | ❌          | 取得端點最新報告     |
| 33  | `GET`    | `/stress-test-reports/summary`   | ❌          | 取得壓力測試摘要     |
| 34  | `GET`    | `/stress-test-reports/dashboard` | ❌          | 取得監控 Dashboard   |
