#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_DIR="$ROOT_DIR/.deploy"
ENV_FILE="$ENV_DIR/deploy.env"
JUDGE_TMP_DIR="${JUDGE_TMP_DIR:-/tmp/code-judge-workspaces}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-90}"

fail() {
  echo "Deploy failed: $*" >&2
  exit 1
}

random_hex() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  elif command -v od >/dev/null 2>&1; then
    od -An -N32 -tx1 /dev/urandom | tr -d ' \n'
  else
    date +%s | sha256sum | awk '{print $1}'
  fi
}

ensure_env_var() {
  local key="$1"
  local value="$2"

  if ! grep -qE "^${key}=" "$ENV_FILE"; then
    printf '%s=%s\n' "$key" "$value" >>"$ENV_FILE"
  fi
}

replace_env_var() {
  local key="$1"
  local value="$2"

  if grep -qE "^${key}=" "$ENV_FILE"; then
    sed -i.bak -E "s#^${key}=.*#${key}=${value}#" "$ENV_FILE"
    rm -f "${ENV_FILE}.bak"
  else
    printf '%s=%s\n' "$key" "$value" >>"$ENV_FILE"
  fi
}

env_value() {
  local key="$1"
  awk -F= -v key="$key" '
    $1 == key {
      sub(/^[^=]*=/, "")
      gsub(/^"|"$/, "")
      print
      exit
    }
  ' "$ENV_FILE"
}

if ! command -v docker >/dev/null 2>&1; then
  fail "Docker is required. Install Docker, then run this command again."
fi

if ! docker info >/dev/null 2>&1; then
  fail "Docker daemon is not available. Start Docker, then run this command again."
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  fail "Docker Compose is required. Install the Docker Compose plugin or docker-compose."
fi

mkdir -p "$ENV_DIR"
if [ ! -f "$ENV_FILE" ]; then
  {
    echo "DATABASE_URL=file:/app/data/code_judge.db"
    echo "SQLITE_DB_FILE=/app/data/code_judge.db"
    echo "JWT_SECRET=$(random_hex)"
    echo "JWT_EXPIRES_IN=86400"
    echo "INTERNAL_API_KEY=$(random_hex)"
    echo "PORT=${PORT:-4100}"
    echo "HOST_PORT=${HOST_PORT:-4100}"
    echo "JUDGE_QUEUE_DRIVER=redis"
    echo "REDIS_URL=redis://redis:6379"
    echo "SEED_DB=${SEED_DB:-false}"
    echo "JUDGE_CONCURRENCY=${JUDGE_CONCURRENCY:-2}"
    echo "JUDGE_JOB_ATTEMPTS=${JUDGE_JOB_ATTEMPTS:-3}"
    echo "JUDGE_STUCK_AFTER_SECONDS=${JUDGE_STUCK_AFTER_SECONDS:-300}"
    echo "JUDGE_TMP_DIR=$JUDGE_TMP_DIR"
  } >"$ENV_FILE"
  chmod 600 "$ENV_FILE"
else
  if grep -qE "^DATABASE_URL=file:\./data/code_judge\.db$" "$ENV_FILE"; then
    replace_env_var "DATABASE_URL" "file:/app/data/code_judge.db"
  else
    ensure_env_var "DATABASE_URL" "file:/app/data/code_judge.db"
  fi
  ensure_env_var "SQLITE_DB_FILE" "/app/data/code_judge.db"
  ensure_env_var "JWT_SECRET" "$(random_hex)"
  ensure_env_var "JWT_EXPIRES_IN" "86400"
  ensure_env_var "INTERNAL_API_KEY" "$(random_hex)"
  ensure_env_var "PORT" "${PORT:-4100}"
  ensure_env_var "HOST_PORT" "${HOST_PORT:-4100}"
  ensure_env_var "JUDGE_QUEUE_DRIVER" "redis"
  ensure_env_var "REDIS_URL" "redis://redis:6379"
  ensure_env_var "SEED_DB" "${SEED_DB:-false}"
  ensure_env_var "JUDGE_CONCURRENCY" "${JUDGE_CONCURRENCY:-2}"
  ensure_env_var "JUDGE_JOB_ATTEMPTS" "${JUDGE_JOB_ATTEMPTS:-3}"
  ensure_env_var "JUDGE_STUCK_AFTER_SECONDS" "${JUDGE_STUCK_AFTER_SECONDS:-300}"
  ensure_env_var "JUDGE_TMP_DIR" "$JUDGE_TMP_DIR"
fi

mkdir -p "$JUDGE_TMP_DIR"
chmod 1777 "$JUDGE_TMP_DIR" 2>/dev/null || true
if [ ! -w "$JUDGE_TMP_DIR" ]; then
  fail "Judge temp directory is not writable: $JUDGE_TMP_DIR"
fi

HOST_PORT_VALUE="${HOST_PORT:-$(env_value HOST_PORT)}"
HEALTH_URL="http://localhost:${HOST_PORT_VALUE}/api/v1/health/ready"

cd "$ROOT_DIR"

echo "Building and starting Code Judge backend..."
"${COMPOSE[@]}" --env-file "$ENV_FILE" up -d --build

check_health() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS "$HEALTH_URL" >/dev/null 2>&1
    return $?
  fi

  if command -v wget >/dev/null 2>&1; then
    wget -qO- "$HEALTH_URL" >/dev/null 2>&1
    return $?
  fi

  local container_id
  container_id="$("${COMPOSE[@]}" --env-file "$ENV_FILE" ps -q backend-api 2>/dev/null || true)"
  if [ -z "$container_id" ]; then
    return 1
  fi

  docker exec "$container_id" node -e "
    fetch('http://127.0.0.1:' + (process.env.PORT || 4100) + '/api/v1/health')
      .then((response) => process.exit(response.ok ? 0 : 1))
      .catch(() => process.exit(1));
  " >/dev/null 2>&1
}

echo "Waiting for health check: $HEALTH_URL"
deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
until check_health; do
  if [ "$SECONDS" -ge "$deadline" ]; then
    "${COMPOSE[@]}" --env-file "$ENV_FILE" logs --tail=120 backend-api >&2 || true
    fail "Backend did not become healthy within ${HEALTH_TIMEOUT_SECONDS}s."
  fi
  sleep 2
done

cat <<EOF
Deploy complete.

API:      http://localhost:${HOST_PORT_VALUE}/api/v1
Swagger:  http://localhost:${HOST_PORT_VALUE}/api/docs
Health:   $HEALTH_URL
Logs:     ${COMPOSE[*]} --env-file .deploy/deploy.env logs -f backend-api judge-worker
Stop:     ${COMPOSE[*]} --env-file .deploy/deploy.env down
EOF
