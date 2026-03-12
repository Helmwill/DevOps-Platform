import request from 'supertest';
import Dockerode from 'dockerode';
import app from '../app';
import { setDockerClient, resetDockerClient } from '../dockerClient';

function mockContainer(overrides: Partial<{ running: boolean; start: jest.Mock; stop: jest.Mock; restart: jest.Mock; inspect: jest.Mock }> = {}) {
  return {
    inspect: overrides.inspect ?? jest.fn().mockResolvedValue({ State: { Running: overrides.running ?? false } }),
    start: overrides.start ?? jest.fn().mockResolvedValue({}),
    stop: overrides.stop ?? jest.fn().mockResolvedValue({}),
    restart: overrides.restart ?? jest.fn().mockResolvedValue({}),
  };
}

function mockDockerWith(containerId: string | null, container = mockContainer()) {
  const listed = containerId ? [{ Id: containerId }] : [];
  return {
    listContainers: jest.fn().mockResolvedValue(listed),
    getContainer: jest.fn().mockReturnValue(container),
  } as unknown as Dockerode;
}

afterEach(() => resetDockerClient());

describe('POST /api/containers/:id/start', () => {
  it('starts a stopped container', async () => {
    setDockerClient(mockDockerWith('abc', mockContainer({ running: false })));
    const res = await request(app).post('/api/containers/abc/start');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'started' });
  });

  it('returns 409 if container is already running', async () => {
    setDockerClient(mockDockerWith('abc', mockContainer({ running: true })));
    const res = await request(app).post('/api/containers/abc/start');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Container is already running' });
  });

  it('returns 404 for unknown container id', async () => {
    setDockerClient(mockDockerWith(null));
    const res = await request(app).post('/api/containers/unknown/start');
    expect(res.status).toBe(404);
  });

  it('returns 503 when Docker daemon is unavailable', async () => {
    setDockerClient({ listContainers: jest.fn().mockRejectedValue(new Error('socket')) } as unknown as Dockerode);
    const res = await request(app).post('/api/containers/abc/start');
    expect(res.status).toBe(503);
  });
});

describe('POST /api/containers/:id/stop', () => {
  it('stops a container', async () => {
    setDockerClient(mockDockerWith('abc'));
    const res = await request(app).post('/api/containers/abc/stop');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'stopped' });
  });

  it('returns 404 for unknown container id', async () => {
    setDockerClient(mockDockerWith(null));
    const res = await request(app).post('/api/containers/unknown/stop');
    expect(res.status).toBe(404);
  });

  it('returns 503 when Docker daemon is unavailable', async () => {
    setDockerClient({ listContainers: jest.fn().mockRejectedValue(new Error('socket')) } as unknown as Dockerode);
    const res = await request(app).post('/api/containers/abc/stop');
    expect(res.status).toBe(503);
  });
});

describe('POST /api/containers/:id/restart', () => {
  it('restarts a container', async () => {
    setDockerClient(mockDockerWith('abc'));
    const res = await request(app).post('/api/containers/abc/restart');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'restarted' });
  });

  it('returns 404 for unknown container id', async () => {
    setDockerClient(mockDockerWith(null));
    const res = await request(app).post('/api/containers/unknown/restart');
    expect(res.status).toBe(404);
  });

  it('returns 503 when Docker daemon is unavailable', async () => {
    setDockerClient({ listContainers: jest.fn().mockRejectedValue(new Error('socket')) } as unknown as Dockerode);
    const res = await request(app).post('/api/containers/abc/restart');
    expect(res.status).toBe(503);
  });
});
