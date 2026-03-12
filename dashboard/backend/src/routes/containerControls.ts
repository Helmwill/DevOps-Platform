import { Router, Request, Response } from 'express';
import { getDockerClient } from '../dockerClient';

const router = Router();

async function getContainer(id: string) {
  const docker = getDockerClient();
  const containers = await docker.listContainers({ all: true });
  const found = containers.find((c) => c.Id === id);
  if (!found) return null;
  return docker.getContainer(id);
}

router.post('/api/containers/:id/start', async (req: Request, res: Response) => {
  try {
    const container = await getContainer(req.params.id);
    if (!container) return res.status(404).json({ error: 'Container not found' });

    const info = await container.inspect();
    if (info.State.Running) {
      return res.status(409).json({ error: 'Container is already running' });
    }

    await container.start();
    return res.status(200).json({ status: 'started' });
  } catch {
    return res.status(503).json({ error: 'Docker daemon unavailable' });
  }
});

router.post('/api/containers/:id/stop', async (req: Request, res: Response) => {
  try {
    const container = await getContainer(req.params.id);
    if (!container) return res.status(404).json({ error: 'Container not found' });

    await container.stop();
    return res.status(200).json({ status: 'stopped' });
  } catch {
    return res.status(503).json({ error: 'Docker daemon unavailable' });
  }
});

router.post('/api/containers/:id/restart', async (req: Request, res: Response) => {
  try {
    const container = await getContainer(req.params.id);
    if (!container) return res.status(404).json({ error: 'Container not found' });

    await container.restart();
    return res.status(200).json({ status: 'restarted' });
  } catch {
    return res.status(503).json({ error: 'Docker daemon unavailable' });
  }
});

export default router;
