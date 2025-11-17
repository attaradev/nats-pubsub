# Migration Guide: v0.2 → v0.3

This guide shows how to migrate from the old API to the new v0.3 API with concrete examples.

## Table of Contents

1. [Configuration Changes](#configuration-changes)
2. [Publishing Changes](#publishing-changes)
3. [Subscriber Changes](#subscriber-changes)
4. [Error Handling Changes](#error-handling-changes)
5. [Testing Changes](#testing-changes)

## Configuration Changes

### Before (v0.2)

```typescript
import { NatsPubsub } from 'nats-pubsub';

NatsPubsub.configure({
  appName: 'my-service',
  natsUrls: 'nats://localhost:4222',
  env: 'production',
  concurrency: 20,
  maxDeliver: 5,
  ackWait: 30000,
  useDlq: true,
});

await NatsPubsub.ensureTopology();
```

### After (v0.3)

```typescript
import { NatsPubsub, Presets } from 'nats-pubsub';

// Option 1: Use presets
NatsPubsub.configure(
  Presets.production({
    appName: 'my-service',
    natsUrls: 'nats://localhost:4222',
  })
);

// Option 2: Manual configuration (same as before)
NatsPubsub.configure({
  appName: 'my-service',
  natsUrls: 'nats://localhost:4222',
  env: 'production',
  concurrency: 20,
  maxDeliver: 5,
  ackWait: 30000,
  useDlq: true,
});

// Simplified setup
await NatsPubsub.setup();
```

**Changes:**

- ✅ Added `Presets` for common configurations
- ✅ `setup()` combines `configure()` + `ensureTopology()`

---

## Publishing Changes

### Before (v0.2) - Domain/Resource/Action Pattern

```typescript
// Old pattern: domain.resource.action
await NatsPubsub.publishToTopic('orders', 'order', 'created', {
  orderId: '123',
  customerId: '456',
  amount: 99.99,
});

// Subject generated: production.my-service.events.orders.order.created
```

### After (v0.3) - Topic-Based Pattern

```typescript
// New pattern: simple topics
await NatsPubsub.publish({
  topic: 'orders.created',
  message: {
    orderId: '123',
    customerId: '456',
    amount: 99.99,
  },
  metadata: {
    traceId: 'trace-123',
    correlationId: 'corr-456',
  },
});

// Subject generated: production.my-service.orders.created
```

**Changes:**

- ❌ Removed `publishToTopic(domain, resource, action, message)`
- ✅ New `publish({ topic, message, metadata })`
- ✅ Simplified subject structure
- ✅ Explicit metadata parameter

---

### Batch Publishing

### Before (v0.2)

```typescript
import { BatchPublisher } from 'nats-pubsub';

const batch = new BatchPublisher();

batch.add('orders', 'order', 'created', { orderId: '1' });
batch.add('orders', 'order', 'created', { orderId: '2' });
batch.add('orders', 'order', 'created', { orderId: '3' });

const results = await batch.publish();
```

### After (v0.3)

```typescript
import { NatsPubsub } from 'nats-pubsub';

const result = await NatsPubsub.batch()
  .add('orders.created', { orderId: '1' })
  .add('orders.created', { orderId: '2' })
  .add('orders.created', { orderId: '3' })
  .withOptions({ traceId: 'batch-123' })
  .publish();

console.log(`${result.successCount} succeeded, ${result.failureCount} failed`);
```

**Changes:**

- ✅ Fluent API with method chaining
- ✅ Accessible via `NatsPubsub.batch()`
- ✅ Shared options via `withOptions()`
- ✅ Better result reporting

---

## Subscriber Changes

### Before (v0.2) - Domain/Resource/Action with `call()`

```typescript
import { Subscriber } from 'nats-pubsub';

class OrderCreatedSubscriber extends Subscriber {
  domain = 'orders';
  resource = 'order';
  action = 'created';

  async call(message: any, metadata: any) {
    console.log('Order created:', message.orderId);
    console.log('Event ID:', metadata.eventId);
    console.log('Trace ID:', metadata.traceId);

    await processOrder(message);
  }
}
```

### After (v0.3) - Topic-Based with `handle()`

```typescript
import { subscriber, type MessageContext } from 'nats-pubsub';

const OrderCreatedSubscriber = subscriber('orders.created', {
  handler: async (message, context: MessageContext) => {
    console.log('Order created:', message.orderId);
    console.log('Event ID:', context.eventId);
    console.log('Trace ID:', context.traceId);
    console.log('Topic:', context.topic);
    console.log('Deliveries:', context.deliveries);

    await processOrder(message);
  },
});
```

**Changes:**

- ❌ Removed `call()` method
- ✅ New `handle()` method with `handler` option
- ❌ Removed `domain`, `resource`, `action` properties
- ✅ Direct topic subscription via `subscriber(topic, options)`
- ✅ Unified `MessageContext` object instead of loose metadata

---

### Subscriber with Error Handling

### Before (v0.2)

```typescript
class PaymentSubscriber extends Subscriber {
  domain = 'payments';
  resource = 'payment';
  action = 'process';

  async call(message: any, metadata: any) {
    await processPayment(message);
  }

  async onError(error: Error, message: any, metadata: any) {
    if (error.name === 'ValidationError') {
      return 'discard'; // String-based action
    }
    return 'retry';
  }
}
```

### After (v0.3)

```typescript
import { subscriber, ErrorAction, type ErrorContext } from 'nats-pubsub';

const PaymentSubscriber = subscriber('payments.process', {
  handler: async (message, context) => {
    await processPayment(message);
  },
  onError: async (errorContext: ErrorContext) => {
    const { error, message, context, attemptNumber, maxAttempts } = errorContext;

    if (error.name === 'ValidationError') {
      return ErrorAction.DISCARD; // Enum-based action
    }

    if (errorContext.last_attempt) {
      return ErrorAction.DLQ;
    }

    return ErrorAction.RETRY;
  },
});
```

**Changes:**

- ✅ `ErrorAction` enum instead of strings
- ✅ Structured `ErrorContext` with attempt tracking
- ✅ Helper methods: `last_attempt`, `remaining_attempts`

---

### Subscriber with Schema Validation

### Before (v0.2)

```typescript
class OrderSubscriber extends Subscriber {
  domain = 'orders';
  resource = 'order';
  action = 'created';

  async call(message: any, metadata: any) {
    // Manual validation
    if (!message.orderId || !message.customerId) {
      throw new Error('Invalid message');
    }

    await processOrder(message);
  }
}
```

### After (v0.3)

```typescript
import { subscriber, z, CommonSchemas } from 'nats-pubsub';

const OrderSchema = z.object({
  orderId: CommonSchemas.uuid,
  customerId: CommonSchemas.uuid,
  amount: z.number().positive(),
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().int().positive(),
    })
  ),
});

const OrderSubscriber = subscriber('orders.created', {
  schema: OrderSchema, // Automatic validation
  handler: async (message, context) => {
    // message is fully typed and validated
    await processOrder(message);
  },
});
```

**Changes:**

- ✅ Built-in Zod schema validation
- ✅ Type inference from schema
- ✅ Common schemas via `CommonSchemas`

---

### Subscriber with Circuit Breaker

### Before (v0.2)

```typescript
// No built-in circuit breaker support
class ExternalAPISubscriber extends Subscriber {
  domain = 'api';
  resource = 'request';
  action = 'process';

  async call(message: any, metadata: any) {
    // Manual retry logic
    let retries = 0;
    while (retries < 3) {
      try {
        await callExternalAPI(message);
        break;
      } catch (error) {
        retries++;
        if (retries >= 3) throw error;
        await sleep(1000 * retries);
      }
    }
  }
}
```

### After (v0.3)

```typescript
import { subscriber, CircuitBreaker } from 'nats-pubsub';

const apiCircuitBreaker = new CircuitBreaker({
  threshold: 5,
  timeout: 30000,
  halfOpenMaxCalls: 3,
});

const ExternalAPISubscriber = subscriber('api.request.process', {
  handler: async (message, context) => {
    await apiCircuitBreaker.execute(async () => {
      return await callExternalAPI(message);
    });
  },
  onError: async (errorContext) => {
    if (errorContext.error.name === 'CircuitBreakerError') {
      // Circuit is open, don't retry immediately
      return ErrorAction.DLQ;
    }
    return ErrorAction.RETRY;
  },
});
```

**Changes:**

- ✅ Built-in `CircuitBreaker` class
- ✅ Automatic state management (closed → open → half-open)
- ✅ Stats and monitoring via `getStats()`

---

## Testing Changes

### Before (v0.2)

```typescript
// Manual test setup
import { NatsPubsub } from 'nats-pubsub';

describe('OrderProcessor', () => {
  beforeEach(async () => {
    await NatsPubsub.configure({ appName: 'test', natsUrls: 'nats://localhost:4222' });
    await NatsPubsub.ensureTopology();
  });

  it('processes orders', async () => {
    const subscriber = new OrderProcessor();
    await subscriber.call({ orderId: '123' }, { eventId: 'evt-1' });

    // Manual assertions
    expect(orderProcessed).toBe(true);
  });
});
```

### After (v0.3)

```typescript
import { TestHarness } from 'nats-pubsub';

describe('OrderProcessor', () => {
  let harness: TestHarness;

  beforeEach(async () => {
    harness = new TestHarness({
      subscribers: [OrderProcessor],
      inlineMode: true,
    });
    await harness.setup();
  });

  afterEach(async () => {
    await harness.cleanup();
  });

  it('processes orders', async () => {
    await harness.publish('orders.created', { orderId: '123' });

    await harness.waitForSubscriber(OrderProcessor);

    expect(harness.subscriberCalled(OrderProcessor)).toBe(true);
    expect(harness.subscriberCallCount(OrderProcessor)).toBe(1);

    const confirmations = harness.received('orders.confirmed');
    expect(confirmations.length).toBe(1);
  });

  it('handles errors', async () => {
    harness.simulateError(OrderProcessor, new Error('DB error'));

    await harness.publish('orders.created', { orderId: '456' });

    await harness.waitFor(() => harness.dlqMessages().length > 0);

    const dlqMessages = harness.dlqMessages();
    expect(dlqMessages.length).toBe(1);
  });
});
```

**Changes:**

- ✅ Comprehensive `TestHarness` utility
- ✅ Message capture and inspection
- ✅ Subscriber call tracking
- ✅ Error simulation
- ✅ DLQ message tracking
- ✅ Wait helpers for async operations

---

## Complete Migration Example

### Before (v0.2)

```typescript
// config.ts
import { NatsPubsub } from 'nats-pubsub';

NatsPubsub.configure({
  appName: 'order-service',
  natsUrls: 'nats://localhost:4222',
  env: 'production',
  concurrency: 20,
});

// subscriber.ts
import { Subscriber } from 'nats-pubsub';

class OrderCreatedSubscriber extends Subscriber {
  domain = 'orders';
  resource = 'order';
  action = 'created';

  async call(message: any, metadata: any) {
    await processOrder(message);

    await NatsPubsub.publishToTopic('notifications', 'email', 'send', {
      userId: message.customerId,
    });
  }

  async onError(error: Error, message: any) {
    return error.name === 'ValidationError' ? 'discard' : 'retry';
  }
}

// main.ts
await NatsPubsub.ensureTopology();
NatsPubsub.registerSubscriber(new OrderCreatedSubscriber());
await NatsPubsub.start();
```

### After (v0.3)

```typescript
// config.ts
import { NatsPubsub, Presets } from 'nats-pubsub';

NatsPubsub.configure(
  Presets.production({
    appName: 'order-service',
    natsUrls: 'nats://localhost:4222',
  })
);

// subscriber.ts
import {
  subscriber,
  ErrorAction,
  z,
  CommonSchemas,
  type MessageContext,
  type ErrorContext,
} from 'nats-pubsub';

const OrderSchema = z.object({
  orderId: CommonSchemas.uuid,
  customerId: CommonSchemas.uuid,
  amount: z.number().positive(),
});

const OrderCreatedSubscriber = subscriber('orders.created', {
  schema: OrderSchema,
  handler: async (message, context: MessageContext) => {
    await processOrder(message);

    await NatsPubsub.publish({
      topic: 'notifications.email.send',
      message: { userId: message.customerId },
      metadata: {
        traceId: context.traceId,
        correlationId: context.correlationId,
      },
    });
  },
  onError: async (errorContext: ErrorContext) => {
    return errorContext.error.name === 'ValidationError' ? ErrorAction.DISCARD : ErrorAction.RETRY;
  },
});

// main.ts
await NatsPubsub.setup();
NatsPubsub.subscribeTo(OrderCreatedSubscriber);
await NatsPubsub.start();
```

---

## Summary of Breaking Changes

| Feature                   | Old (v0.2)                                          | New (v0.3)                              |
| ------------------------- | --------------------------------------------------- | --------------------------------------- |
| **Publishing**            | `publishToTopic(domain, resource, action, message)` | `publish({ topic, message, metadata })` |
| **Subject Format**        | `{env}.{app}.events.{domain}.{resource}.{action}`   | `{env}.{app}.{topic}`                   |
| **Subscriber Method**     | `call(message, metadata)`                           | `handle(message, context)`              |
| **Subscriber Definition** | `domain`, `resource`, `action` properties           | `subscriber(topic, options)`            |
| **Error Actions**         | String literals: `'retry'`, `'discard'`, `'dlq'`    | Enum: `ErrorAction.RETRY`, etc.         |
| **Metadata**              | Loose object                                        | Typed `MessageContext`                  |
| **Error Context**         | Separate parameters                                 | Unified `ErrorContext`                  |
| **Batch Publishing**      | `new BatchPublisher()`                              | `NatsPubsub.batch()`                    |
| **Configuration**         | Manual                                              | `Presets` + `setup()`                   |
| **Testing**               | Manual setup                                        | `TestHarness` utility                   |

---

## Migration Checklist

- [ ] Update all `publishToTopic()` calls to `publish()`
- [ ] Convert domain/resource/action to topic-based names
- [ ] Rename `call()` methods to `handle()`
- [ ] Remove `domain`, `resource`, `action` properties from subscribers
- [ ] Update to `subscriber()` function instead of class extension
- [ ] Replace metadata parameter with `MessageContext` type
- [ ] Convert error action strings to `ErrorAction` enum
- [ ] Update error handlers to use `ErrorContext`
- [ ] Add schema validation where appropriate
- [ ] Update batch publishing to use fluent API
- [ ] Update configuration to use presets
- [ ] Migrate tests to use `TestHarness`
- [ ] Update integration tests for new subject format

---

## Need Help?

- See [complete-example.ts](./complete-example.ts) for a full working example
- Check [BREAKING_CHANGES_v0.3.md](../../../BREAKING_CHANGES_v0.3.md) for detailed changes
- Review [API_IMPROVEMENTS.md](../../../API_IMPROVEMENTS.md) for design rationale
