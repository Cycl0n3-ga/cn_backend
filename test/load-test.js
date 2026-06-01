/**
 * Load Test — Code Judge API
 *
 * Uses autocannon to simulate concurrent users hitting the API.
 * Covers: health, problems, leaderboard, users, auth/login endpoints.
 *
 * Usage: npm run test:load (requires server running on port 4100)
 */
const autocannon = require('autocannon');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:4100';
const API_BASE = `${BASE_URL}/api/v1`;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function login(username, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      passwordSha256: sha256(password),
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to login as ${username}: HTTP ${response.status}`);
  }

  const body = await response.json();
  return body.token;
}

async function runLoadTest() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║          Code Judge API — Load Test Suite            ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  const adminToken = await login('admin', 'admin123');
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  const tests = [
    {
      name: '1. Health Liveness (Lightweight)',
      url: `${API_BASE}/health/live`,
      connections: 100,
      duration: 5,
    },
    {
      name: '2. Problems List (Database Read)',
      url: `${API_BASE}/problems?page=1&limit=20`,
      connections: 50,
      duration: 5,
    },
    {
      name: '3. Leaderboard (Aggregation Query)',
      url: `${API_BASE}/leaderboard`,
      connections: 50,
      duration: 5,
    },
    {
      name: '4. Users List (Authorized Database Read)',
      url: `${API_BASE}/users`,
      headers: adminHeaders,
      connections: 50,
      duration: 5,
    },
    {
      name: '5. Interviews List (Authorized Database Read)',
      url: `${API_BASE}/interviews`,
      headers: adminHeaders,
      connections: 30,
      duration: 5,
    },
    {
      name: '6. User Submissions List (Authorized Nested Read)',
      url: `${API_BASE}/users/alice/submissions`,
      headers: adminHeaders,
      connections: 30,
      duration: 5,
    },
    {
      name: '7. Missing Route (404 Handling)',
      url: `${API_BASE}/this-route-does-not-exist`,
      connections: 20,
      duration: 5,
      expected4xx: true,
    },
  ];

  const results = [];

  for (const test of tests) {
    console.log(`\n--- ${test.name} ---`);
    console.log(`URL: ${test.url}`);
    console.log(
      `Connections: ${test.connections}, Duration: ${test.duration}s\n`,
    );

    const result = await autocannon({
      url: test.url,
      connections: test.connections,
      duration: test.duration,
      pipelining: 1,
      headers: test.headers,
    });

    console.log(autocannon.printResult(result));

    const successful = test.expected4xx
      ? result['4xx'] || 0
      : result['2xx'] || 0;

    results.push({
      name: test.name,
      requests: result.requests,
      latency: result.latency,
      throughput: result.throughput,
      errors: result.errors,
      timeouts: result.timeouts,
      nonExpected: Math.max(0, result.requests.total - successful),
    });
  }

  // Summary table
  console.log(
    '\n╔══════════════════════════════════════════════════════════════════════════════╗',
  );
  console.log(
    '║                          LOAD TEST SUMMARY                                  ║',
  );
  console.log(
    '╠══════════════════════════════════════════════════════════════════════════════╣',
  );
  console.log(
    '║ Endpoint               │ Req/sec │ P50 (ms) │ P99 (ms) │ Errors │ Timeouts ║',
  );
  console.log(
    '╠══════════════════════════════════════════════════════════════════════════════╣',
  );

  for (const r of results) {
    const name = r.name.substring(3).padEnd(23);
    const rps = String(Math.round(r.requests.average)).padStart(7);
    const p50 = String(r.latency.p50).padStart(8);
    const p99 = String(r.latency.p99).padStart(8);
    const errors = String(r.errors).padStart(6);
    const timeouts = String(r.timeouts).padStart(8);
    console.log(
      `║ ${name} │ ${rps} │ ${p50} │ ${p99} │ ${errors} │ ${timeouts} ║`,
    );
  }

  console.log(
    '╚══════════════════════════════════════════════════════════════════════════════╝\n',
  );

  // Performance assertions
  let warnings = 0;
  for (const r of results) {
    if (r.latency.p99 > 500) {
      console.log(
        `⚠️  WARNING: ${r.name} — P99 latency (${r.latency.p99}ms) exceeds 500ms threshold`,
      );
      warnings++;
    }
    if (r.errors > 0) {
      console.log(`⚠️  WARNING: ${r.name} — ${r.errors} errors detected`);
      warnings++;
    }
    if (r.nonExpected > 0) {
      console.log(
        `⚠️  WARNING: ${r.name} — ${r.nonExpected} unexpected status responses detected`,
      );
      warnings++;
    }
  }

  if (warnings === 0) {
    console.log(
      '✅ All endpoints meet performance thresholds (P99 < 500ms, 0 errors, expected status codes)',
    );
  }

  console.log('\nLoad testing completed.');
}

runLoadTest().catch(console.error);
