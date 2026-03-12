import Dockerode from 'dockerode';
import { getDockerClient, setDockerClient, resetDockerClient } from '../dockerClient';

describe('dockerClient', () => {
  afterEach(() => {
    resetDockerClient();
  });

  it('returns a Dockerode instance', () => {
    const client = getDockerClient();
    expect(client).toBeInstanceOf(Dockerode);
  });

  it('returns the same instance on repeated calls (singleton)', () => {
    const a = getDockerClient();
    const b = getDockerClient();
    expect(a).toBe(b);
  });

  it('returns the injected mock client', () => {
    const mock = {} as Dockerode;
    setDockerClient(mock);
    expect(getDockerClient()).toBe(mock);
  });

  it('creates a fresh instance after reset', () => {
    const first = getDockerClient();
    resetDockerClient();
    const second = getDockerClient();
    expect(first).not.toBe(second);
  });
});
