import Dockerode from 'dockerode';
import { ContainerInfo, ContainerStatus } from '../types/container';

function resolveStatus(container: Dockerode.ContainerInfo): ContainerStatus {
  // Unhealthy running containers surface as errored (Docker HEALTHCHECK integration)
  if (container.State === 'running' && container.Status.includes('(unhealthy)')) {
    return 'errored';
  }
  if (container.State === 'running') return 'running';
  // Exited with non-zero exit code = errored
  if (container.State === 'exited' && container.Status.includes('Exited (0)') === false) {
    return 'errored';
  }
  return 'stopped';
}

export async function listContainers(docker: Dockerode): Promise<ContainerInfo[]> {
  const raw = await docker.listContainers({ all: true });
  return raw.map((c) => ({
    id: c.Id,
    name: c.Names[0]?.replace(/^\//, '') ?? c.Id,
    image: c.Image,
    status: resolveStatus(c),
    created: c.Created,
  }));
}
