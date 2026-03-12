import express from 'express';
import healthRouter from './routes/health';
import containersRouter from './routes/containers';
import containerControlsRouter from './routes/containerControls';
import statsRouter from './routes/stats';

const app = express();

app.use(express.json());
app.use(healthRouter);
app.use(containersRouter);
app.use(containerControlsRouter);
app.use(statsRouter);

export default app;
