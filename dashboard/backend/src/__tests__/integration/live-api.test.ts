/**
 * Integration tests — Story 6.2
 *
 * Runs against a live deployed dashboard instance.
 * Requires TEST_BASE_URL to be set in the environment.
 *
 * These tests are automatically skipped in local/unit-test runs where
 * TEST_BASE_URL is absent.  They run in the deploy-qa.yml workflow against
 * the live QA slot after it is deployed and healthy.
 *
 * Optional: set DASHBOARD_CREDENTIALS to "user:password" for basic auth.
 */

const BASE_URL = process.env.TEST_BASE_URL;

// Skip entire suite if not running against a live environment
const describeLive = BASE_URL ? describe : describe.skip;

describeLive('Live API Integration', () => {
  const credentials = process.env.DASHBOARD_CREDENTIALS;
  const authHeader: Record<string, string> = credentials
    ? { Authorization: `Basic ${Buffer.from(credentials).toString('base64')}` }
    : {};

  async function get(path: string): Promise<{ status: number; body: unknown }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...authHeader };
    const res = await fetch(`${BASE_URL}${path}`, { headers });
    const text = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { status: res.status, body };
  }

  it('GET /health returns 200 with status ok', async () => {
    const { status, body } = await get('/health');
    expect(status).toBe(200);
    expect(body).toMatchObject({ status: 'ok' });
  }, 20_000);

  it('GET /api/containers returns 200 with a JSON array', async () => {
    const { status, body } = await get('/api/containers');
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  }, 20_000);

  it('GET /api/stats returns 200 with server metrics', async () => {
    const { status, body } = await get('/api/stats');
    expect(status).toBe(200);
    expect(body).toMatchObject({
      server: expect.objectContaining({
        disk_used_gb: expect.any(Number),
        ram_used_mb: expect.any(Number),
        uptime_seconds: expect.any(Number),
      }),
    });
  }, 20_000);

  it('unauthenticated request returns 401 when auth is enforced', async () => {
    // Only runs this assertion when we have credentials (meaning auth is active)
    if (!credentials) {
      console.log('Skipping auth gate check — no DASHBOARD_CREDENTIALS provided');
      return;
    }
    const res = await fetch(`${BASE_URL}/api/containers`);
    expect(res.status).toBe(401);
  }, 20_000);
});
