/**
 * Complete Example - NatsPubsub v0.3 API
 *
 * Demonstrates all major features of the new API:
 * - Configuration with presets
 * - Schema validation with Zod
 * - Circuit breaker pattern
 * - Batch publishing
 * - Error handling with ErrorAction
 * - Testing with TestHarness
 */

import {
  NatsPubsub,
  Presets,
  subscriber,
  ErrorAction,
  CircuitBreaker,
  createValidator,
  CommonSchemas,
  z,
  TestHarness,
  type MessageContext,
  type ErrorContext,
} from 'nats-pubsub';

// ============================================================================
// 1. CONFIGURATION
// ============================================================================

// Use presets for quick setup
NatsPubsub.configure(
  Presets.production({
    appName: 'order-service',
    natsUrls: process.env.NATS_URLS!.split(','),
  })
);

// Or customize manually
NatsPubsub.configure({
  appName: 'order-service',
  natsUrls: 'nats://localhost:4222',
  env: 'production',
  concurrency: 20,
  maxDeliver: 5,
  ackWait: 30000,
  useDlq: true,
  useOutbox: false,
  useInbox: false,
});

// ============================================================================
// 2. SCHEMA VALIDATION
// ============================================================================

// Define schemas for your messages
const OrderSchema = z.object({
  orderId: CommonSchemas.uuid,
  customerId: CommonSchemas.uuid,
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().int().positive(),
      price: z.number().positive(),
    })
  ),
  totalAmount: z.number().positive(),
  status: z.enum(['pending', 'confirmed', 'cancelled']),
  createdAt: z.string().datetime(),
});

const NotificationSchema = z.object({
  userId: CommonSchemas.uuid,
  type: z.enum(['email', 'sms', 'push']),
  subject: z.string().min(1),
  body: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

// Create validators
const orderValidator = createValidator(OrderSchema);
const notificationValidator = createValidator(NotificationSchema);

// ============================================================================
// 3. CIRCUIT BREAKER
// ============================================================================

// Create circuit breaker for external API calls
const paymentApiCircuitBreaker = new CircuitBreaker({
  threshold: 5, // Open after 5 failures
  timeout: 30000, // Stay open for 30 seconds
  halfOpenMaxCalls: 3, // Test with 3 calls in half-open state
});

// ============================================================================
// 4. SUBSCRIBERS
// ============================================================================

// Order processing subscriber with schema validation
const OrderProcessor = subscriber('order.created', {
  schema: OrderSchema,
  retryStrategy: {
    maxAttempts: 5,
    backoff: 'exponential',
    initialDelay: 1000,
    maxDelay: 60000,
  },
  circuitBreaker: {
    enabled: true,
    threshold: 5,
    timeout: 60000,
  },
  handler: async (message, context: MessageContext) => {
    console.log(`Processing order ${message.orderId}`);
    console.log(`Event ID: ${context.eventId}`);
    console.log(`Trace ID: ${context.traceId}`);
    console.log(`Delivery attempt: ${context.deliveries}`);

    // Process the order
    await processOrderInDatabase(message);

    // Publish follow-up events
    await NatsPubsub.publish({
      topic: 'order.confirmed',
      message: {
        orderId: message.orderId,
        confirmedAt: new Date().toISOString(),
      },
      metadata: {
        traceId: context.traceId,
        correlationId: context.correlationId,
      },
    });

    // Send notification
    await NatsPubsub.publish({
      topic: 'notification.send',
      message: {
        userId: message.customerId,
        type: 'email',
        subject: 'Order Confirmed',
        body: `Your order ${message.orderId} has been confirmed.`,
      },
      metadata: {
        traceId: context.traceId,
      },
    });
  },
  onError: async (errorContext: ErrorContext) => {
    const { error, message, context, attemptNumber, maxAttempts } = errorContext;

    console.error(`Error processing order ${message.orderId}:`, error);
    console.error(`Attempt ${attemptNumber}/${maxAttempts}`);

    // Decide action based on error type
    if (error.name === 'ValidationError') {
      // Validation errors should not retry
      console.error('Invalid order data, sending to DLQ');
      return ErrorAction.DLQ;
    }

    if (error.name === 'NetworkError' || error.message.includes('timeout')) {
      // Network errors should retry
      if (attemptNumber < maxAttempts) {
        console.log('Network error, will retry');
        return ErrorAction.RETRY;
      } else {
        console.error('Max retries exhausted, sending to DLQ');
        return ErrorAction.DLQ;
      }
    }

    // Default: retry unless exhausted
    if (attemptNumber < maxAttempts) {
      return ErrorAction.RETRY;
    }

    return ErrorAction.DLQ;
  },
});

// Payment processing subscriber with circuit breaker
const PaymentProcessor = subscriber('payment.process', {
  handler: async (message, context: MessageContext) => {
    // Use circuit breaker for external API call
    try {
      const result = await paymentApiCircuitBreaker.execute(async () => {
        return await callPaymentAPI(message);
      });

      await NatsPubsub.publish({
        topic: 'payment.completed',
        message: {
          paymentId: message.paymentId,
          result,
        },
        metadata: {
          traceId: context.traceId,
        },
      });
    } catch (error: any) {
      if (error.name === 'CircuitBreakerError') {
        console.error('Payment API circuit breaker is OPEN');
        // Handle circuit breaker open state
        throw new Error('Payment service temporarily unavailable');
      }
      throw error;
    }
  },
  onError: async (errorContext: ErrorContext) => {
    if (errorContext.error.message.includes('temporarily unavailable')) {
      // Don't retry immediately when circuit is open
      return ErrorAction.DLQ;
    }
    return ErrorAction.RETRY;
  },
});

// Notification sender with validation
const NotificationSender = subscriber('notification.send', {
  schema: NotificationSchema,
  handler: async (message, context: MessageContext) => {
    console.log(`Sending ${message.type} notification to user ${message.userId}`);

    switch (message.type) {
      case 'email':
        await sendEmail(message.userId, message.subject, message.body);
        break;
      case 'sms':
        await sendSMS(message.userId, message.body);
        break;
      case 'push':
        await sendPushNotification(message.userId, message.subject, message.body);
        break;
    }
  },
  onError: async (errorContext: ErrorContext) => {
    // Non-critical notifications can be discarded on repeated failures
    if (errorContext.attemptNumber >= 3) {
      console.warn('Notification failed after 3 attempts, discarding');
      return ErrorAction.DISCARD;
    }
    return ErrorAction.RETRY;
  },
});

// ============================================================================
// 5. PUBLISHING
// ============================================================================

// Simple publish
async function publishOrderCreated(order: z.infer<typeof OrderSchema>) {
  // Validate before publishing
  const validation = orderValidator.validate(order);
  if (!validation.success) {
    throw new Error(`Invalid order: ${JSON.stringify(validation.errors)}`);
  }

  await NatsPubsub.publish({
    topic: 'order.created',
    message: order,
    metadata: {
      traceId: generateTraceId(),
      correlationId: generateCorrelationId(),
    },
  });
}

// Batch publishing
async function publishMultipleEvents() {
  const result = await NatsPubsub.batch()
    .add('order.created', {
      orderId: '123',
      customerId: '456',
      items: [{ productId: 'P1', quantity: 2, price: 29.99 }],
      totalAmount: 59.98,
      status: 'pending',
      createdAt: new Date().toISOString(),
    })
    .add('notification.send', {
      userId: '456',
      type: 'email',
      subject: 'Order Received',
      body: 'We received your order.',
    })
    .add('analytics.event.tracked', {
      event: 'order_created',
      userId: '456',
      properties: { orderId: '123', totalAmount: 59.98 },
    })
    .withOptions({
      traceId: generateTraceId(),
    })
    .publish();

  console.log(`Batch publish: ${result.successCount} succeeded, ${result.failureCount} failed`);

  if (result.failures.length > 0) {
    console.error('Failed publishes:', result.failures);
  }
}

// ============================================================================
// 6. APPLICATION LIFECYCLE
// ============================================================================

async function startApplication() {
  try {
    // Setup topology (creates streams, consumers)
    await NatsPubsub.setup();

    // Register subscribers
    NatsPubsub.subscribeTo(OrderProcessor);
    NatsPubsub.subscribeTo(PaymentProcessor);
    NatsPubsub.subscribeTo(NotificationSender);

    // Start consuming messages
    await NatsPubsub.start();

    console.log('Application started successfully');
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

async function stopApplication() {
  try {
    // Stop consuming messages
    await NatsPubsub.stop();

    // Disconnect from NATS
    await NatsPubsub.disconnect();

    console.log('Application stopped gracefully');
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
}

// ============================================================================
// 7. TESTING
// ============================================================================

async function testOrderProcessing() {
  const harness = new TestHarness({
    subscribers: [OrderProcessor, NotificationSender],
    inlineMode: true,
  });

  try {
    await harness.setup();

    // Publish a test order
    await harness.publish('order.created', {
      orderId: 'test-123',
      customerId: 'cust-456',
      items: [{ productId: 'P1', quantity: 1, price: 19.99 }],
      totalAmount: 19.99,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    // Wait for subscriber to process
    await harness.waitForSubscriber(OrderProcessor, { timeoutMs: 5000 });

    // Assert subscriber was called
    console.assert(harness.subscriberCalled(OrderProcessor));
    console.assert(harness.subscriberCallCount(OrderProcessor) === 1);

    // Check follow-up notifications were published
    await harness.waitForMessages('notification.send', { count: 1 });
    const notifications = harness.received('notification.send');
    console.assert(notifications.length === 1);

    // Simulate error scenario
    harness.simulateError(OrderProcessor, new Error('Database connection failed'));

    await harness.publish('order.created', {
      orderId: 'test-456',
      customerId: 'cust-789',
      items: [{ productId: 'P2', quantity: 1, price: 29.99 }],
      totalAmount: 29.99,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    // Check DLQ message
    await harness.waitFor(() => harness.dlqMessages().length > 0, { timeoutMs: 5000 });
    const dlqMessages = harness.dlqMessages();
    console.assert(dlqMessages.length === 1);
    console.log('DLQ message:', dlqMessages[0]);

    console.log('All tests passed!');
  } finally {
    await harness.cleanup();
  }
}

// ============================================================================
// 8. HEALTH CHECKS
// ============================================================================

async function checkHealth() {
  // Full health check
  const health = await NatsPubsub.healthCheck();
  console.log('Health status:', health.status);
  console.log('Components:', health.components);

  if (health.status !== 'healthy') {
    console.error('System is unhealthy!');
  }

  // Quick health check (faster, less detailed)
  const quickHealth = await NatsPubsub.quickHealthCheck();
  console.log('Quick health:', quickHealth.status);
}

// Express middleware for health endpoint
import express from 'express';
const app = express();

app.get('/health', NatsPubsub.healthCheckMiddleware());
app.get('/health/quick', NatsPubsub.quickHealthCheckMiddleware());

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateTraceId(): string {
  return `trace-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

function generateCorrelationId(): string {
  return `corr-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

async function processOrderInDatabase(order: any): Promise<void> {
  // Simulate database operation
  await new Promise((resolve) => setTimeout(resolve, 100));
}

async function callPaymentAPI(message: any): Promise<any> {
  // Simulate external API call
  await new Promise((resolve) => setTimeout(resolve, 200));
  return { success: true, transactionId: 'txn-123' };
}

async function sendEmail(userId: string, subject: string, body: string): Promise<void> {
  console.log(`Email sent to user ${userId}`);
}

async function sendSMS(userId: string, body: string): Promise<void> {
  console.log(`SMS sent to user ${userId}`);
}

async function sendPushNotification(userId: string, subject: string, body: string): Promise<void> {
  console.log(`Push notification sent to user ${userId}`);
}

// ============================================================================
// MAIN
// ============================================================================

if (require.main === module) {
  startApplication()
    .then(() => {
      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log('Received SIGINT, shutting down...');
        await stopApplication();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        console.log('Received SIGTERM, shutting down...');
        await stopApplication();
        process.exit(0);
      });
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export {
  startApplication,
  stopApplication,
  publishOrderCreated,
  publishMultipleEvents,
  testOrderProcessing,
  checkHealth,
};
