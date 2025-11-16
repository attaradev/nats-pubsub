import NatsPubsub, { Middleware, EventMetadata } from '../src';

/**
 * Example of creating and using custom middleware
 */

// 1. Create a timing middleware
class TimingMiddleware implements Middleware {
  async call(
    event: Record<string, unknown>,
    metadata: EventMetadata,
    next: () => Promise<void>
  ): Promise<void> {
    const startTime = Date.now();
    console.log(`[Timing] Started processing event: ${metadata.event_id}`);

    try {
      await next();
      const duration = Date.now() - startTime;
      console.log(`[Timing] Completed in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`[Timing] Failed after ${duration}ms`);
      throw error;
    }
  }
}

// 2. Create a tracing middleware
class TracingMiddleware implements Middleware {
  async call(
    event: Record<string, unknown>,
    metadata: EventMetadata,
    next: () => Promise<void>
  ): Promise<void> {
    const traceId = metadata.trace_id || 'no-trace-id';
    console.log(`[Tracing] Trace ID: ${traceId}`);

    // Add trace context to the event (for demonstration)
    const eventWithTrace = {
      ...event,
      _trace_id: traceId,
    };

    await next();
  }
}

// 3. Create an error handling middleware
class ErrorHandlingMiddleware implements Middleware {
  async call(
    event: Record<string, unknown>,
    metadata: EventMetadata,
    next: () => Promise<void>
  ): Promise<void> {
    try {
      await next();
    } catch (error: any) {
      console.error(`[ErrorHandler] Error processing event ${metadata.event_id}:`, {
        error: error.message,
        subject: metadata.subject,
        deliveries: metadata.deliveries,
      });

      // You could add custom error handling logic here
      // For example: send to error tracking service, log to database, etc.

      throw error; // Re-throw to let the consumer handle it
    }
  }
}

// 4. Configure and use the middleware
async function main() {
  NatsPubsub.configure({
    natsUrls: 'nats://localhost:4222',
    env: 'development',
    appName: 'middleware-example',
  });

  // Add middleware in order
  // They will be executed in the order they are added
  NatsPubsub.use(new TracingMiddleware());
  NatsPubsub.use(new TimingMiddleware());
  NatsPubsub.use(new ErrorHandlingMiddleware());

  // Define and register a subscriber
  class ExampleSubscriber {
    subjects = ['development.events.users.user.*'];

    async call(event: Record<string, unknown>, metadata: EventMetadata): Promise<void> {
      console.log(`[Subscriber] Processing event: ${metadata.action}`);
      console.log(`[Subscriber] Event data:`, event);

      // Simulate some processing time
      await new Promise((resolve) => setTimeout(resolve, 100));

      console.log(`[Subscriber] Done processing`);
    }
  }

  NatsPubsub.registerSubscriber(new ExampleSubscriber() as any);

  // Start consuming
  await NatsPubsub.start();

  // Publish a test event
  await NatsPubsub.publish(
    'users',
    'user',
    'created',
    { id: '789', name: 'Bob' },
    { trace_id: 'trace-abc-123' }
  );

  // Graceful shutdown
  setTimeout(async () => {
    await NatsPubsub.stop();
    process.exit(0);
  }, 5000);
}

if (require.main === module) {
  main();
}

export { TimingMiddleware, TracingMiddleware, ErrorHandlingMiddleware };
