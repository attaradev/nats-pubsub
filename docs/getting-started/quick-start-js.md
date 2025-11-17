# JavaScript/TypeScript Quick Start

Get up and running with NatsPubsub in 5 minutes.

## Prerequisites

- Node.js >= 20.x
- NATS server with JetStream running
- Basic TypeScript/JavaScript knowledge

Need to install? See [Installation Guide](./installation.md).

## Step 1: Install NatsPubsub

```bash
npm install nats-pubsub
```

## Step 2: Create a Publisher

Create `publisher.ts`:

```typescript
import NatsPubsub from "nats-pubsub";

async function main() {
  // Configure NatsPubsub
  NatsPubsub.configure({
    natsUrls: "nats://localhost:4222",
    env: "development",
    appName: "quick-start",
  });

  // Publish a message
  await NatsPubsub.publish("user.created", {
    userId: "123",
    email: "user@example.com",
    name: "John Doe",
  });

  console.log("✓ Published user.created event");
}

main().catch(console.error);
```

Run it:

```bash
npx tsx publisher.ts
# or: node --loader ts-node/esm publisher.ts
```

## Step 3: Create a Subscriber

Create `subscriber.ts`:

```typescript
import NatsPubsub, { Subscriber, TopicMetadata } from "nats-pubsub";

// Define a subscriber
class UserCreatedSubscriber extends Subscriber<
  Record<string, unknown>,
  TopicMetadata
> {
  constructor() {
    // Full subject: {env}.{appName}.{topic}
    super("development.quick-start.user.created");
  }

  async handle(
    message: Record<string, unknown>,
    metadata: TopicMetadata,
  ): Promise<void> {
    console.log("📨 Received user.created event:", message);
    console.log("   User ID:", message.userId);
    console.log("   Email:", message.email);

    // Process the message
    // await sendWelcomeEmail(message.email);
    // await createUserProfile(message);
  }
}

async function main() {
  // Configure
  NatsPubsub.configure({
    natsUrls: "nats://localhost:4222",
    env: "development",
    appName: "quick-start",
  });

  // Register subscriber
  NatsPubsub.registerSubscriber(new UserCreatedSubscriber());

  // Start listening
  await NatsPubsub.start();
  console.log("✓ Subscribers started, waiting for messages...");

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\nShutting down...");
    await NatsPubsub.stop();
    process.exit(0);
  });
}

main().catch(console.error);
```

Run it in a separate terminal:

```bash
npx tsx subscriber.ts
```

## Step 4: Test It

1. Keep the subscriber running in one terminal
2. Run the publisher in another terminal:

```bash
npx tsx publisher.ts
```

You should see:

- **Publisher**: `✓ Published user.created event`
- **Subscriber**: `📨 Received user.created event: { userId: '123', ... }`

Congratulations! 🎉 You've successfully published and consumed your first message.

## Next Steps

### Using TypeScript Generics

```typescript
interface UserCreatedMessage {
  userId: string;
  email: string;
  name: string;
}

class UserCreatedSubscriber extends Subscriber<
  UserCreatedMessage,
  TopicMetadata
> {
  constructor() {
    super("development.quick-start.user.created");
  }

  async handle(
    message: UserCreatedMessage,
    metadata: TopicMetadata,
  ): Promise<void> {
    // message is fully typed!
    console.log("Valid user created:", message.userId);
    console.log("Topic:", metadata.topic);
  }
}
```

### Add Middleware

```typescript
import { loggingMiddleware, retryLoggerMiddleware } from "nats-pubsub";

// Add built-in middleware
NatsPubsub.use(loggingMiddleware);
NatsPubsub.use(retryLoggerMiddleware);

// Or create custom middleware
import { Middleware, EventMetadata } from "nats-pubsub";

class TimingMiddleware implements Middleware {
  async call(
    event: Record<string, unknown>,
    metadata: EventMetadata,
    next: () => Promise<void>,
  ): Promise<void> {
    const start = Date.now();
    await next();
    console.log(`Processing took ${Date.now() - start}ms`);
  }
}

NatsPubsub.use(new TimingMiddleware());
```

### Batch Publishing

```typescript
// Publish multiple messages efficiently
const result = await NatsPubsub.batch()
  .add("user.created", { userId: "1", email: "user1@example.com" })
  .add("user.created", { userId: "2", email: "user2@example.com" })
  .add("user.created", { userId: "3", email: "user3@example.com" })
  .withOptions({ trace_id: "batch-123" })
  .publish();

console.log(`✓ Published ${result.successCount} messages`);
```

### Wildcard Subscriptions

```typescript
// Subscribe to all user events
class AllUserEventsSubscriber extends Subscriber<
  Record<string, unknown>,
  TopicMetadata
> {
  constructor() {
    // Use * for single-level wildcard
    super("development.quick-start.user.*");
  }

  async handle(
    message: Record<string, unknown>,
    metadata: TopicMetadata,
  ): Promise<void> {
    console.log(`Received ${metadata.topic}:`, message);

    // Route based on topic
    if (metadata.topic === "user.created") {
      await this.handleCreated(message);
    } else if (metadata.topic === "user.updated") {
      await this.handleUpdated(message);
    }
  }

  private async handleCreated(message: Record<string, unknown>): Promise<void> {
    // Implementation
  }

  private async handleUpdated(message: Record<string, unknown>): Promise<void> {
    // Implementation
  }
}
```

### Schema Validation

```typescript
import { z } from "zod";
import { SchemaValidator } from "nats-pubsub";

const UserCreatedSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  name: z.string(),
});

type UserCreated = z.infer<typeof UserCreatedSchema>;

class UserCreatedSubscriber extends Subscriber<UserCreated, TopicMetadata> {
  private validator = new SchemaValidator(UserCreatedSchema);

  constructor() {
    super("development.quick-start.user.created");
  }

  async handle(message: UserCreated, metadata: TopicMetadata): Promise<void> {
    // Validate message
    const result = this.validator.validate(message);
    if (!result.valid) {
      console.error("Invalid message:", result.errors);
      throw new Error("Validation failed");
    }

    // message is validated and fully typed!
    console.log("Valid user created:", message.userId);
  }
}
```

### Error Handling

```typescript
class UserCreatedSubscriber extends Subscriber<
  Record<string, unknown>,
  TopicMetadata
> {
  constructor() {
    super("development.quick-start.user.created", {
      maxDeliver: 3, // Retry up to 3 times
      ackWait: 30000, // 30 seconds to process
    });
  }

  async handle(
    message: Record<string, unknown>,
    metadata: TopicMetadata,
  ): Promise<void> {
    try {
      await this.processUser(message);
    } catch (error) {
      console.error("Failed to process user:", error);
      // Throwing will trigger automatic retry with exponential backoff
      throw error;
    }
  }

  private async processUser(message: Record<string, unknown>): Promise<void> {
    // Your processing logic
  }
}
```

## Complete Example

Here's a more complete example with error handling and configuration:

```typescript
import NatsPubsub, {
  Subscriber,
  TopicMetadata,
  loggingMiddleware,
} from "nats-pubsub";

// Configuration
const config = {
  natsUrls: process.env.NATS_URL || "nats://localhost:4222",
  env: process.env.NODE_ENV || "development",
  appName: "quick-start",
  concurrency: 10,
  maxDeliver: 5,
  useDlq: true,
};

// Message type
interface UserCreated {
  userId: string;
  email: string;
  name: string;
}

// Subscriber
class UserCreatedSubscriber extends Subscriber<UserCreated, TopicMetadata> {
  constructor() {
    super("development.quick-start.user.created", {
      maxDeliver: 3,
      ackWait: 30000,
    });
  }

  async handle(message: UserCreated, metadata: TopicMetadata): Promise<void> {
    console.log("Processing new user:", message);

    // Simulate async work
    await this.sendWelcomeEmail(message.email);
    await this.createUserProfile(message);

    console.log("✓ User processed successfully");
  }

  private async sendWelcomeEmail(email: string): Promise<void> {
    console.log(`  Sending welcome email to ${email}`);
    // Implementation
  }

  private async createUserProfile(user: UserCreated): Promise<void> {
    console.log(`  Creating profile for user ${user.userId}`);
    // Implementation
  }
}

// Publisher function
async function publishUserCreated(user: UserCreated): Promise<void> {
  await NatsPubsub.publish("user.created", user, {
    trace_id: `trace-${Date.now()}`,
    message_type: "UserCreated",
  });
  console.log("✓ Published user.created event");
}

// Subscriber function
async function startSubscribers(): Promise<void> {
  // Configure
  NatsPubsub.configure(config);

  // Add middleware
  NatsPubsub.use(loggingMiddleware);

  // Register subscribers
  NatsPubsub.registerSubscriber(new UserCreatedSubscriber());

  // Start
  await NatsPubsub.start();
  console.log("✓ Subscribers started");

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\nShutting down gracefully...");
    await NatsPubsub.stop();
    process.exit(0);
  });
}

// Main
async function main(): Promise<void> {
  const command = process.argv[2];

  if (command === "publish") {
    NatsPubsub.configure(config);
    await publishUserCreated({
      userId: "123",
      email: "user@example.com",
      name: "John Doe",
    });
  } else if (command === "subscribe") {
    await startSubscribers();
  } else {
    console.log("Usage:");
    console.log("  npx tsx example.ts subscribe  # Start subscriber");
    console.log("  npx tsx example.ts publish    # Publish message");
  }
}

main().catch(console.error);
```

Run it:

```bash
# Terminal 1: Start subscriber
npx tsx example.ts subscribe

# Terminal 2: Publish message
npx tsx example.ts publish
```

## Testing Your Code

```typescript
import { createMockMetadata, createMockMessage } from "nats-pubsub/testing";

describe("UserCreatedSubscriber", () => {
  it("should process user created events", async () => {
    const subscriber = new UserCreatedSubscriber();

    const message = {
      userId: "123",
      email: "test@example.com",
      name: "Test User",
    };

    const metadata = createMockMetadata({
      topic: "user.created",
      event_id: "test-123",
    });

    await subscriber.handle(message, metadata);

    // Add assertions
    expect(/* ... */).toBe(/* ... */);
  });
});
```

## Configuration Options

```typescript
NatsPubsub.configure({
  // Required
  natsUrls: "nats://localhost:4222",
  env: "development",
  appName: "my-app",

  // Consumer tuning
  concurrency: 10, // Concurrent message processors
  maxDeliver: 5, // Max delivery attempts before DLQ
  ackWait: 30000, // Ack timeout in ms
  backoff: [1000, 5000, 15000, 30000, 60000], // Retry backoff in ms

  // Features
  useDlq: true, // Enable Dead Letter Queue
  useOutbox: false, // Enable Outbox pattern (reliable send)
  useInbox: false, // Enable Inbox pattern (idempotent receive)

  // Optional
  streamName: "my-stream", // Custom stream name
  dlqSubject: "my-app.dlq", // Custom DLQ subject
});
```

## Troubleshooting

### Connection Issues

Check that NATS is running with JetStream enabled:

```bash
docker run -d -p 4222:4222 nats:latest -js
```

### Message Not Received

1. **Check subscriber is running** - The subscriber must be running before publishing
2. **Verify subject matches** - Ensure the full subject `{env}.{appName}.{topic}` matches
3. **Check NATS logs** - `docker logs <container-id>`
4. **Enable debug logging**:

```typescript
NatsPubsub.configure({
  // ... other config
  logger: {
    debug: (msg, meta) => console.debug(msg, meta),
    info: (msg, meta) => console.info(msg, meta),
    warn: (msg, meta) => console.warn(msg, meta),
    error: (msg, meta) => console.error(msg, meta),
  },
});
```

### TypeScript Errors

Install type definitions:

```bash
npm install --save-dev @types/node
```

Add to `tsconfig.json`:

```json
{
  "compilerOptions": {
    "esModuleInterop": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "node"
  }
}
```

## Next Steps

Now that you have the basics working:

1. **Add Reliability**: Learn about [Inbox/Outbox patterns](../patterns/inbox-outbox.md)
2. **Test Your Code**: Read the [Testing Guide](../guides/testing.md)
3. **Go to Production**: Follow the [Deployment Guide](../guides/deployment.md)
4. **Explore Examples**: Check out [example projects](https://github.com/attaradev/nats-pubsub/tree/main/packages/javascript/examples)

## Additional Resources

- [Publishing Guide](../guides/publishing.md) - Advanced publishing techniques
- [Subscribing Guide](../guides/subscribing.md) - Advanced subscriber patterns
- [Configuration Reference](../reference/configuration.md) - All config options
- [API Reference](../reference/javascript-api.md) - Complete API documentation

---

[← Installation](./installation.md) | [Back to Home](../index.md) | [Ruby Quick Start →](./quick-start-ruby.md)
