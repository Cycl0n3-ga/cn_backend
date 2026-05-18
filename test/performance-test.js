/*
 * Performance Test — Code Judge API
 *
 * A pass/fail performance check intended for CI.
 * Requires server running (default: http://localhost:4100).
 *
 * Usage:
 *   npm run test:perf
 *
 * Env:
 *   PERF_BASE_URL=http://localhost:4100
 *   PERF_P99_MS=500
 */

const autocannon = require('autocannon');

const BASE_URL = process.env.PERF_BASE_URL || 'http://localhost:4100';
const P99_THRESHOLD_MS = Number(process.env.PERF_P99_MS || 500);

const scenarios = [
  {
    name: 'Health',
    url: `${BASE_URL}/api/v1/health`,
    connections: 20,
    duration: 10,
  },
  {
    name: 'Problems List',
    url: `${BASE_URL}/api/v1/problems?page=1&limit=20`,
    connections: 20,
    duration: 10,
  },
  {
    name: 'Leaderboard',
    url: `${BASE_URL}/api/v1/leaderboard?page=1&limit=20`,
    connections: 20,
    duration: 10,
  },
];

async function run() {
  console.log(`Performance Test Base URL: ${BASE_URL}`);
  console.log(`P99 threshold: ${P99_THRESHOLD_MS}ms`);

  let failed = false;

  for (const s of scenarios) {
    console.log(`\n--- ${s.name} ---`);
    const result = await autocannon({
      url: s.url,
      connections: s.connections,
      duration: s.duration,
      pipelining: 1,
    });

    console.log(autocannon.printResult(result));

    const p99 = result.latency.p99;
    const errors = result.errors;
    const timeouts = result.timeouts;

    if (p99 > P99_THRESHOLD_MS) {
      failed = true;
      console.error(`FAIL: ${s.name} P99=${p99}ms > ${P99_THRESHOLD_MS}ms`);
    }
    if (errors > 0 || timeouts > 0) {
      failed = true;
      console.error(`FAIL: ${s.name} errors=${errors} timeouts=${timeouts}`);
    }
  }

  if (failed) {
    process.exitCode = 1;
    return;
  }

  console.log('\nPASS: All scenarios within thresholds.');
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
