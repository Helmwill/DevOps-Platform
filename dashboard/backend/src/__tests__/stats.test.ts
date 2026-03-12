import request from 'supertest';
import Dockerode from 'dockerode';
import app from '../app';
import { setDockerClient, resetDockerClient } from '../dockerClient';

function makeRawStats(): Dockerode.ContainerStats {
  return {
    cpu_stats: {
      cpu_usage: { total_usage: 200_000_000, percpu_usage: [0, 0] },
      system_cpu_usage: 10_000_000_000,
      online_cpus: 2,
      throttling_data: { throttled_periods: 0, throttled_time: 0, periods: 0 },
    },
    precpu_stats: {
      cpu_usage: { total_usage: 0, percpu_usage: [0, 0] },
      system_cpu_usage: 0,
      online_cpus: 2,
      throttling_data: { throttled_periods: 0, throttled_time: 0, periods: 0 },
    },
    memory_stats: { usage: 128 * 1024 * 1024, limit: 512 * 1024 * 1024 },
  } as unknown as Dockerode.ContainerStats;
}

afterEach(() => resetDockerClient());

describe('GET /api/stats', () => {
  it('returns container and server stats', async () => {
    setDockerClient({
      listContainers: jest.fn().mockResolvedValue([{ Id: 'abc', Names: ['/web'] }]),
      getContainer: jest.fn().mockReturnValue({
        stats: jest.fn().mockResolvedValue(makeRawStats()),
      }),
    } as unknown as Dockerode);

    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);

    const { containers, server } = res.body;
    expect(containers).toHaveLength(1);
    expect(containers[0]).toMatchObject({
      id: 'abc',
      name: 'web',
      cpu_percent: expect.any(Number),
      mem_usage_mb: 128,
      mem_limit_mb: 512,
    });

    expect(server).toMatchObject({
      disk_used_gb: expect.any(Number),
      disk_total_gb: expect.any(Number),
      ram_used_mb: expect.any(Number),
      ram_total_mb: expect.any(Number),
      uptime_seconds: expect.any(Number),
      server_time: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });

  it('returns empty containers array when no containers are running', async () => {
    setDockerClient({
      listContainers: jest.fn().mockResolvedValue([]),
      getContainer: jest.fn(),
    } as unknown as Dockerode);

    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body.containers).toEqual([]);
  });

  it('returns 503 when Docker daemon is unavailable', async () => {
    setDockerClient({
      listContainers: jest.fn().mockRejectedValue(new Error('socket')),
    } as unknown as Dockerode);

    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'Docker daemon unavailable' });
  });
});
