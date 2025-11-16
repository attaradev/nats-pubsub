import express from 'express';
import NatsPubsub from 'nats-pubsub';
import { EmailService } from './services/email-service.js';
import { OrderConfirmedSubscriber } from './subscribers/order-confirmed-subscriber.js';
import { healthCheckRouter } from './routes/health.js';
import config from './config.js';

async function main() {
  console.log('Starting Email Service...');

  // Initialize Express
  const app = express();
  app.use(express.json());

  // Configure NatsPubsub
  NatsPubsub.configure({
    natsUrls: config.natsUrls,
    env: config.env,
    appName: config.appName,
    concurrency: 5,
    maxDeliver: 3,
    ackWait: 30000,
    useDlq: true,
  });

  // Setup topology
  await NatsPubsub.setup();
  console.log('NatsPubsub topology setup complete');

  // Initialize services
  const emailService = new EmailService();

  // Register subscribers
  const orderConfirmedSubscriber = new OrderConfirmedSubscriber(emailService);

  NatsPubsub.registerSubscriber(orderConfirmedSubscriber);

  // Start consuming messages
  await NatsPubsub.start();
  console.log('Email Service subscribers started');

  // Setup routes
  app.use('/health', healthCheckRouter);

  // Error handling middleware
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  });

  // Start HTTP server
  const port = config.port;
  app.listen(port, () => {
    console.log(`Email Service listening on port ${port}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down gracefully...');
    await NatsPubsub.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Failed to start Email Service:', error);
  process.exit(1);
});
