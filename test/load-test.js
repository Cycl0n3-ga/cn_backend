/**
 * Load Test — Code Judge API
 *
 * Uses autocannon to simulate concurrent users hitting the API.
 * Covers: health, problems, leaderboard, users, auth/login endpoints.
 *
 * Usage: npm run test:load (requires server running on port 4100)
 */
const autocannon = require('autocannon');

const BASE_URL = 'http://localhost:4100';

async function runLoadTest() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║          Code Judge API — Load Test Suite            ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  const tests = [
    {
      name: '1. Health Endpoint (Lightweight)',
      url: `${BASE_URL}/api/v1/health`,
      connections: 100,
      duration: 5,
    },
    {
      name: '2. Problems List (Database Read)',
      url: `${BASE_URL}/api/v1/problems?page=1&limit=20`,
      connections: 50,
      duration: 5,
    },
    {
      name: '3. Leaderboard (Aggregation Query)',
      url: `${BASE_URL}/api/v1/leaderboard`,
      connections: 50,
      duration: 5,
    },
    {
      name: '4. Users List (Database Read)',
      url: `${BASE_URL}/api/v1/users`,
      connections: 50,
      duration: 5,
    },
    {
      name: '5. Interviews List (Database Read)',
      url: `${BASE_URL}/api/v1/interviews`,
      connections: 30,
      duration: 5,
    },
    {
      name: '6. User Submissions List (Nested Read)',
      url: `${BASE_URL}/api/v1/users/alice/submissions`,
      connections: 30,
      duration: 5,
    },
    {
      name: '7. Missing Route (404 Handling)',
      url: `${BASE_URL}/api/v1/this-route-does-not-exist`,
      connections: 20,
      duration: 5,
    }
  ];

  const results = [];

  for (const test of tests) {
    console.log(`\n--- ${test.name} ---`);
    console.log(`URL: ${test.url}`);
    console.log(`Connections: ${test.connections}, Duration: ${test.duration}s\n`);

    const result = await autocannon({
      url: test.url,
      connections: test.connections,
      duration: test.duration,
      pipelining: 1,
    });

    console.log(autocannon.printResult(result));

    results.push({
      name: test.name,
      requests: result.requests,
      latency: result.latency,
      throughput: result.throughput,
      errors: result.errors,
      timeouts: result.timeouts,
      non2xx: result['2xx'] < result.requests.total ? result.requests.total - result['2xx'] : 0,
    });
  }

  // Summary table
  console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                          LOAD TEST SUMMARY                                  ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
  console.log('║ Endpoint               │ Req/sec │ P50 (ms) │ P99 (ms) │ Errors │ Timeouts ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════╣');

  for (const r of results) {
    const name = r.name.substring(3).padEnd(23);
    const rps = String(Math.round(r.requests.average)).padStart(7);
    const p50 = String(r.latency.p50).padStart(8);
    const p99 = String(r.latency.p99).padStart(8);
    const errors = String(r.errors).padStart(6);
    const timeouts = String(r.timeouts).padStart(8);
    console.log(`║ ${name} │ ${rps} │ ${p50} │ ${p99} │ ${errors} │ ${timeouts} ║`);
  }

  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  // Performance assertions
  let warnings = 0;
  for (const r of results) {
    if (r.latency.p99 > 500) {
      console.log(`⚠️  WARNING: ${r.name} — P99 latency (${r.latency.p99}ms) exceeds 500ms threshold`);
      warnings++;
    }
    if (r.errors > 0) {
      console.log(`⚠️  WARNING: ${r.name} — ${r.errors} errors detected`);
      warnings++;
    }
  }

  if (warnings === 0) {
    console.log('✅ All endpoints meet performance thresholds (P99 < 500ms, 0 errors)');
  }

  console.log('\nLoad testing completed.');
}

runLoadTest().catch(console.error);
