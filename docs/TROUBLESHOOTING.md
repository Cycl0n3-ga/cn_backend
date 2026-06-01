# 故障排除

## API 無法啟動

- 確認 Node.js 版本符合專案需求；Docker/CI 使用 Node.js 22。
- 確認 `.env` 或 `.deploy/deploy.env` 內的 `JWT_SECRET` 至少 32 字元。
- 若看到 Prisma 連線錯誤，先確認 `DATABASE_URL` 指向可寫入的 SQLite 檔案路徑。

## Docker 部署健康檢查失敗

- 使用 `npm run deploy` 時，腳本會產生 `.deploy/deploy.env` 並等待 `http://localhost:${HOST_PORT}/api/v1/health/ready`。
- 若主機的 `HOST_PORT` 已被占用，先設定另一個 port，例如：

```bash
HOST_PORT=4101 npm run deploy
```

- 查看容器日誌：

```bash
docker compose --env-file .deploy/deploy.env logs -f backend-api judge-worker redis
```

## Submission 卡在 PENDING 或 RUNNING

1. 查看 submission detail 的 `judge_job_id`、`last_error`、`queued_at`、`started_at`。
2. 確認 Redis 正常：

```bash
docker compose --env-file .deploy/deploy.env exec redis redis-cli ping
```

3. 查看 worker 日誌：

```bash
docker compose --env-file .deploy/deploy.env logs -f judge-worker
```

4. 確認 worker 可以存取 Docker daemon：

```bash
docker compose --env-file .deploy/deploy.env exec judge-worker docker info
```

5. 若是部署或重啟造成的舊 job，`JudgeRecoveryService` 會在啟動時 requeue 超過 `JUDGE_STUCK_AFTER_SECONDS` 的 `PENDING/RUNNING` submission。可調整 `.deploy/deploy.env`：

```bash
JUDGE_STUCK_AFTER_SECONDS=300
```

## Redis / BullMQ 連線失敗

- production 必須設定 `JUDGE_QUEUE_DRIVER=redis` 與 `REDIS_URL=redis://redis:6379`。
- 本地單 process 測試可用 `JUDGE_QUEUE_DRIVER=inline`。
- `/api/v1/health/ready` 會在 Redis 不可用時回傳 `status: DOWN`。

## 認證或權限錯誤

- 需要保護的 API 必須帶 `Authorization: Bearer <token>`。
- `GET /submissions/:id` 僅提交者本人、`ADMIN`、`EXAMINER` 可讀取。
- `GET /assignments/user/:userId` 允許本人讀取；`ADMIN`、`EXAMINER`、`QUESTIONER` 可讀取任意使用者指派。
- `POST /stress-test-reports` 需帶 `x-internal-api-key`。

## Seed 資料注意事項

`SEED_DB=true` 會清空既有 demo 資料表後重新灌入測試資料，只適合 demo 或測試環境。
