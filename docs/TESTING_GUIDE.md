# TESTING_GUIDE.md - 測試指南

線上程式碼評測系統後端 - 完整的測試執行指南

## 目錄
- [測試概覽](#測試概覽)
- [單元測試](#單元測試)
- [整合測試](#整合測試)
- [E2E測試](#e2e測試)
- [效能測試](#效能測試)
- [測試涵蓋率](#測試涵蓋率)
- [最佳實踐](#最佳實踐)

---

## 測試概覽

項目套件含 4 種類型的測試：

| 測試類型 | 工具 | 範圍 | 執行時間 |
|---------|------|------|---------|
| **單元測試** | Jest | 單個函數/方法 | ~2-5秒 |
| **整合測試** | Jest + 真實DB | 模組交互 | ~10-30秒 |
| **E2E測試** | Jest + Supertest | 完整API流程 | ~5-15秒 |
| **效能測試** | 自訂腳本 | 效能基準 | ~30-60秒 |

---

## 單元測試

### 執行所有單元測試

```bash
npm run test
```

### 監視模式（監視檔案變化，自動重跑）

```bash
npm run test:watch
```

### 執行特定測試檔案

```bash
# 執行auth模組測試
npm run test -- src/auth

# 執行特定檔案
npm run test -- src/auth/auth.service.spec.ts
```

### 單元測試匹配模式

```bash
# 執行名称套件含"auth"的測試
npm run test -- --testNamePattern="auth"

# 執行特定describe块
npm run test -- --testNamePattern="AuthService"
```

### 單元測試結構示範

```typescript
// src/auth/auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('register', () => {
    it('應該建立新使用者', async () => {
      const input = {
        username: 'testuser',
        email: null,
        passwordSha256: 'abc123...',
        role: 'CANDIDATE',
      };

      jest.spyOn(prismaService.user, 'create').mockResolvedValue({
        id: 'uuid',
        username: 'testuser',
        // ...
      } as any);

      const result = await service.register(input);
      expect(result).toBeDefined();
    });
  });
});
```

---

## 整合測試

### 執行所有整合測試

```bash
npm run test:integration
```

**說明：** 整合測試会：
1. 自動建立独立的測試資料庫（`test/.tmp/test.db`）
2. 執行資料庫遷移
3. 灌入种子資料
4. 執行測試
5. 清理測試資料庫

### 執行特定整合測試

```bash
# 執行auth整合測試
npm run test:integration -- auth.integration-spec.ts

# 執行users整合測試
npm run test:integration -- users.integration-spec.ts
```

### 現有整合測試清單

| 測試檔案 | 涵蓋功能 |
|---------|---------|
| `auth.integration-spec.ts` | 登入、註冊、JWT驗證 |
| `users.integration-spec.ts` | 使用者列表、使用者資訊、提交历史 |
| `problems.integration-spec.ts` | 項目列表、項目詳情、項目建立 |
| `leaderboard.integration-spec.ts` | 排行榜查詢、排名計算 |

### 整合測試示範

```typescript
// test/integration/auth.integration-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth Integration Tests', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await prismaService.$disconnect();
    await app.close();
  });

  describe('POST /api/v1/auth/signup', () => {
    it('應該成功註冊使用者', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({
          username: 'newuser',
          email: null,
          passwordSha256: 'e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446',
          role: 'CANDIDATE',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.username).toBe('newuser');
        });
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('應該成功登入', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          username: 'admin',
          passwordSha256: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('access_token');
        });
    });
  });
});
```

---

## E2E測試

### 執行E2E測試

```bash
npm run test:e2e
```

### 執行特定E2E測試

```bash
npm run test:e2e -- app.e2e-spec.ts
```

### E2E測試示範

```typescript
// test/app.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('App E2E', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('完整使用者流程', () => {
    it('1. 使用者應該能夠註冊', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({
          username: 'e2euser',
          email: null,
          passwordSha256: 'e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446',
          role: 'CANDIDATE',
        })
        .expect(201);
    });

    it('2. 使用者應該能夠登入', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          username: 'e2euser',
          passwordSha256: 'hash123',
        })
        .expect(200)
        .expect((res) => {
          token = res.body.access_token;
        });
    });

    it('3. 使用者應該能夠查看问题列表', () => {
      return request(app.getHttpServer())
        .get('/api/v1/problems')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });
});
```

---

## 效能測試

### 效能基準測試

```bash
# 執行效能測試（檢查 P99/錯誤率/超時）
npm run test:perf
```

### 負載測試

```bash
# 需要先啟動服務：npm run start:dev
npm run test:load
```

**說明：** 負載測試会對API進行并發請求，評估系統容數

### 壓力測試

```bash
# 需要先啟動服務：npm run start:dev
npm run test:stress
```

**說明：** 壓力測試会逐步增加負載，找出系統的崩溃点。若要將報告寫回 `/stress-test-reports`，需在執行環境提供 `INTERNAL_API_KEY`。

### 效能測試脚本說明

**load-test.js** - 負載測試
```javascript
// 測試场景：
// - 1000个并發請求
// - 针對GET /api/v1/problems
// - 檢查響應時間和錯誤率
```

**stress-test.js** - 壓力測試
```javascript
// 測試场景：
// - 從100增加到1000个并發連接
// - 監控效能下降曲线
// - 找出系統極限
```

**performance-test.js** - 效能門檻測試
```javascript
// 效能標準：
// - P99響應時間 < 500ms
// - 錯誤率 < 1%
// - 超時率 < 0.5%
// 如果不符合，exit code为非零
```

---

## 測試涵蓋率

### 生成涵蓋率報告

```bash
npm run test:cov
```

輸出：
```
src/auth/auth.service.ts          95.2% (95/100)
src/auth/auth.controller.ts       87.5% (35/40)
src/problems/problems.service.ts  82.0% (41/50)
...
TOTAL                             90.5% (2341/2588)
```

### 打開涵蓋率HTML報告

```bash
# 涵蓋率報告位於 coverage/lcov-report/index.html
open coverage/lcov-report/index.html
```

### 设定涵蓋率阈值

編辑 `jest.config.js`：
```javascript
{
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.module.ts',
    '!src/main.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
}
```

---

## Shell API測試

### 執行Shell整合測試

```bash
# 需要先啟動服務：npm run start:dev
bash test/api-test.sh
```

### 測試內容

```bash
#!/bin/bash
# test/api-test.sh

# 1. 健康檢查
curl http://localhost:4100/api/v1/health

# 2. 使用者註冊
curl -X POST http://localhost:4100/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":null,"passwordSha256":"e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446","role":"CANDIDATE"}'

# 3. 使用者登入
curl -X POST http://localhost:4100/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","passwordSha256":"..."}'

# 4. 得得问题列表
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:4100/api/v1/problems
```

---

## 測試最佳實踐

### 1. 命名約定

```typescript
// ✅ 好
describe('AuthService', () => {
  it('應該成功驗證有效的JWT token', () => {});
  it('應該拒绝過期的token', () => {});
  it('應該拒绝无效签名的token', () => {});
});

// ❌ 避免
it('test', () => {});
it('should work', () => {});
```

### 2. 測試隔离

```typescript
// ✅ 好：每個測試獨立，不依賴執行順序
beforeEach(async () => {
  // 清理資料庫
  await prismaService.user.deleteMany({});
  // 建立測試資料
  await prismaService.user.create({...});
});

// ❌ 避免：測試間有相依性
let userId;
it('建立使用者', () => {
  userId = createUser().id;
});
it('更新使用者', () => {
  updateUser(userId);  // 相依於上一個測試
});
```

### 3. Mock和Stub

```typescript
// ✅ 好：使用jest.fn()建立mock
const mockPrisma = {
  user: {
    findUnique: jest.fn().mockResolvedValue({...}),
  },
};

// ✅ 好：使用jest.spyOn()
jest.spyOn(service, 'someMethod').mockReturnValue('mocked');

// ❌ 避免：過度mock，失去真實測試价值
```

### 4. 異步測試

```typescript
// ✅ 好：正确處理async/await
it('應該成功得得使用者', async () => {
  const user = await userService.findById('id');
  expect(user).toBeDefined();
});

// ✅ 好：使用return處理Promise
it('should find user', () => {
  return userService.findById('id').then((user) => {
    expect(user).toBeDefined();
  });
});

// ❌ 避免：忘记等待Promise
it('should find user', () => {
  userService.findById('id');  // 沒有等待！
});
```

### 5. 斷言程式庫

```typescript
// ✅ 推荐使用的斷言
expect(value).toBeDefined();
expect(value).toEqual(expected);
expect(array).toContain(item);
expect(func).toHrow();
expect(value).toBeGreaterThan(0);
expect(string).toMatch(/regex/);
```

---

## CI/CD整合

### GitHub Actions示範

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm install
      - run: npm run lint
      - run: npm run test
      - run: npm run test:cov
      
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

---

## 測試命令快速參考

```bash
# 單元測試
npm run test                    # 執行所有單元測試
npm run test:watch             # 观察模庫
npm run test:cov               # 涵蓋率報告

# 整合和E2E測試
npm run test:integration       # 整合測試
npm run test:e2e               # E2E測試

# 效能測試
npm run test:perf              # 效能門檻測試
npm run test:load              # 負載測試
npm run test:stress            # 壓力測試

# 其他
bash test/api-test.sh          # Shell API測試
```

---

## 相关檔案

- [README.md](../README.md) - 項目快速開始
- [SETUP_GUIDE.md](SETUP_GUIDE.md) - 開發環境設置
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - 部署指南
