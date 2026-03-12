import { Router, Request, Response } from 'express';
import { getDockerClient } from '../dockerClient';
import { listContainers } from '../services/containerService';

const router = Router();

router.get('/api/containers', async (_req: Request, res: Response) => {
  try {
    const containers = await listContainers(getDockerClient());
    res.status(200).json(containers);
  } catch {
    res.status(503).json({ error: 'Docker daemon unavailable' });
  }
});

export default router;
