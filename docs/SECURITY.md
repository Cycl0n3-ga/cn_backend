# SECURITY.md - 安全性指南

線上程式碼評測系統後端 - 安全性指南和最佳實踐

## 目錄

- [安全概覽](#安全概覽)
- [認證安全](#認證安全)
- [資料加密](#資料加密)
- [API安全](#api安全)
- [資料庫安全](#資料庫安全)
- [程式碼評測安全](#程式碼評測安全)
- [相依性安全](#相依性安全)
- [安全稽核](#安全稽核)

---

## 安全概覽

### 威脅模型

```
外部威脅
├── 未授權存取
├── 中間人攻擊
├── SQL 注入
├── 惡意程式碼執行
└── DDoS 攻擊

內部威脅
├── 權限提升
├── 資料泄露
├── 邏輯漏洞
└── 配置錯誤
```

### 安全級別定義

| 級別    | 說明              | 示範                   |
| ------- | ----------------- | ---------------------- |
| 🔒 嚴格 | 需要認證+特定權限 | 建立/刪除項目          |
| 🔐 高   | 需要認證          | 提交程式碼、查看排行榜 |
| 🔓 中   | 部分內容需要認證  | 查看項目詳情           |
| 🔓 低   | 公開存取          | 健康檢查               |

---

## 認證安全

### JWT令牌安全

#### 1. 令牌生成

```typescript
// auth.service.ts
private generateToken(user: User): string {
  return this.jwtService.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
    },
    {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    },
  );
}
```

#### 2. 令牌驗證

```typescript
// jwt.strategy.ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: any) {
    // ✅ 驗證token未過期
    // ✅ 驗證使用者仍然存在且未被禁用
    return {
      userId: payload.sub,
      username: payload.username,
      role: payload.role,
    };
  }
}
```

#### 3. 金鑰管理

```bash
# ✅ 生產環境使用強金鑰 (256-bit)
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# ✅ 定期轮換金鑰（每季度）
# ✅ 不同環境使用不同金鑰
# ❌ 不要在程式碼中硬編碼金鑰
# ❌ 不要在Git中提交金鑰
```

### 密碼安全

#### 1. 密碼哈希

```typescript
// auth.service.ts
import * as bcrypt from 'bcryptjs';

// 註冊時
const passwordHash = await bcrypt.hash(passwordSha256, 10);

// 登入驗證
const isPasswordValid = await bcrypt.compare(inputPasswordSha256, storedHash);
```

#### 2. 密碼策略

```typescript
// ✅ 前端傳送SHA256哈希，後端再用bcrypt加密
// ✅ 最少8字符
// ✅ 套件含大小写字母、數字、特殊字符
// ❌ 不要存存明文密碼
// ❌ 不要使用MD5或SHA1
```

#### 3. 密碼重置

```typescript
// ✅ 生成临時重置令牌（15分鐘有效期）
// ✅ 傳送重置链接到註冊邮箱
// ✅ 驗證身份后才能重置
// ❌ 不要通過邮件傳送新密碼
```

---

## 資料加密

### 传輸層加密

#### 1. 啟用HTTPS/TLS

```bash
# 使用Let's Encrypt生成證书
certbot certonly --standalone -d api.example.com

# 配置Nginx
server {
  listen 443 ssl http2;
  server_name api.example.com;

  ssl_certificate /etc/letsencrypt/live/api.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;
}
```

#### 2. 安全头部

```typescript
// main.ts
import helmet from 'helmet';

app.use(helmet());

// 設置安全響應头
// X-Frame-Options: DENY
// X-Content-Type-Options: nosniff
// X-XSS-Protection: 1; mode=block
// Strict-Transport-Security: max-age=31536000
```

### 資料庫加密

#### 1. 敏感欄位加密

```typescript
// ✅ 密碼欄位：使用bcrypt加密
// ✅ API金鑰欄位：使用AES加密
// ❌ 不要明文存存敏感資訊
```

#### 2. 資料庫連接加密

```bash
# PostgreSQL SSL連接
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
```

---

## API安全

### 輸入驗證

#### 1. DTO驗證

```typescript
// auth/dto/signup.dto.ts
import { IsEmail, MinLength, Matches } from 'class-validator';

export class SignupDto {
  @MinLength(3)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  username: string;

  @IsEmail()
  email: string;

  @MinLength(64)
  @Matches(/^[a-f0-9]{64}$/) // SHA256 hex
  passwordSha256: string;
}
```

#### 2. 請求限制

```typescript
// ✅ 限制請求体大小
app.use(express.json({ limit: '10kb' }));

// ✅ 限制查詢參數
// ✅ 限制檔案上传大小
// ✅ 驗證所有輸入
```

### 輸出安全

#### 1. 資料過濾

```typescript
// ❌ 不要返回敏感欄位
const user = await this.userService.findById(userId);
return {
  id: user.id,
  username: user.username,
  // ❌ 不要返回 passwordHash
  // ❌ 不要返回 email (除非是使用者自己)
};
```

#### 2. 錯誤處理

```typescript
// ✅ 通用錯誤消息
throw new BadRequestException('使用者名或密碼錯誤');

// ❌ 不要暴露詳細錯誤
// ❌ 不要返回堆栈跟踪給客户端
// ❌ 不要暴露系統資訊
```

### CORS配置

```typescript
// app.module.ts
app.enableCors({
  origin: process.env.CORS_ORIGIN?.split(',') || [],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

### 速率限制

```typescript
// 防止暴力破解
@UseGuards(ThrottlerGuard)
@Throttle(5, 60) // 5個請求/分鐘
@Post('auth/login')
login(@Body() dto: LoginDto) {
  // ...
}
```

### CSRF保護

```typescript
// ✅ 使用SameSite Cookie属性
// ✅ 驗證請求来源
// ✅ 使用CSRF令牌（如果使用Session）
```

---

## 資料庫安全

### 存取控制

#### 1. 最小權限原则

```sql
-- 建立仅读使用者
CREATE USER read_only WITH PASSWORD 'password';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO read_only;

-- 建立應用使用者（完整權限）
CREATE USER app_user WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE code_judge TO app_user;
```

#### 2. 連接安全

```bash
# ✅ 使用強密碼
# ✅ 限制連接来源IP
# ✅ 使用SSL連接
# ✅ 更改預設連接埠
# ❌ 不要使用sa/admin帳戶
# ❌ 不要暴露資料庫到互联网
```

### SQL注入防護

```typescript
// ✅ 使用參數化查詢（Prisma自動防護）
const user = await this.prismaService.user.findUnique({
  where: { username: userInput }, // 自動轉義
});

// ❌ 不要構建動态SQL
// const query = `SELECT * FROM users WHERE username = '${username}'`;
```

### 資料庫審計

```sql
-- 啟用日誌
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_min_duration_statement = 1000;

-- 查看日誌
SELECT * FROM pg_log;
```

---

## 程式碼評測安全

### API / Worker 邊界

目前部署已將公開 API 與評測執行分離：

| Service        | Docker socket | User                        | 暴露給外部 |
| -------------- | ------------- | --------------------------- | ---------- |
| `backend-api`  | No            | non-root `node`             | Yes        |
| `judge-worker` | Yes           | root（Compose runner 折衷） | No         |

這個設計降低了公開 API 被攻擊後直接接觸 Docker daemon 的風險。`judge-worker` 仍是高風險邊界，production 若需要更高安全等級，應評估 rootless Docker、gVisor、Firecracker 或獨立 runner host。

### 沙箱隔离

```typescript
// ✅ 在隔离的容器中執行使用者程式碼
// ✅ 限制CPU和記憶體使用
// ✅ 限制執行時間
// ✅ 限制系統呼叫
// ✅ API process 不直接執行使用者程式碼
// ❌ 不要讓公開 API container 掛 Docker socket
```

### 資源限制

```bash
# Docker容器限制
docker run -d \
  --memory="512m" \
  --cpus="1" \
  --read-only \
  --tmpfs /tmp \
  judge-worker
```

### 恶意程式碼防護

```typescript
// ✅ 過濾危險系統呼叫
// ✅ 禁止檔案系統存取
// ✅ 禁止網路存取
// ✅ 檢查執行超時
// ✅ 監控進程行為
```

### Rate limiting

- 全域 rate limit 由 `RequestAwareThrottlerGuard` 控制；有 Bearer token 時以 JWT
  `sub` 作為 user tracker，未登入流量回退到 IP tracker。
- `/auth/login` 有較嚴格的登入嘗試限制。
- `/submissions` 有提交頻率限制，避免候選人短時間大量建立 judge jobs。
- 更高安全等級可再接 Redis-backed throttler，讓多台 API instance 共用 rate limit state。

---

## 依賴安全

### 依賴扫描

```bash
# 檢查已知漏洞
npm audit

# 修正漏洞
npm audit fix

# 更新依賴
npm update

# 定期審查
npm outdated
```

### 依賴鎖定

```bash
# 使用package-lock.json鎖定版本
npm ci  # 使用鎖定的依賴安裝

# 不要使用npm install（可能更新依賴）
```

### 安全依賴

```json
{
  "dependencies": {
    "@nestjs/common": "^11.0.1",
    "bcryptjs": "^3.0.3", // 密碼加密
    "passport": "^0.7.0", // 認證
    "helmet": "^7.0.0" // 安全头部
  },
  "devDependencies": {
    "eslint": "^8.0.0",
    "prettier": "^3.0.0"
  }
}
```

---

## 安全審計

### 定期審計清單

- [ ] 依賴更新檢查 (每月)
- [ ] 金鑰轮換 (每季度)
- [ ] 存取日誌審計 (每周)
- [ ] 渗透測試 (每年)
- [ ] 安全程式碼審查 (每個PR)
- [ ] 合规性檢查 (每半年)

### 安全測試

```bash
# OWASP ZAP扫描
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t http://localhost:4100/api/v1

# Snyk扫描
snyk test

# 程式碼品質檢查
npm run lint
```

### 事件響應

#### 安全事件處理流程

1. **检測和報告** - 發現並報告安全問題
2. **評估** - 評估影響和严重性
3. **遏制** - 采得临時措施防止擴散
4. **根除** - 修正根本原因
5. **復原** - 復原系統正常執行
6. **事后分析** - 分析原因並改進

---

## 安全配置模板

### .env.production

```bash
# 應用
NODE_ENV=production
PORT=4100

# 資料庫
DATABASE_URL=postgresql://app_user:SECURE_PASSWORD@secure-db-host:5432/code_judge

# JWT
JWT_SECRET=<256位隨機字符串>
JWT_EXPIRES_IN=86400

# 內部API
INTERNAL_API_KEY=<強隨機金鑰>
INTERNAL_API_ALLOWED_IPS=10.0.0.0/8

# CORS
CORS_ORIGIN=https://app.example.com,https://www.example.com

# SSL/TLS
HTTPS_ENABLED=true
CERT_PATH=/etc/ssl/certs/fullchain.pem
KEY_PATH=/etc/ssl/private/privkey.pem

# 日誌
LOG_LEVEL=info
LOG_FILE=/var/log/app/combined.log

# 安全
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## 相关資源

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js安全最佳實践](https://nodejs.org/en/docs/guides/security/)
- [NestJS安全指南](https://docs.nestjs.com/security/authentication)
- [Passport.js檔案](http://www.passportjs.org/)

---

## 相关檔案

- [SETUP_GUIDE.md](SETUP_GUIDE.md) - 開發環境設置
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - 部署指南
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - 資料庫模式
