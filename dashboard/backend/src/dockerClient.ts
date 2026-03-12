import Dockerode from 'dockerode';

let client: Dockerode | null = null;

export function getDockerClient(): Dockerode {
  if (!client) {
    client = new Dockerode({ socketPath: '/var/run/docker.sock' });
  }
  return client;
}

// Allow injecting a mock client in tests
export function setDockerClient(mock: Dockerode): void {
  client = mock;
}

export function resetDockerClient(): void {
  client = null;
}
