import express from 'express';
import healthRouter from './routes/health';
import containersRouter from './routes/containers';

const app = express();

app.use(express.json());
app.use(healthRouter);
app.use(containersRouter);

export default app;
