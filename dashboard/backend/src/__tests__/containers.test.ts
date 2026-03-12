import request from 'supertest';
import Dockerode from 'dockerode';
import app from '../app';
import { setDockerClient, resetDockerClient } from '../dockerClient';

function makeContainer(overrides: Partial<Dockerode.ContainerInfo>): Dockerode.ContainerInfo {
  return {
    Id: 'abc123',
    Names: ['/my-container'],
    Image: 'nginx:latest',
    ImageID: 'sha256:abc',
    Command: 'nginx',
    Created: 1700000000,
    State: 'running',
    Status: 'Up 2 hours',
    Ports: [],
    Labels: {},
    HostConfig: { NetworkMode: 'default' },
    NetworkSettings: { Networks: {} },
    Mounts: [],
    ...overrides,
  };
}

function mockDocker(containers: Dockerode.ContainerInfo[]): Dockerode {
  return {
    listContainers: jest.fn().mockResolvedValue(containers),
  } as unknown as Dockerode;
}

afterEach(() => {
  resetDockerClient();
});

describe('GET /api/containers', () => {
  it('returns running container with status "running"', async () => {
    setDockerClient(mockDocker([makeContainer({ State: 'running', Status: 'Up 2 hours' })]));
    const res = await request(app).get('/api/containers');
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({
      id: 'abc123',
      name: 'my-container',
      image: 'nginx:latest',
      status: 'running',
      created: 1700000000,
    });
  });

  it('returns stopped container (exit 0) with status "stopped"', async () => {
    setDockerClient(
      mockDocker([makeContainer({ State: 'exited', Status: 'Exited (0) 1 hour ago' })]),
    );
    const res = await request(app).get('/api/containers');
    expect(res.status).toBe(200);
    expect(res.body[0].status).toBe('stopped');
  });

  it('returns running but unhealthy container with status "errored"', async () => {
    setDockerClient(
      mockDocker([makeContainer({ State: 'running', Status: 'Up 2 hours (unhealthy)' })]),
    );
    const res = await request(app).get('/api/containers');
    expect(res.status).toBe(200);
    expect(res.body[0].status).toBe('errored');
  });

  it('returns errored container (non-zero exit) with status "errored"', async () => {
    setDockerClient(
      mockDocker([makeContainer({ State: 'exited', Status: 'Exited (1) 1 hour ago' })]),
    );
    const res = await request(app).get('/api/containers');
    expect(res.status).toBe(200);
    expect(res.body[0].status).toBe('errored');
  });

  it('returns 503 when Docker daemon is unavailable', async () => {
    setDockerClient({
      listContainers: jest.fn().mockRejectedValue(new Error('connect ENOENT /var/run/docker.sock')),
    } as unknown as Dockerode);
    const res = await request(app).get('/api/containers');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'Docker daemon unavailable' });
  });

  it('returns empty array when no containers exist', async () => {
    setDockerClient(mockDocker([]));
    const res = await request(app).get('/api/containers');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
