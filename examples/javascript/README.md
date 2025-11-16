# NatsPubsub JavaScript/TypeScript Examples

This directory contains JavaScript and TypeScript examples for NatsPubsub, demonstrating various patterns and use cases.

## Examples

### Basic Usage

Simple publisher and subscriber examples:

```typescript
import NatsPubsub, { topicSubscriber, MessageContext } from "nats-pubsub";

// Configure
NatsPubsub.configure({
  natsUrls: "nats://localhost:4222",
  env: "development",
  appName: "my-app",
});

// Setup topology
await NatsPubsub.setup();

// Publish
await NatsPubsub.publish("user.created", {
  userId: "123",
  name: "John Doe",
  email: "john@example.com",
});

// Subscribe
@topicSubscriber("user.created")
class UserCreatedSubscriber {
  async handle(message: any, context: MessageContext) {
    console.log("User created:", message);
  }
}

// Register and start
NatsPubsub.registerSubscriber(new UserCreatedSubscriber());
await NatsPubsub.start();
```

## Running Examples Locally

### Prerequisites

- Node.js 20+
- NATS Server with JetStream enabled
- PostgreSQL (for outbox/inbox examples)

### Setup

1. **Install dependencies:**

```bash
npm install
```

2. **Start NATS Server:**

```bash
# Using Docker
docker run -d --name nats -p 4222:4222 nats:latest -js

# Or using NATS CLI
nats-server -js
```

3. **Run examples:**

```bash
# Basic publisher
npx tsx examples/basic-publisher.ts

# Basic subscriber
npx tsx examples/basic-subscriber.ts

# Topic-based patterns
npx tsx examples/topic-patterns.ts

# Error handling
npx tsx examples/error-handling.ts

# Batch publishing
npx tsx examples/batch-publishing.ts
```

## Example Patterns

### 1. Topic-Based Subscription

Subscribe to hierarchical topics with wildcards:

```typescript
// Subscribe to all user events
@topicSubscriber("user.*")
class AllUserEventsSubscriber {
  async handle(message: any, context: MessageContext) {
    console.log(`User event: ${context.topic}`);
  }
}

// Subscribe to specific event
@topicSubscriber("user.created")
class UserCreatedSubscriber {
  async handle(message: any, context: MessageContext) {
    // Handle user creation
  }
}
```

### 2. Wildcard Subscriptions

```typescript
// Subscribe to all subtopics
@topicSubscriberWildcard("notifications")
class AllNotificationsSubscriber {
  async handle(message: any, context: MessageContext) {
    // Receives: notifications.email, notifications.sms, notifications.push, etc.
  }
}
```

### 3. Type-Safe Messages

```typescript
interface UserCreatedMessage {
  userId: string;
  name: string;
  email: string;
}

@topicSubscriber<UserCreatedMessage>("user.created")
class TypedUserSubscriber {
  async handle(message: UserCreatedMessage, context: MessageContext) {
    // message is fully typed!
    console.log(message.name.toUpperCase());
  }
}
```

### 4. Error Handling

```typescript
@topicSubscriber("order.process", {
  maxDeliver: 5,
  ackWait: 30000,
})
class OrderProcessorSubscriber {
  async handle(message: any, context: MessageContext) {
    // Process order
  }

  async onError(errorContext: ErrorContext): Promise<ErrorAction> {
    const { error, attemptNumber, maxAttempts } = errorContext;

    // Retry on transient errors
    if (error.message.includes("connection")) {
      return ErrorAction.RETRY;
    }

    // Send to DLQ on validation errors
    if (error.message.includes("validation")) {
      return ErrorAction.DLQ;
    }

    // Retry with backoff
    if (attemptNumber < maxAttempts) {
      return ErrorAction.RETRY;
    }

    return ErrorAction.DLQ;
  }
}
```

### 5. Batch Publishing

```typescript
// Publish multiple messages efficiently
const result = await NatsPubsub.batch()
  .add("user.created", { id: 1, name: "Alice" })
  .add("user.created", { id: 2, name: "Bob" })
  .add("notification.sent", { userId: 1 })
  .withOptions({ traceId: "batch-123" })
  .publish();

console.log(`Published ${result.successCount} messages`);
```

### 6. Schema Validation

```typescript
import { z } from "zod";

const UserSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string().email(),
});

@topicSubscriber("user.created", {
  schema: UserSchema,
})
class ValidatedUserSubscriber {
  async handle(message: any, context: MessageContext) {
    // Message is automatically validated
  }
}
```

### 7. Outbox Pattern

Reliable message publishing with database transactions:

```typescript
NatsPubsub.configure({
  // ...
  useOutbox: true,
});

// Messages are stored in database first, then published
await NatsPubsub.publish("order.created", orderData);
```

### 8. Inbox Pattern

Idempotent message processing:

```typescript
NatsPubsub.configure({
  // ...
  useInbox: true,
});

// Duplicate messages are automatically deduplicated
```

### 9. Circuit Breaker

```typescript
@topicSubscriber("external.api", {
  circuitBreaker: {
    enabled: true,
    threshold: 5,
    timeout: 60000,
    halfOpenMaxCalls: 3,
  },
})
class ExternalApiSubscriber {
  async handle(message: any, context: MessageContext) {
    // Circuit breaker protects external API
  }
}
```

### 10. Retry Strategy

```typescript
@topicSubscriber("payment.process", {
  retryStrategy: {
    maxAttempts: 5,
    backoff: "exponential",
    initialDelay: 1000,
    maxDelay: 60000,
    multiplier: 2,
  },
})
class PaymentSubscriber {
  async handle(message: any, context: MessageContext) {
    // Custom retry strategy
  }
}
```

## Health Checks

```typescript
// Comprehensive health check
const health = await NatsPubsub.healthCheck();
console.log(health);
// {
//   status: 'healthy',
//   healthy: true,
//   components: {
//     nats: { status: 'healthy' },
//     jetstream: { status: 'healthy' }
//   }
// }

// Quick health check (connection only)
const quick = await NatsPubsub.quickHealthCheck();
```

## Testing

```typescript
import { TestHarness } from "nats-pubsub/testing";

describe("UserService", () => {
  let harness: TestHarness;

  beforeEach(async () => {
    harness = new TestHarness();
    await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("publishes user.created event", async () => {
    await userService.createUser({ name: "Alice" });

    const messages = await harness.waitForMessages("user.created", 1);
    expect(messages[0].name).toBe("Alice");
  });
});
```

## Configuration Presets

```typescript
import { Presets } from "nats-pubsub";

// Development preset
NatsPubsub.configure({
  ...Presets.development,
  appName: "my-app",
});

// Production preset
NatsPubsub.configure({
  ...Presets.production,
  appName: "my-app",
  natsUrls: process.env.NATS_URLS,
});

// Testing preset
NatsPubsub.configure({
  ...Presets.testing,
  appName: "my-app",
});
```

## Complete Examples

See the [microservices example](../microservices) for a complete, production-ready implementation featuring:

- Multiple services (Node.js and Ruby)
- Event-driven workflows
- Saga pattern
- Docker Compose setup
- Health checks
- Error handling
- And more!

## API Reference

For complete API documentation, see:

- [Main Documentation](../../README.md)
- [TypeScript API Docs](../../packages/javascript/docs)

## Common Patterns

### Publisher-Subscriber

```typescript
// Publisher
await NatsPubsub.publish("event.happened", { data: "value" });

// Subscriber
@topicSubscriber("event.happened")
class EventSubscriber {
  async handle(message: any, context: MessageContext) {
    console.log("Event received:", message);
  }
}
```

### Request-Reply (via topics)

```typescript
// Requester
const correlationId = uuidv4();
await NatsPubsub.publish("query.user", {
  userId: "123",
  correlationId,
});

// Responder
@topicSubscriber("query.user")
class UserQuerySubscriber {
  async handle(message: any, context: MessageContext) {
    const user = await getUserById(message.userId);
    await NatsPubsub.publish("query.user.response", {
      correlationId: message.correlationId,
      user,
    });
  }
}
```

### Fan-Out

```typescript
// Publish to multiple topics
await NatsPubsub.publish({
  topics: ["analytics.event", "audit.log", "notifications.alert"],
  message: { action: "user_login", userId: "123" },
});
```

## Best Practices

1. **Use Type Safety**: Define interfaces for your messages
2. **Handle Errors**: Implement `onError` for fine-grained control
3. **Use Schemas**: Validate messages with Zod schemas
4. **Enable DLQ**: Always use dead letter queues in production
5. **Add Tracing**: Include trace_id for distributed tracing
6. **Health Checks**: Expose health check endpoints
7. **Graceful Shutdown**: Handle SIGTERM properly
8. **Test Thoroughly**: Use the TestHarness for testing
9. **Monitor**: Track message rates and errors
10. **Document Events**: Maintain an event catalog

## Troubleshooting

### Connection Issues

```typescript
// Check NATS connection
const health = await NatsPubsub.quickHealthCheck();
console.log(health);

// Enable debug logging
NatsPubsub.configure({
  // ...
  logger: {
    debug: (msg, meta) => console.log("[DEBUG]", msg, meta),
    info: (msg, meta) => console.log("[INFO]", msg, meta),
    warn: (msg, meta) => console.warn("[WARN]", msg, meta),
    error: (msg, meta) => console.error("[ERROR]", msg, meta),
  },
});
```

### Message Not Received

1. Check subscriber is registered before `start()`
2. Verify subject pattern matches
3. Check for errors in subscriber
4. Verify JetStream is enabled
5. Check stream configuration

### Performance Issues

1. Increase concurrency
2. Use batch publishing
3. Enable connection pooling
4. Scale horizontally
5. Optimize message size

## Next Steps

- Explore the [Microservices Example](../microservices)
- Read the [Main Documentation](../../README.md)
- Check out [Ruby Examples](../ruby)
- Learn about [NATS JetStream](https://docs.nats.io/nats-concepts/jetstream)
