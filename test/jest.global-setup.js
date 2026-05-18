const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execSync } = require('node:child_process');

function createRunId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

module.exports = async () => {
  const runId = createRunId();
  const testDir = __dirname;
  const repoRoot = path.resolve(testDir, '..');
  const tmpDir = path.join(testDir, '.tmp');

  fs.mkdirSync(tmpDir, { recursive: true });

  const dbFile = path.join(tmpDir, `jest-${runId}.db`);
  const dbUrl = `file:${dbFile}`;

  // Ensure tests use an isolated DB and deterministic secrets.
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = dbUrl;
  process.env.JWT_SECRET = 'jest-test-secret';
  process.env.JWT_EXPIRES_IN = '3600';
  process.env.INTERNAL_API_KEY = 'jest-internal-api-key';

  const stateFile = path.join(tmpDir, `jest-db-state-${runId}.json`);
  process.env.JEST_DB_STATE_PATH = stateFile;

  fs.writeFileSync(
    stateFile,
    JSON.stringify(
      {
        runId,
        dbFile,
        dbUrl,
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    'utf8',
  );

  const childEnv = { ...process.env, DATABASE_URL: dbUrl };

  // Apply migrations and seed sample data.
  execSync('npx prisma migrate deploy', {
    cwd: repoRoot,
    env: childEnv,
    stdio: 'inherit',
  });

  execSync('npx prisma db seed', {
    cwd: repoRoot,
    env: childEnv,
    stdio: 'inherit',
  });
};
