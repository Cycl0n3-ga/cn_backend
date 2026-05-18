# SETUP_GUIDE.md - 開發環境設定指南

線上程式碼評測系統後端 - 完整的開發環境配置指南

## 目錄
- [系統要求](#系統要求)
- [快速開始](#快速開始)
- [詳細配置](#詳細配置)
- [常見問題](#常見問題)

---

## 系統要求

### 必需軟體

| 軟體 | 版本 | 用途 |
|------|------|------|
| Node.js | 18.x 或更高 | 執行時環境 |
| npm | 9.x 或更高 | 套件管理器 |
| Git | 最新版 | 版本控制 |

### 可選軟體

| 軟體 | 版本 | 用途 |
|------|------|------|
| Docker | 24.x 或更高 | 容器化 |
| Docker Compose | 2.x 或更高 | 多容器編排 |
| PostgreSQL | 15.x 或更高 | 生產資料庫 |
| Redis | 7.x 或更高 | 快取層（未來功能） |

---

## 快速開始

### 1. 克隆項目

```bash
git clone <repository-url>
cd cn_22_backend
```

### 2. 安裝相依性

```bash
npm install
```

### 3. 配置環境變數

建立 `.env` 檔案在項目根目錄：

```bash
# 資料庫配置
DATABASE_URL=file:./data/code_judge.db

# JWT配置
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=86400

# 內部API配置
INTERNAL_API_KEY=internal-judge-worker-key

# 服務配置
PORT=4100
NODE_ENV=development
```

### 4. 初始化資料庫

```bash
# 執行遷移
npm run db:migrate

# （可选）灌入种子資料
npm run db:seed
```

### 5. 啟動開發服務器

```bash
npm run start:dev
```

**驗證啟動：**
```
[Nest] 123456   - 05/18/2025, 10:30:00 AM     LOG [NestFactory] Starting Nest application...
[Nest] 123456   - 05/18/2025, 10:30:01 AM     LOG [InstanceLoader] AppModule dependencies initialized
[Nest] 123456   - 05/18/2025, 10:30:01 AM     LOG [RoutesResolver] AppController {/api/v1}:
```

### 6. 存取應用

- **API檔案**: http://localhost:4100/api/docs
- **API根路径**: http://localhost:4100/api/v1
- **健康檢查**: http://localhost:4100/api/v1/health

---

## 詳細配置

### 環境變數詳解

#### 資料庫配置

**SQLite (開發環境預設)**
```env
DATABASE_URL=file:./data/code_judge.db
```

**PostgreSQL (生产環境推荐)**
```env
DATABASE_URL=postgresql://username:password@localhost:5432/code_judge
```

#### JWT配置

```env
# JWT 簽名密鑰 (生產環境使用強密鑰)
JWT_SECRET=your-very-secret-key-with-at-least-32-characters

# Token過期時間 (秒)
JWT_EXPIRES_IN=86400  # 24小時
```

生成安全密鑰：
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### 內部API配置

```env
# 評測機存取密鑰
INTERNAL_API_KEY=internal-judge-worker-secret-key

# 內部API允許的IP (可选)
INTERNAL_API_ALLOWED_IPS=127.0.0.1,10.0.0.0/8
```

#### 服務配置

```env
# 應用監聽連接埠
PORT=4100

# 執行環境
NODE_ENV=development  # development | production | test
```

---

### IDE配置（VS Code推荐）

#### 推荐擴展插件

1. **Prettier** (esbenp.prettier-vscode)
   - 程式碼格式化

2. **ESLint** (dbaeumer.vscode-eslint)
   - 程庫碼检查

3. **REST Client** (humao.rest-client)
   - API測試

4. **Prisma** (prisma.prisma)
   - ORM支持

5. **Thunder Client** 或 **REST Client**
   - API調试工具

#### VS Code settings.json

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[typescript]": {
    "editor.codeActionsOnSave": {
      "source.fixAll.eslint": true
    }
  },
  "editor.tabSize": 2,
  "editor.insertSpaces": true
}
```

---

### Git配置

#### 初始化Git提交

```bash
git init
git add .
git commit -m "Initial commit: Online Code Judge Backend"
```

#### 推荐的.gitignore配置

```
# 相依性
node_modules/
package-lock.json

# 構建产物
dist/
build/

# 環境變數
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# 日誌
logs/
*.log
npm-debug.log*

# 測試涵蓋率
coverage/

# 資料庫
*.db
*.db-journal
data/

# 临時檔案
.tmp/
temp/
```

---

### Docker開發環境

#### 本地Docker開發

**啟動服務：**
```bash
# 構建并啟動
docker compose up -d

# 查看日誌
docker compose logs -f backend-api

# 停止服務
docker compose down
```

**啟動并灌入种子資料：**
```bash
SEED_DB=true docker compose up -d --build
```

#### Docker Compose配置說明

```yaml
# docker-compose.yml
services:
  backend-api:
    build: .                      # 使用Dockerfile構建
    container_name: code-judge-backend
    ports:
      - "4100:4100"              # 映射連接埠
    environment:
      DATABASE_URL: file:./data/code_judge.db
      JWT_SECRET: production-secret-key-change-me
      SEED_DB: false
    volumes:
      - backend_data:/app/data   # 資料庫持久化
    restart: always
```

---

### 本地PostgreSQL設置

**安装PostgreSQL：**

*macOS (Homebrew)*
```bash
brew install postgresql@15
brew services start postgresql@15
```

*Ubuntu/Debian*
```bash
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

*Windows*
- 下載安装程序: https://www.postgresql.org/download/windows/

**建立資料庫和使用者：**

```bash
# 連接PostgreSQL
psql -U postgres

# 建立資料庫
CREATE DATABASE code_judge;

# 建立使用者
CREATE USER judge_user WITH PASSWORD 'your_password';

# 授予權限
ALTER ROLE judge_user WITH CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE code_judge TO judge_user;

# 退出
\q
```

**更新.env：**
```env
DATABASE_URL=postgresql://judge_user:your_password@localhost:5432/code_judge
```

---

### 程式碼檢查和格式化

**ESLint 檢查：**
```bash
npm run lint
```

**Prettier 格式化：**
```bash
npm run format
```

**自動修正：**
```bash
npm run lint -- --fix
```

---

### Prisma配置

#### 生成Prisma客户端

```bash
npx prisma generate
```

#### 打開Prisma Studio（資料庫可视化）

```bash
npx prisma studio
```

打開 http://localhost:5555 来可视化和編辑資料

---

## 常见问题

### Q: 啟動時報错"找不到模組"

**A:** 清理并重新安装：
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Q: 資料庫連接失敗

**A:** 檢查以下幾點：
1. `.env`檔案中`DATABASE_URL`配置正确
2. 資料庫服務已啟動
3. 資料庫使用者有正确的權限

```bash
# 檢查 SQLite 檔案
ls -la data/

# 檢查 PostgreSQL 連接
psql -U judge_user -d code_judge -h localhost
```

### Q: Port 4100已被佔用

**A:** 更改`.env`中的PORT或杀死佔用進程：

```bash
# 查找佔用進程
lsof -i :4100

# 杀死進程
kill -9 <PID>

# 或更改PORT
echo "PORT=4101" >> .env
```

### Q: JWT驗證失敗

**A:** 確保：
1. `JWT_SECRET`配置正确
2. Token 格式正確：`Authorization: Bearer <token>`
3. Token未過期

```bash
# 生成新密鑰
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Q: Prisma遷移冲突

**A:**
```bash
# 重置開發資料庫（小心！会刪除資料）
npx prisma migrate reset

# 或建立新遷移
npx prisma migrate dev --name <migration_name>
```

### Q: 效能问题或慢查詢

**A:** 檢查：
1. 資料庫索引是否正确建立
2. 查詢是否有N+1问题
3. 是否需要新增快得层

```bash
# 生成Prisma查詢日誌
DEBUG=prisma:* npm run start:dev
```

---

## 建議的開發工作流

### 1. 功能開發流程

```bash
# 建立特性分支
git checkout -b feature/my-feature

# 建立資料庫遷移（如需要）
npx prisma migrate dev --name add_my_feature

# 開發并測試
npm run start:dev

# 執行測試
npm run test

# 程庫碼检查和格庫化
npm run lint -- --fix
npm run format

# 提交程式碼
git add .
git commit -m "feat: add my feature"

# 推送
git push origin feature/my-feature
```

### 2. 測試開發流程

```bash
# 執行所有測試
npm run test

# 观察模庫（自動重跑）
npm run test:watch

# 查看涵蓋率
npm run test:cov

# 執行整合測試
npm run test:integration

# 執行E2E測試
npm run test:e2e
```

### 3. 效能優化工作流

```bash
# 效能測試
npm run test:perf

# 負載測試
npm run test:load

# 壓力測試
npm run test:stress
```

---

## 相关檔案

- [README.md](../README.md) - 快速開始
- [TESTING_GUIDE.md](TESTING_GUIDE.md) - 測試指南
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - 部署指南
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - 資料庫模庫
