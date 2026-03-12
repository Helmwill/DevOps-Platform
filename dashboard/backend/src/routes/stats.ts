import { Router, Request, Response } from 'express';
import { getDockerClient } from '../dockerClient';
import { getStats } from '../services/statsService';

const router = Router();

router.get('/api/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await getStats(getDockerClient());
    res.status(200).json(stats);
  } catch {
    res.status(503).json({ error: 'Docker daemon unavailable' });
  }
});

export default router;
