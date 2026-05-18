# CONTRIBUTING.md - 貢獻指南

線上程庫碼評測系統後端 - 開發者貢獻指南

## 目錄
- [貢獻流程](#貢獻流程)
- [開發規範](#開發規範)
- [程庫碼風格](#程庫碼風格)
- [提交規範](#提交規範)
- [PR审查](#pr审查)
- [發布流程](#發布流程)

---

## 貢獻流程

### 1. Fork項目

```bash
# 在GitHub上fork項目到您的帳戶
# https://github.com/example/cn_22_backend/fork
```

### 2. 克隆您的fork

```bash
git clone https://github.com/YOUR_USERNAME/cn_22_backend.git
cd cn_22_backend
```

### 3. 新增上游仓程庫庫

```bash
git remote add upstream https://github.com/example/cn_22_backend.git
git fetch upstream
```

### 4. 建立特性分支

```bash
# 始终從最新的main分支建立
git checkout -b feature/your-feature-name

# 或修正分支
git checkout -b bugfix/your-bug-fix-name

# 或檔案分支
git checkout -b docs/your-docs-update
```

### 5. 提交變更

```bash
# 確保程庫碼通過检查
npm run lint -- --fix
npm run format

# 執行測試
npm run test

# 提交（遵迴提交規範）
git commit -m "feat: add new feature"
```

### 6. 推送到您的fork

```bash
git push origin feature/your-feature-name
```

### 7. 建立Pull Request

- 在GitHub上建立PR
- 提供清晰的描述
- 链接相关Issue（如有）
- 確保CI/CD通過

### 8. 程庫碼审查和修改

- 接受維護者的反馈
- 進行必要的修改
- 繼續推送更新

### 9. 合并

- 維護者合并您的PR
- 刪除特性分支

---

## 開發規範

### 項目結構遵迴

```
src/
├── [feature]/                 # 功能模組
│   ├── [feature].controller.ts
│   ├── [feature].service.ts
│   ├── [feature].module.ts
│   ├── dto/
│   │   └── [feature].dto.ts
│   └── [feature].spec.ts
```

### 新增模組流程

#### 1. 建立模組結構

```bash
# 使用NestJS CLI建立模組
nest generate module posts
nest generate controller posts
nest generate service posts
```

#### 2. 建立DTO

```typescript
// src/posts/dto/create-post.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  description: string;
}
```

#### 3. 實現Service

```typescript
// src/posts/posts.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PostsService {
  constructor(private prismaService: PrismaService) {}

  create(data: CreatePostDto) {
    return this.prismaService.post.create({ data });
  }

  findAll() {
    return this.prismaService.post.findMany();
  }

  findOne(id: number) {
    return this.prismaService.post.findUnique({ where: { id } });
  }

  update(id: number, data: UpdatePostDto) {
    return this.prismaService.post.update({ where: { id }, data });
  }

  remove(id: number) {
    return this.prismaService.post.delete({ where: { id } });
  }
}
```

#### 4. 實現Controller

```typescript
// src/posts/posts.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';

@Controller('posts')
export class PostsController {
  constructor(private postsService: PostsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreatePostDto) {
    return this.postsService.create(dto);
  }

  @Get()
  findAll() {
    return this.postsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.postsService.findOne(+id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.postsService.remove(+id);
  }
}
```

#### 5. 註冊模組

```typescript
// src/app.module.ts
import { PostsModule } from './posts/posts.module';

@Module({
  imports: [
    // ... other modules
    PostsModule,
  ],
})
export class AppModule {}
```

#### 6. 編写測試

```typescript
// src/posts/posts.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from './posts.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PostsService', () => {
  let service: PostsService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        {
          provide: PrismaService,
          useValue: {
            post: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('應該返回所有文章', async () => {
    const mockPosts = [{ id: 1, title: 'Test' }];
    jest.spyOn(prismaService.post, 'findMany').mockResolvedValue(mockPosts);

    const result = await service.findAll();
    expect(result).toEqual(mockPosts);
  });
});
```

### 資料庫變更

#### 建立遷移

```bash
# 修改prisma/schema.prisma后
npx prisma migrate dev --name add_posts_table
```

#### 遷移檔案示範

```prisma
-- prisma/migrations/20250518000000_add_posts_table/migration.sql

-- CreateTable
CREATE TABLE "posts" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users" ("id")
);

-- CreateIndex
CREATE INDEX "posts_authorId_idx" ON "posts"("authorId");
```

---

## 程庫碼風格

### TypeScript風格

#### 类型定義

```typescript
// ✅ 好：總是使用完整类型
function processUser(user: User): Promise<User> {
  // ...
}

// ❌ 避免：使用any
function processUser(user: any): any {
  // ...
}
```

#### 命名約定

```typescript
// ✅ 好
class UserService {}
interface IUser {}
const isActive = true;
const MAX_RETRIES = 3;

// ❌ 避免
class user_service {}
interface User_ {}
const is_active = true;
const maxRetries = 3;
```

#### 装饰器使用

```typescript
// ✅ 好：合理使用装饰器
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  @Get()
  @Roles('ADMIN')
  getAllUsers() {}
}

// ❌ 避免：過度使用装饰器
```

### 格庫化

所有程庫碼自動格庫化：

```bash
npm run format
```

### Linting

```bash
# 检查程庫碼
npm run lint

# 自動修正
npm run lint -- --fix
```

---

## 提交規範

遵迴 [Conventional Commits](https://www.conventionalcommits.org/)

### 提交格庫

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type类型

| 类型 | 說明 |
|------|------|
| **feat** | 新功能 |
| **fix** | 修正bug |
| **docs** | 檔案更新 |
| **style** | 程庫碼風格（不影響功能） |
| **refactor** | 重構程庫碼 |
| **perf** | 效能優化 |
| **test** | 新增或更新測試 |
| **chore** | 構建工具、相相性更新 |

### 提交示範

```bash
# 新功能
git commit -m "feat(auth): add email verification"

# bug修正
git commit -m "fix(submissions): correct timeout calculation"

# 檔案更新
git commit -m "docs: update installation guide"

# 重構
git commit -m "refactor(users): simplify user validation logic"

# 含詳細描述
git commit -m "feat(problems): add difficulty filter

- Add difficulty parameter to problems endpoint
- Update API documentation
- Add unit tests for filtering logic

Closes #123"
```

---

## PR审查

### PR模板

```markdown
## 描述
請描述這個PR的目的和改動內容

## 类型
- [ ] 新功能
- [ ] bug修正
- [ ] 檔案更新
- [ ] 程庫碼重構

## 測試
請描述如何測試這些變更

- [ ] 單元測試已通過
- [ ] 整合測試已通過
- [ ] E2E測試已通過

## 检查清單
- [ ] 程庫碼遵迴風格指南
- [ ] 自檔案化（清晰的變數名、注釋）
- [ ] 新增了必要的注釋
- [ ] 更新了相关檔案
- [ ] 沒有产生新的警告

## 相关Issue
Closes #<issue_number>
```

### 审查流程

1. **自動检查**
   - 程庫碼風格检查 (ESLint)
   - 單元測試
   - 整合測試
   - 涵蓋率检查

2. **程庫碼审查**
   - 至少1名維護者审查
   - 检查逻辑正确性
   - 检查效能影響
   - 检查安全性

3. **測試驗證**
   - 功能測試通過
   - 不影響其他功能
   - 效能基準達標

4. **檔案审查**
   - 更新了API檔案
   - 更新了相关README
   - 新增了變更日誌

---

## 發布流程

### 版本号規範

遵迴 [Semantic Versioning](https://semver.org/)

```
MAJOR.MINOR.PATCH
v1.2.3
 ↓ ↓ ↓
 | | └── 修正版本（bug修正）
 | └────── 次版本号（新功能，向后兼容）
 └──────── 主版本号（破坏性變更）
```

### 發布步驟

1. **更新版本号**
   ```bash
   npm version minor  # 或 patch, major
   ```

2. **更新CHANGELOG**
   ```bash
   # 編辑docs/CHANGELOG.md
   # 新增新版本条目
   ```

3. **建立Git標签**
   ```bash
   git tag -a v1.2.0 -m "Release v1.2.0"
   git push origin v1.2.0
   ```

4. **發布NPM套件**（如适用）
   ```bash
   npm publish
   ```

5. **建立Release**
   - 在GitHub上建立Release
   - 关联標签
   - 新增發布說明

---

## 開發工作流示範

```bash
# 1. 同步上游
git fetch upstream
git rebase upstream/main

# 2. 建立特性分支
git checkout -b feat/add-caching

# 3. 進行開發
# - 修改程庫碼
# - 新增測試
# - 更新檔案

# 4. 本地驗證
npm run lint -- --fix
npm run format
npm run test
npm run test:cov

# 5. 提交
git add .
git commit -m "feat(cache): add redis caching layer"

# 6. 推送
git push origin feat/add-caching

# 7. 建立PR并等待审查

# 8. 根据反馈進行修改
git add .
git commit -m "refactor: address review comments"
git push origin feat/add-caching

# 9. PR合并后，清理本地分支
git checkout main
git pull upstream main
git branch -d feat/add-caching
```

---

## 常见问题

### Q: 我的PR多久会被审查？

A: 通常在1-2个工作日內。如果沒有及時回復，可以在PR中@維護者。

### Q: PR中途被要求改動，如何操作？

A: 進行修改后直接推送到同一分支，GitHub会自動更新PR。

### Q: 如何解决merge冲突？

```bash
# 更新主分支
git fetch upstream
git rebase upstream/main

# 解决冲突后
git add .
git rebase --continue
git push -f origin feature/your-feature
```

### Q: 我的提交历史很混乱怎么办？

```bash
# 交互庫rebase整理提交
git rebase -i upstream/main

# 在編辑器中选择操作（squash, reorder等）
```

---

## 行为準则

我们致力於建立一个套件容、友好的社區。

- 尊重所有貢獻者
- 使用套件容的语言
- 专注於程庫碼讨论，而不是个人攻击
- 報告不當行为給項目維護者

---

## 得得幫助

- **檔案**: [檔案目錄](PROJECT_STRUCTURE.md)
- **讨论**: GitHub Discussions
- **Issue**: GitHub Issues
- **邮件**: maintainers@example.com

感謝您的貢獻！ 🎉

---

## 相关檔案

- [SETUP_GUIDE.md](SETUP_GUIDE.md) - 開發環境設置
- [TESTING_GUIDE.md](TESTING_GUIDE.md) - 測試指南
- [CHANGELOG.md](CHANGELOG.md) - 版本日誌
