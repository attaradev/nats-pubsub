import { Router } from 'express';
import NatsPubsub from 'nats-pubsub';

export const healthCheckRouter = Router();

healthCheckRouter.get('/', async (req, res) => {
  try {
    const health = await NatsPubsub.healthCheck();
    res.status(health.healthy ? 200 : 503).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

healthCheckRouter.get('/ready', async (req, res) => {
  try {
    const health = await NatsPubsub.quickHealthCheck();
    res.status(health.healthy ? 200 : 503).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
