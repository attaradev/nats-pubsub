import express from 'express';
import NatsPubsub from 'nats-pubsub';
import { OrderRepository } from './repositories/order-repository.js';
import { OrderService } from './services/order-service.js';
import { InventoryReservedSubscriber } from './subscribers/inventory-reserved-subscriber.js';
import { PaymentProcessedSubscriber } from './subscribers/payment-processed-subscriber.js';
import { healthCheckRouter } from './routes/health.js';
import { ordersRouter } from './routes/orders.js';
import config from './config.js';

async function main() {
  console.log('Starting Order Service...');

  // Initialize Express
  const app = express();
  app.use(express.json());

  // Configure NatsPubsub
  NatsPubsub.configure({
    natsUrls: config.natsUrls,
    env: config.env,
    appName: config.appName,
    concurrency: 10,
    maxDeliver: 5,
    ackWait: 30000,
    useDlq: true,
    useOutbox: true,
  });

  // Setup topology
  await NatsPubsub.setup();
  console.log('NatsPubsub topology setup complete');

  // Initialize repositories
  const orderRepository = new OrderRepository();
  await orderRepository.initialize();

  // Initialize services
  const orderService = new OrderService(orderRepository);

  // Register subscribers
  const inventorySubscriber = new InventoryReservedSubscriber(orderService);
  const paymentSubscriber = new PaymentProcessedSubscriber(orderService);

  NatsPubsub.registerSubscriber(inventorySubscriber);
  NatsPubsub.registerSubscriber(paymentSubscriber);

  // Start consuming messages
  await NatsPubsub.start();
  console.log('Order Service subscribers started');

  // Setup routes
  app.use('/health', healthCheckRouter);
  app.use('/orders', ordersRouter(orderService));

  // Error handling middleware
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  });

  // Start HTTP server
  const port = config.port;
  app.listen(port, () => {
    console.log(`Order Service listening on port ${port}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down gracefully...');
    await NatsPubsub.stop();
    await orderRepository.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Failed to start Order Service:', error);
  process.exit(1);
});
