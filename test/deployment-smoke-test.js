const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:4100';
const apiBase = `${baseUrl}/api/v1`;

async function assertOk(path, description) {
  const response = await fetch(`${apiBase}${path}`);
  if (!response.ok) {
    throw new Error(
      `${description} failed: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

async function run() {
  const live = await assertOk('/health/live', 'liveness probe');
  if (live.status !== 'UP') {
    throw new Error(`liveness status must be UP, got ${live.status}`);
  }

  const ready = await assertOk('/health/ready', 'readiness probe');
  if (ready.status !== 'UP') {
    throw new Error(`readiness status must be UP, got ${ready.status}`);
  }

  const problems = await assertOk('/problems?page=1&limit=1', 'problems list');
  if (!Array.isArray(problems.items)) {
    throw new Error('problems list did not return items array');
  }

  console.log('Deployment smoke test passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
