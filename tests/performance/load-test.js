/**
 * k6 load test — Story 5.4 (T4 Performance Gate)
 *
 * Runs 20 virtual users for 30 seconds against the QA dashboard.
 * Hard block: p99 response latency must be < 500ms.
 *
 * Usage:
 *   K6_TARGET_URL=https://qa.example.com k6 run tests/performance/load-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 20,
  duration: '30s',
  thresholds: {
    // Hard block: p99 latency must be under 500ms across ALL requests
    http_req_duration: ['p(99)<500'],
  },
};

const BASE_URL = __ENV.K6_TARGET_URL || 'http://localhost:3000';

export default function () {
  // Health endpoint — lightest probe, always first
  const healthRes = http.get(`${BASE_URL}/health`, { tags: { name: 'health' } });
  check(healthRes, {
    'health: status 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  // Container list — primary dashboard data
  const containersRes = http.get(`${BASE_URL}/api/containers`, { tags: { name: 'containers' } });
  check(containersRes, {
    'containers: status 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  // Stats endpoint — server metrics
  const statsRes = http.get(`${BASE_URL}/api/stats`, { tags: { name: 'stats' } });
  check(statsRes, {
    'stats: status 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  // Brief pause between iterations to simulate realistic user behaviour
  sleep(0.5);
}
