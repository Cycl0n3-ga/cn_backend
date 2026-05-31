/**
 * Stress Test — Code Judge API
 *
 * Pushes the API beyond normal load to identify breaking points.
 * Uses higher concurrency and longer durations than the load test.
 *
 * Usage: npm run test:stress (requires server running on port 4100)
 */
const autocannon = require('autocannon');

const BASE_URL = 'http://localhost:4100';
const API_BASE = `${BASE_URL}/api/v1`;
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

async function saveReport(reportData) {
  try {
    const response = await fetch(`${API_BASE}/stress-test-reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(INTERNAL_API_KEY ? { 'x-internal-api-key': INTERNAL_API_KEY } : {}),
      },
      body: JSON.stringify(reportData),
    });
    if (!response.ok) {
      console.warn(`⚠️ 無法保存報告: ${response.statusText}`);
    } else {
      console.log(`✅ 報告已保存到系統`);
    }
  } catch (err) {
    console.warn(`⚠️ 保存報告時出錯: ${err.message}`);
  }
}

async function runStressTest() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║        Code Judge API — Stress Test Suite            ║');
  console.log('║        (High concurrency / Extended duration)        ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  const scenarios = [
    {
      name: 'Spike Test — Health (200 connections)',
      url: `${BASE_URL}/api/v1/health`,
      connections: 200,
      duration: 10,
      description: 'Simulates sudden traffic spike to health endpoint',
    },
    {
      name: 'Sustained Load — Problems (100 connections, 15s)',
      url: `${BASE_URL}/api/v1/problems?page=1&limit=20`,
      connections: 100,
      duration: 15,
      description: 'Sustained database read load over 15 seconds',
    },
    {
      name: 'Sustained Load — Leaderboard (100 connections, 15s)',
      url: `${BASE_URL}/api/v1/leaderboard?page=1&limit=50`,
      connections: 100,
      duration: 15,
      description: 'Sustained aggregation query load',
    },
    {
      name: 'Max Connections — Health (500 connections, 5s)',
      url: `${BASE_URL}/api/v1/health`,
      connections: 500,
      duration: 5,
      description: 'Tests maximum concurrent connection handling',
    },
    {
      name: 'Auth Endpoint Stress (50 connections)',
      url: `${BASE_URL}/api/v1/auth/login`,
      connections: 50,
      duration: 10,
      method: 'POST',
      body: JSON.stringify({
        username: 'nonexistent',
        passwordSha256: 'a'.repeat(64),
      }),
      headers: { 'Content-Type': 'application/json' },
      description: 'Tests auth endpoint under heavy login attempts',
    },
  ];

  const results = [];

  for (const scenario of scenarios) {
    console.log(`\n━━━ ${scenario.name} ━━━`);
    console.log(`📝 ${scenario.description}`);
    console.log(`🔗 ${scenario.url}`);
    console.log(
      `👥 ${scenario.connections} connections × ${scenario.duration}s\n`,
    );

    const opts = {
      url: scenario.url,
      connections: scenario.connections,
      duration: scenario.duration,
      pipelining: 1,
    };

    if (scenario.method) {
      opts.method = scenario.method;
      opts.body = scenario.body;
      opts.headers = scenario.headers;
    }

    const result = await autocannon(opts);
    console.log(autocannon.printResult(result));

    const endpoint = new URL(scenario.url).pathname;
    const totalRequests = result.requests.total;
    const successfulReqs = result['2xx'] || 0;
    const failedReqs = totalRequests - successfulReqs;

    const reportData = {
      testName: scenario.name,
      endpoint,
      method: scenario.method || 'GET',
      connections: scenario.connections,
      duration: scenario.duration,
      totalRequests,
      successfulReqs,
      failedReqs,
      errors: result.errors || 0,
      timeouts: result.timeouts || 0,
      avgLatencyMs: result.latency?.mean || 0,
      p50LatencyMs: result.latency?.p50 || 0,
      p99LatencyMs: result.latency?.p99 || 0,
      maxLatencyMs: result.latency?.max || 0,
      avgThroughput: result.requests?.average || 0,
      statusCodes: JSON.stringify({
        '2xx': result['2xx'] || 0,
        '4xx': result['4xx'] || 0,
        '5xx': result['5xx'] || 0,
      }),
    };

    // Save report
    await saveReport(reportData);

    results.push({
      name: scenario.name,
      connections: scenario.connections,
      duration: scenario.duration,
      requests: result.requests,
      latency: result.latency,
      throughput: result.throughput,
      errors: result.errors,
      timeouts: result.timeouts,
      statusCodes: {
        '2xx': result['2xx'] || 0,
        '4xx': result['4xx'] || 0,
        '5xx': result['5xx'] || 0,
      },
    });
  }

  // Detailed Report
  console.log(
    '\n╔══════════════════════════════════════════════════════════════════════════════════════════╗',
  );
  console.log(
    '║                              STRESS TEST REPORT                                         ║',
  );
  console.log(
    '╠══════════════════════════════════════════════════════════════════════════════════════════╣',
  );

  for (const r of results) {
    console.log(`\n📊 ${r.name}`);
    console.log(`   Connections: ${r.connections} | Duration: ${r.duration}s`);
    console.log(`   Total Requests: ${r.requests.total}`);
    console.log(`   Avg Req/sec: ${Math.round(r.requests.average)}`);
    console.log(
      `   Latency — P50: ${r.latency.p50}ms | P95: ${r.latency.p97_5}ms | P99: ${r.latency.p99}ms | Max: ${r.latency.max}ms`,
    );
    console.log(`   Errors: ${r.errors} | Timeouts: ${r.timeouts}`);
    console.log(
      `   Status — 2xx: ${r.statusCodes['2xx']} | 4xx: ${r.statusCodes['4xx']} | 5xx: ${r.statusCodes['5xx']}`,
    );

    // Assessments
    if (r.latency.p99 > 1000) {
      console.log(`   ⚠️  P99 latency > 1000ms — potential bottleneck`);
    }
    if (r.errors > 0) {
      console.log(
        `   ⚠️  ${r.errors} connection errors — may indicate resource exhaustion`,
      );
    }
    if (r.timeouts > 0) {
      console.log(`   ⚠️  ${r.timeouts} timeouts — server may be overloaded`);
    }
    if (r.statusCodes['5xx'] > 0) {
      console.log(
        `   🔴 ${r.statusCodes['5xx']} server errors (5xx) — investigate immediately`,
      );
    }
    if (r.latency.p99 <= 1000 && r.errors === 0 && r.statusCodes['5xx'] === 0) {
      console.log(`   ✅ PASSED — Within acceptable thresholds`);
    }
  }

  console.log(
    '\n╚══════════════════════════════════════════════════════════════════════════════════════════╝\n',
  );
  console.log('✅ Stress testing completed.');
  console.log(
    `📊 查看 Dashboard: ${BASE_URL}/api/v1/stress-test-reports/dashboard`,
  );
}

runStressTest().catch(console.error);
