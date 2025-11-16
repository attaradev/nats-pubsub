import NatsPubsub, {
  BaseSubscriber,
  EventMetadata,
  loggingMiddleware,
  retryLoggerMiddleware,
} from '../src';

/**
 * Basic usage example for NatsPubsub
 */

// 1. Configure NatsPubsub
NatsPubsub.configure({
  natsUrls: process.env.NATS_URLS || 'nats://localhost:4222',
  env: process.env.NODE_ENV || 'development',
  appName: 'example-app',
  concurrency: 5,
  maxDeliver: 3,
  ackWait: 30000, // 30 seconds
  backoff: [1000, 5000, 15000], // 1s, 5s, 15s
  useDlq: true,
});

// 2. Define a subscriber
class UserEventSubscriber extends BaseSubscriber {
  constructor() {
    super('development.events.users.user.*', {
      retry: 3,
      ackWait: 60000,
    });
  }

  async call(event: Record<string, unknown>, metadata: EventMetadata): Promise<void> {
    console.log(`[UserSubscriber] Received event: ${metadata.action}`);
    console.log(`Event ID: ${metadata.event_id}`);
    console.log(`User: ${event.name} (${event.email})`);

    // Simulate processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    console.log(`[UserSubscriber] Processed event: ${metadata.event_id}`);
  }
}

// 3. Define another subscriber for multiple subjects
class NotificationSubscriber extends BaseSubscriber {
  constructor() {
    super([
      'development.events.users.user.created',
      'development.events.orders.order.placed',
    ]);
  }

  async call(event: Record<string, unknown>, metadata: EventMetadata): Promise<void> {
    console.log(`[NotificationSubscriber] Sending notification for: ${metadata.subject}`);

    if (metadata.subject.includes('users.user.created')) {
      await this.sendWelcomeEmail(event);
    } else if (metadata.subject.includes('orders.order.placed')) {
      await this.sendOrderConfirmation(event);
    }
  }

  private async sendWelcomeEmail(event: Record<string, unknown>): Promise<void> {
    console.log(`Sending welcome email to: ${event.email}`);
  }

  private async sendOrderConfirmation(event: Record<string, unknown>): Promise<void> {
    console.log(`Sending order confirmation for order: ${event.id}`);
  }
}

// Main function
async function main() {
  try {
    console.log('Starting NatsPubsub example...');

    // Add middleware
    NatsPubsub.use(loggingMiddleware);
    NatsPubsub.use(retryLoggerMiddleware);

    // Register subscribers
    const userSubscriber = new UserEventSubscriber();
    const notificationSubscriber = new NotificationSubscriber();

    NatsPubsub.registerSubscriber(userSubscriber);
    NatsPubsub.registerSubscriber(notificationSubscriber);

    // Start the consumer
    await NatsPubsub.start();

    console.log('Consumer started successfully');

    // Publish some test events
    console.log('\nPublishing test events...\n');

    await NatsPubsub.publish('users', 'user', 'created', {
      id: '123',
      name: 'Alice Smith',
      email: 'alice@example.com',
    });

    await NatsPubsub.publish('users', 'user', 'updated', {
      id: '123',
      name: 'Alice Johnson',
      email: 'alice@example.com',
    });

    await NatsPubsub.publish('orders', 'order', 'placed', {
      id: 'order-456',
      user_id: '123',
      total: 99.99,
    });

    console.log('\nTest events published');

    // Keep the process running
    console.log('\nPress Ctrl+C to stop...');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down gracefully...');
      await NatsPubsub.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\nShutting down gracefully...');
      await NatsPubsub.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  main();
}

export { main };
