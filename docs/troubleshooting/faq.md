# Frequently Asked Questions (FAQ)

Answers to the most common questions about NatsPubsub. Questions are organized by category for easy navigation.

## Table of Contents

- [General Questions](#general-questions)
- [Setup and Configuration](#setup-and-configuration)
- [Publishing and Subscribing](#publishing-and-subscribing)
- [Reliability Patterns](#reliability-patterns)
- [Performance](#performance)
- [Testing](#testing)
- [Deployment](#deployment)
- [Migration](#migration)
- [Troubleshooting](#troubleshooting)
- [Advanced Topics](#advanced-topics)

---

## General Questions

### What is NatsPubsub?

NatsPubsub is a production-ready, declarative pub/sub messaging library built on top of NATS JetStream. It provides a developer-friendly API for building event-driven applications with built-in reliability patterns like Inbox/Outbox and Dead Letter Queue (DLQ).

Available in both JavaScript/TypeScript and Ruby, NatsPubsub enables seamless cross-language communication while maintaining type safety and developer productivity.

### Why should I use NatsPubsub instead of the raw NATS client?

NatsPubsub provides several advantages:

1. **Declarative API**: Class-based subscribers inspired by Rails and NestJS
2. **Built-in Reliability**: Automatic Inbox/Outbox patterns and DLQ
3. **Testing Support**: Fake and inline modes for easy testing
4. **Auto-Topology**: Automatic JetStream stream and consumer creation
5. **Language Parity**: Identical APIs in JavaScript and Ruby
6. **Battle-tested Patterns**: Production-proven reliability patterns out of the box

While you can achieve the same with raw NATS, NatsPubsub saves you from writing boilerplate and makes best practices the default.

### Does NatsPubsub work with NATS Core or only JetStream?

NatsPubsub is built specifically for **NATS JetStream**, which provides persistence, acknowledgments, and guaranteed delivery. It does not support NATS Core (ephemeral messaging).

If you need JetStream features, you must start your NATS server with the `-js` flag:

```bash
nats-server -js
```

### Is NatsPubsub production-ready?

Yes! NatsPubsub is production-ready and includes:

- Battle-tested in high-throughput production systems
- Comprehensive test coverage (95%+)
- Built-in monitoring and health checks
- Extensive documentation
- Active maintenance and security patches

### What languages does NatsPubsub support?

Currently, NatsPubsub supports:

- **JavaScript/TypeScript** (Node.js)
- **Ruby** (with first-class Rails support)

Both implementations maintain API parity, allowing seamless cross-language communication.

### Can JavaScript and Ruby services communicate with each other?

Yes! NatsPubsub is designed for cross-language communication. JavaScript and Ruby services can publish and subscribe to the same topics seamlessly.

```typescript
// JavaScript - Publisher
await publisher.publish("order.created", {
  orderId: "123",
  amount: 99.99,
});
```

```ruby
# Ruby - Subscriber
class OrderSubscriber < NatsPubsub::Subscriber
  subscribe_to 'order.created'

  def handle(message, context)
    # Receives messages from JavaScript publisher
    puts "Order: #{message['order_id']}"
  end
end
```

### Is NatsPubsub free and open source?

Yes! NatsPubsub is open source under the MIT License. You're free to use it in commercial projects, modify it, and distribute it.

---

## Setup and Configuration

### How do I install NatsPubsub?

**JavaScript/TypeScript:**

```bash
npm install nats-pubsub
# or
yarn add nats-pubsub
# or
pnpm add nats-pubsub
```

**Ruby:**

```bash
gem install nats_pubsub
# or add to Gemfile
gem 'nats_pubsub'
```

See [Installation Guide](../getting-started/installation.md) for detailed instructions.

### What are the minimum requirements?

**NATS Server:**

- NATS Server 2.9.0 or later
- JetStream enabled (`-js` flag)

**JavaScript/TypeScript:**

- Node.js 18 or later
- TypeScript 5.0+ (for TypeScript projects)

**Ruby:**

- Ruby 3.0 or later
- Rails 7.0+ (optional, for Rails integration)

**Database (for Inbox/Outbox):**

- PostgreSQL 12+ (recommended)
- MySQL 8.0+
- SQLite 3.35+ (development only)

### Do I need a database to use NatsPubsub?

No, a database is **optional**. You only need a database if you want to use:

- **Inbox Pattern**: For exactly-once processing with deduplication
- **Outbox Pattern**: For guaranteed message delivery

For basic pub/sub without these patterns, NatsPubsub works without a database.

### How do I configure NatsPubsub?

**JavaScript/TypeScript:**

```typescript
import { Publisher, Subscriber } from "nats-pubsub";

const config = {
  servers: "nats://localhost:4222",
  env: "production",
  appName: "my-app",
  reconnect: true,
  maxReconnectAttempts: 10,
};

const publisher = new Publisher(config);
```

**Ruby:**

```ruby
# config/initializers/nats_pubsub.rb
NatsPubsub.configure do |config|
  config.servers = 'nats://localhost:4222'
  config.env = 'production'
  config.app_name = 'my-app'
  config.reconnect = true
  config.max_reconnect_attempts = 10
end
```

See [Configuration Reference](../reference/configuration.md) for all options.

### What is `env` and `appName` used for?

`env` and `appName` are used to generate unique subject prefixes:

```
{env}.{appName}.{topic}
```

Example:

- env: `production`
- appName: `order-service`
- topic: `order.created`
- Full subject: `production.order-service.order.created`

This allows multiple environments and applications to share the same NATS server without conflicts.

### Can I use different `env` or `appName` for publishers and subscribers?

Yes, but they must match if you want them to communicate!

**Same application (communicates):**

```typescript
// Publisher
const publisher = new Publisher({
  env: "production",
  appName: "order-service",
});

// Subscriber
class OrderSubscriber extends Subscriber {
  constructor() {
    super("order.created"); // Will receive messages
  }
}

await subscriber.connect({
  env: "production",
  appName: "order-service",
});
```

**Different applications (doesn't communicate):**

```typescript
// Publisher
const publisher = new Publisher({
  env: "production",
  appName: "order-service",
});
// Publishes to: production.order-service.order.created

// Subscriber
await subscriber.connect({
  env: "staging",
  appName: "other-service",
});
// Subscribes to: staging.other-service.order.created
// ❌ Won't receive messages!
```

### How do I connect to multiple NATS servers?

Provide an array of server URLs:

```typescript
// JavaScript
const publisher = new Publisher({
  servers: [
    "nats://server1:4222",
    "nats://server2:4222",
    "nats://server3:4222",
  ],
});
```

```ruby
# Ruby
NatsPubsub.configure do |config|
  config.servers = [
    'nats://server1:4222',
    'nats://server2:4222',
    'nats://server3:4222'
  ]
end
```

The client will automatically connect to one and fail over to others if needed.

### How do I secure my NATS connection?

Use TLS and authentication:

```typescript
// JavaScript - TLS + Authentication
const publisher = new Publisher({
  servers: "nats://nats.example.com:4222",
  tls: {
    ca: fs.readFileSync("./ca.pem"),
    cert: fs.readFileSync("./cert.pem"),
    key: fs.readFileSync("./key.pem"),
  },
  user: "myuser",
  pass: "mypassword",
});
```

```ruby
# Ruby
NatsPubsub.configure do |config|
  config.servers = 'nats://nats.example.com:4222'
  config.tls = {
    ca_file: './ca.pem',
    cert_file: './cert.pem',
    key_file: './key.pem'
  }
  config.user = 'myuser'
  config.pass = 'mypassword'
end
```

See [Security Best Practices](../advanced/security.md) for more details.

---

## Publishing and Subscribing

### How do I publish a message?

**JavaScript/TypeScript:**

```typescript
import { Publisher } from "nats-pubsub";

const publisher = new Publisher({
  servers: "nats://localhost:4222",
  env: "development",
  appName: "order-service",
});

await publisher.publish("order.created", {
  orderId: "123",
  amount: 99.99,
  customerId: "456",
});
```

**Ruby:**

```ruby
NatsPubsub.publish('order.created', {
  order_id: '123',
  amount: 99.99,
  customer_id: '456'
})
```

### How do I subscribe to messages?

**JavaScript/TypeScript:**

```typescript
import { Subscriber } from "nats-pubsub";

class OrderSubscriber extends Subscriber {
  constructor() {
    super("order.created");
  }

  async handle(message, metadata) {
    console.log("Processing order:", message.orderId);
    await processOrder(message);
  }
}

const subscriber = new OrderSubscriber();
await subscriber.connect({
  servers: "nats://localhost:4222",
  env: "development",
  appName: "order-service",
});
```

**Ruby:**

```ruby
class OrderSubscriber < NatsPubsub::Subscriber
  subscribe_to 'order.created'

  def handle(message, context)
    puts "Processing order: #{message['order_id']}"
    process_order(message)
  end
end

# Start all subscribers
NatsPubsub::Manager.start
```

### Can I publish to multiple topics at once?

Yes! Use batch publishing:

```typescript
// JavaScript
import { BatchPublisher } from "nats-pubsub";

const batchPublisher = new BatchPublisher({
  servers: "nats://localhost:4222",
  batchSize: 100,
});

await Promise.all([
  batchPublisher.publish("order.created", orderData),
  batchPublisher.publish("inventory.updated", inventoryData),
  batchPublisher.publish("email.sent", emailData),
]);

await batchPublisher.flush();
```

```ruby
# Ruby
NatsPubsub::Publisher.batch do |batch|
  batch.publish('order.created', order_data)
  batch.publish('inventory.updated', inventory_data)
  batch.publish('email.sent', email_data)
end
```

### How do I subscribe to multiple topics?

Create multiple subscribers or use wildcards:

**Multiple Subscribers:**

```typescript
// JavaScript
class OrderCreatedSubscriber extends Subscriber {
  constructor() {
    super("order.created");
  }
}

class OrderUpdatedSubscriber extends Subscriber {
  constructor() {
    super("order.updated");
  }
}
```

**Wildcards:**

```typescript
// Subscribe to all order events
class OrderSubscriber extends Subscriber {
  constructor() {
    super("order.*"); // Matches order.created, order.updated, etc.
  }

  async handle(message, metadata) {
    console.log("Event:", metadata.subject);

    if (metadata.subject.endsWith(".created")) {
      await handleCreated(message);
    } else if (metadata.subject.endsWith(".updated")) {
      await handleUpdated(message);
    }
  }
}
```

### Can I send metadata with messages?

Yes! Add custom metadata:

```typescript
// JavaScript
await publisher.publish("order.created", orderData, {
  metadata: {
    correlationId: "abc-123",
    userId: "456",
    source: "web-app",
    version: "1.0",
  },
});

// Subscriber receives metadata
class OrderSubscriber extends Subscriber {
  async handle(message, metadata) {
    console.log("Correlation ID:", metadata.metadata.correlationId);
    console.log("User ID:", metadata.metadata.userId);
  }
}
```

### How do I handle errors in subscribers?

Implement error handling:

```typescript
// JavaScript
class OrderSubscriber extends Subscriber {
  async handle(message, metadata) {
    try {
      await processOrder(message);
    } catch (error) {
      console.error("Processing failed:", error);
      throw error; // Re-throw for retry/DLQ
    }
  }

  async onError(error, message, metadata) {
    console.error("Handler error:", {
      error: error.message,
      messageId: metadata.messageId,
      attempt: metadata.deliveryAttempt,
    });

    // Optionally send to monitoring service
    await monitoringService.reportError(error, metadata);
  }
}
```

```ruby
# Ruby
class OrderSubscriber < NatsPubsub::Subscriber
  subscribe_to 'order.created'

  def handle(message, context)
    process_order(message)
  rescue => error
    logger.error "Processing failed: #{error.message}"
    raise # Re-raise for retry/DLQ
  end

  def on_error(error, message, context)
    logger.error "Handler error: #{error.inspect}"
    MonitoringService.report_error(error, context)
  end
end
```

### How do I acknowledge messages manually?

Use manual acknowledgment:

```typescript
// JavaScript
class OrderSubscriber extends Subscriber {
  constructor() {
    super("order.created", {
      ackPolicy: "explicit",
    });
  }

  async handle(message, metadata) {
    try {
      await processOrder(message);
      await metadata.ack(); // Acknowledge success
    } catch (error) {
      await metadata.nak(); // Negative ack - will redeliver
      // Or use nak with delay
      await metadata.nak(5000); // Redeliver after 5 seconds
    }
  }
}
```

### How do I process messages in order?

By default, messages are processed in parallel for performance. For ordered processing:

```typescript
// JavaScript - Sequential processing
class OrderSubscriber extends Subscriber {
  constructor() {
    super("order.created", {
      maxConcurrent: 1, // Process one at a time
    });
  }

  async handle(message, metadata) {
    // Messages processed in order
    await processOrder(message);
  }
}
```

Note: This significantly reduces throughput. Consider if you really need strict ordering.

---

## Reliability Patterns

### What is the Inbox pattern?

The Inbox pattern prevents duplicate message processing by checking a database table before processing:

1. Message arrives
2. Check if message ID exists in inbox table
3. If exists, skip processing (already handled)
4. If not, process and insert into inbox table

This ensures **exactly-once processing**.

```typescript
// JavaScript - Enable inbox
class OrderSubscriber extends Subscriber {
  useInbox = true;

  async handle(message, metadata) {
    // Only called once per unique message
    await processOrder(message);
  }
}
```

See [Inbox/Outbox Pattern Guide](../patterns/inbox-outbox.md) for details.

### What is the Outbox pattern?

The Outbox pattern ensures messages are delivered even if NATS is unavailable:

1. Save message to database (outbox table)
2. Commit database transaction
3. Background process relays messages to NATS
4. Mark as relayed in database

This ensures **at-least-once delivery** and **transactional publishing**.

```typescript
// JavaScript - Enable outbox
const publisher = new Publisher({
  servers: "nats://localhost:4222",
  useOutbox: true,
  database: {
    host: "localhost",
    database: "myapp",
  },
});
```

See [Inbox/Outbox Pattern Guide](../patterns/inbox-outbox.md) for details.

### Should I always use Inbox/Outbox patterns?

**Use Inbox when:**

- Duplicate processing would cause issues (e.g., charging twice)
- You need exactly-once semantics
- You can tolerate slightly increased latency

**Use Outbox when:**

- Message loss is unacceptable
- You need transactional publishing (message + DB change)
- You can tolerate eventual delivery

**Skip them when:**

- Messages are idempotent
- Some message loss is acceptable
- You need maximum performance
- You're in development/testing

### What is a Dead Letter Queue (DLQ)?

A DLQ stores messages that failed processing after maximum retry attempts. This prevents infinite retry loops and allows manual inspection of problematic messages.

```typescript
// JavaScript - Configure DLQ
class OrderSubscriber extends Subscriber {
  constructor() {
    super("order.created", {
      maxDeliver: 3, // Max 3 attempts
      dlqTopic: "order.created.dlq", // Send failures here
    });
  }
}

// Subscribe to DLQ for monitoring
class OrderDLQSubscriber extends Subscriber {
  constructor() {
    super("order.created.dlq");
  }

  async handle(message, metadata) {
    // Log for manual investigation
    console.error("Message failed after max retries:", {
      messageId: metadata.messageId,
      error: metadata.error,
      attempts: metadata.deliveryAttempt,
      payload: message,
    });

    // Alert ops team
    await alerting.sendAlert("DLQ message received", message);
  }
}
```

See [Dead Letter Queue Guide](../patterns/dlq.md) for details.

### How do I configure retry behavior?

Configure retry attempts and backoff:

```typescript
// JavaScript
class OrderSubscriber extends Subscriber {
  constructor() {
    super("order.created", {
      maxDeliver: 5, // Max 5 attempts
      ackWait: 30000, // Wait 30s for ack
      backoff: "exponential", // Exponential backoff
      maxBackoff: 60000, // Max 60s between retries
    });
  }
}
```

```ruby
# Ruby
class OrderSubscriber < NatsPubsub::Subscriber
  subscribe_to 'order.created',
    max_deliver: 5,
    ack_wait: 30_000,
    backoff: :exponential,
    max_backoff: 60_000
end
```

### Can I retry only on specific errors?

Yes! Use custom retry logic:

```typescript
// JavaScript
class OrderSubscriber extends Subscriber {
  async handle(message, metadata) {
    try {
      await processOrder(message);
    } catch (error) {
      if (error.code === "TEMPORARY_ERROR") {
        // Retry this error
        await metadata.nak(5000);
      } else if (error.code === "PERMANENT_ERROR") {
        // Don't retry, send to DLQ
        await metadata.term();
      } else {
        // Default retry behavior
        throw error;
      }
    }
  }
}
```

---

## Performance

### How many messages per second can NatsPubsub handle?

Performance varies based on configuration and hardware, but typical throughput:

| Operation          | Throughput    | Latency (p99) |
| ------------------ | ------------- | ------------- |
| Publishing (sync)  | 50K msgs/sec  | 2ms           |
| Publishing (batch) | 200K msgs/sec | 5ms           |
| Subscribing        | 100K msgs/sec | &lt;1ms       |
| Inbox Check        | 150K ops/sec  | &lt;1ms       |
| Outbox Relay       | 80K msgs/sec  | 10ms          |

See the Performance Guide for optimization tips.

### How do I improve publishing performance?

Use batch publishing:

```typescript
// JavaScript - Batch publishing
import { BatchPublisher } from "nats-pubsub";

const publisher = new BatchPublisher({
  servers: "nats://localhost:4222",
  batchSize: 100, // Batch up to 100 messages
  batchWindow: 1000, // Or flush after 1 second
});

// Messages are automatically batched
for (let i = 0; i < 1000; i++) {
  await publisher.publish("order.created", { orderId: i });
}

await publisher.flush(); // Ensure all sent
```

See [Performance Guide](../guides/performance.md) for more optimization tips.

### How do I improve subscriber performance?

Increase concurrency:

```typescript
// JavaScript
class OrderSubscriber extends Subscriber {
  constructor() {
    super("order.created", {
      maxConcurrent: 10, // Process 10 messages at once
      prefetch: 20, // Prefetch 20 messages
    });
  }
}
```

```ruby
# Ruby
NatsPubsub.configure do |config|
  config.worker_threads = 10
end
```

See [Performance Guide](../guides/performance.md) for more tips.

### Does NatsPubsub support message compression?

Not built-in, but you can compress manually:

```typescript
// JavaScript - Manual compression
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// Publish with compression
const data = { orderId: '123', items: [...] };
const compressed = await gzip(JSON.stringify(data));
await publisher.publish('order.created', compressed, {
  metadata: { compressed: true }
});

// Subscribe with decompression
class OrderSubscriber extends Subscriber {
  async handle(message, metadata) {
    let data = message;

    if (metadata.metadata?.compressed) {
      const decompressed = await gunzip(Buffer.from(message));
      data = JSON.parse(decompressed.toString());
    }

    await processOrder(data);
  }
}
```

### What's the maximum message size?

NATS JetStream default maximum message size is **1MB**. This can be configured on the server:

```conf
# nats-server.conf
jetstream {
  max_payload: 8MB  # Increase to 8MB
}
```

For larger data, consider:

1. Storing in object storage (S3, GCS) and sending URL
2. Chunking messages
3. Using compression

### How do I monitor performance?

Use built-in metrics:

```typescript
// JavaScript - Collect metrics
import { Publisher } from "nats-pubsub";

const publisher = new Publisher({
  servers: "nats://localhost:4222",
  metrics: true,
});

// Get metrics
const metrics = publisher.getMetrics();
console.log(metrics);
// {
//   published: 1000,
//   errors: 2,
//   avgLatency: 5.2,
//   throughput: 200
// }
```

See [Monitoring Guide](../guides/performance.md#monitoring) for details.

---

## Testing

### How do I test subscribers?

Use test mode or fake publishers:

```typescript
// JavaScript - Test mode
import { Subscriber } from "nats-pubsub";

describe("OrderSubscriber", () => {
  it("processes orders", async () => {
    const subscriber = new OrderSubscriber();

    await subscriber.connect({
      servers: "nats://localhost:4222",
      mode: "inline", // Synchronous processing for tests
    });

    // Publish test message
    await publisher.publish("order.created", {
      orderId: "test-123",
    });

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Assert results
    expect(processOrder).toHaveBeenCalledWith({
      orderId: "test-123",
    });
  });
});
```

```ruby
# Ruby - Test mode
RSpec.describe OrderSubscriber do
  it 'processes orders' do
    NatsPubsub.enable_test_mode!

    NatsPubsub.publish('order.created', { order_id: 'test-123' })

    expect(OrderSubscriber).to have_received_message('order.created')
      .with_payload(order_id: 'test-123')
  end
end
```

See [Testing Guide](../guides/testing.md) for comprehensive strategies.

### Do I need a running NATS server for tests?

No! Use fake mode:

```typescript
// JavaScript - Fake mode
import { Publisher, setMode } from "nats-pubsub";

beforeEach(() => {
  setMode("fake"); // No NATS connection required
});

afterEach(() => {
  setMode("normal");
});

test("publishes order", async () => {
  await publisher.publish("order.created", orderData);
  // No actual NATS connection
});
```

```ruby
# Ruby - Test mode
RSpec.configure do |config|
  config.before(:each) do
    NatsPubsub.enable_test_mode!
  end
end
```

### How do I test with the Inbox/Outbox pattern?

Use in-memory repositories:

```typescript
// JavaScript
import { InMemoryInboxRepository } from "nats-pubsub/testing";

const subscriber = new OrderSubscriber();
subscriber.inboxRepository = new InMemoryInboxRepository();

await subscriber.handle(message, metadata);
await subscriber.handle(message, metadata); // Should be deduplicated

expect(processOrder).toHaveBeenCalledTimes(1);
```

See [Testing Guide](../guides/testing.md) for more examples.

---

## Deployment

### How do I deploy NatsPubsub to production?

Key considerations:

1. **NATS Server**: Deploy HA NATS cluster (3+ nodes)
2. **Database**: Use managed database (RDS, Cloud SQL) for inbox/outbox
3. **Monitoring**: Set up metrics and alerting
4. **Security**: Enable TLS and authentication
5. **Configuration**: Use environment variables
6. **Scaling**: Run multiple subscriber instances

See [Deployment Guide](../guides/deployment.md) for detailed instructions.

### How do I run subscribers in production?

**Node.js:**

```bash
# Use process manager
pm2 start subscribers.js -i 4  # 4 instances

# Or Docker
docker run -d myapp:latest node subscribers.js
```

**Ruby/Rails:**

```bash
# Background job
bundle exec rake nats_pubsub:start

# Or with systemd
systemctl start myapp-subscribers

# Or Kubernetes
kubectl apply -f subscribers-deployment.yaml
```

### How do I handle deployments without downtime?

Use graceful shutdown:

```typescript
// JavaScript
const subscriber = new OrderSubscriber();

process.on("SIGTERM", async () => {
  console.log("Shutting down gracefully...");

  // Stop accepting new messages
  await subscriber.stop();

  // Wait for current messages to finish
  await subscriber.waitForIdle();

  // Close connections
  await subscriber.close();

  process.exit(0);
});
```

```ruby
# Ruby
Signal.trap('TERM') do
  NatsPubsub::Manager.shutdown_gracefully
end
```

### Should I run publishers and subscribers in the same process?

**Development**: Yes, it's fine for simplicity.

**Production**: It depends:

- **Together**: Simpler deployment, fewer processes
- **Separate**: Better resource isolation, independent scaling

Consider separate processes if:

- Subscribers are resource-intensive
- You need different scaling characteristics
- You want independent deployment cycles

### How do I scale subscribers?

**Horizontal Scaling** (recommended):

```bash
# Run multiple instances
docker run -d myapp:latest
docker run -d myapp:latest
docker run -d myapp:latest
```

NatsPubsub automatically load-balances across instances using JetStream consumer groups.

**Vertical Scaling**:

```typescript
// Increase concurrency per instance
class OrderSubscriber extends Subscriber {
  constructor() {
    super("order.created", {
      maxConcurrent: 20, // Increase from 10
    });
  }
}
```

See [Performance Guide](../guides/performance.md#scaling) for more details.

### How do I monitor NatsPubsub in production?

Use health checks and metrics:

```typescript
// JavaScript - Health endpoint
import express from "express";

const app = express();

app.get("/health", async (req, res) => {
  const health = {
    status: "ok",
    nats: await checkNatsConnection(),
    subscribers: await checkSubscribers(),
    metrics: publisher.getMetrics(),
  };

  res.json(health);
});

app.listen(3000);
```

Also monitor:

- Consumer lag (NATS CLI)
- Message throughput
- Error rates
- Outbox/inbox table sizes

See [Deployment Guide](../guides/deployment.md#monitoring) for details.

---

## Migration

### How do I migrate from raw NATS to NatsPubsub?

Gradual migration approach:

1. **Install NatsPubsub** alongside existing NATS code
2. **Migrate publishers** one at a time
3. **Migrate subscribers** one at a time
4. **Remove old code** once fully migrated

Both can coexist during migration:

```typescript
// Old raw NATS code
const nc = await connect({ servers: "nats://localhost:4222" });
nc.publish("order.created", JSON.stringify(data));

// New NatsPubsub code
await publisher.publish("order.created", data);
```

### How do I migrate from another message queue (Kafka, RabbitMQ)?

1. **Add NatsPubsub** as second messaging system
2. **Dual-write** to both systems temporarily
3. **Migrate consumers** to NatsPubsub
4. **Stop writing** to old system
5. **Remove old system**

```typescript
// Dual-write example
async function publishOrder(order) {
  // Old system
  await kafka.send({
    topic: "order-created",
    messages: [{ value: JSON.stringify(order) }],
  });

  // New system
  await publisher.publish("order.created", order);
}
```

### Can NatsPubsub coexist with other messaging systems?

Yes! NatsPubsub can run alongside:

- Kafka
- RabbitMQ
- Redis Pub/Sub
- AWS SQS/SNS
- Google Pub/Sub

Use them for different purposes or during migration.

### How do I migrate existing data to inbox/outbox tables?

The tables start empty. For existing messages:

1. **Don't migrate** old processed messages
2. **Start fresh** - inbox/outbox only track new messages
3. **Run migrations** to create tables:

```bash
# JavaScript
npm run db:migrate

# Ruby/Rails
rails db:migrate
```

Old messages won't be deduplicated retroactively, but that's usually fine.

---

## Troubleshooting

### Messages aren't being received. What should I check?

Follow this checklist:

1. **Verify NATS is running**: `nats server check`
2. **Check publisher config**: Same env/appName as subscriber?
3. **Verify stream exists**: `nats stream list`
4. **Check consumer**: `nats consumer list <stream>`
5. **Enable debug logging**: `debug: true, logLevel: 'debug'`
6. **Test with NATS CLI**: `nats subscribe "your.subject"`

See [Common Issues](./common-issues.md#message-delivery-issues) for detailed solutions.

### Why am I getting duplicate messages?

Possible causes:

1. **Inbox pattern not enabled**: Enable with `useInbox = true`
2. **Message redelivery**: Check `maxDeliver` and `ackWait` settings
3. **Multiple subscriber instances**: Expected with queue groups
4. **Handler errors**: Errors cause redelivery

See [Common Issues](./common-issues.md#duplicate-messages-received) for solutions.

### Performance is slow. How do I improve it?

Quick wins:

1. **Enable batch publishing**: Use `BatchPublisher`
2. **Increase concurrency**: Set `maxConcurrent: 10`
3. **Optimize handler code**: Profile and optimize
4. **Use connection pooling**: For database operations
5. **Increase prefetch**: Set `prefetch: 20`

See [Performance Guide](../guides/performance.md) for comprehensive optimization.

### How do I enable debug logging?

```typescript
// JavaScript
const publisher = new Publisher({
  servers: "nats://localhost:4222",
  debug: true,
  logLevel: "debug",
});
```

```ruby
# Ruby
NatsPubsub.configure do |config|
  config.log_level = :debug
end
```

See [Debugging Guide](./debugging.md) for advanced techniques.

### Where can I get help?

1. **Documentation**: Check [docs](../index.md)
2. **Troubleshooting**: See [Common Issues](./common-issues.md)
3. **Debugging**: Follow [Debugging Guide](./debugging.md)
4. **GitHub Issues**: [Report bugs](https://github.com/anthropics/nats-pubsub/issues)
5. **Discussions**: [Ask questions](https://github.com/anthropics/nats-pubsub/discussions)
6. **NATS Community**: [NATS Slack](https://natsio.slack.com)

---

## Advanced Topics

### Can I use custom serialization?

Yes! Implement custom serialization:

```typescript
// JavaScript - Custom serialization
class ProtobufPublisher extends Publisher {
  protected serialize(data: any): Uint8Array {
    return MyProto.encode(data).finish();
  }
}

class ProtobufSubscriber extends Subscriber {
  protected deserialize(data: Uint8Array): any {
    return MyProto.decode(data);
  }
}
```

### How do I implement custom middleware?

```typescript
// JavaScript - Custom middleware
const timingMiddleware = async (message, metadata, next) => {
  const start = Date.now();

  try {
    await next();
  } finally {
    const duration = Date.now() - start;
    console.log(`Processing took ${duration}ms`);
  }
};

class OrderSubscriber extends Subscriber {
  constructor() {
    super("order.created");
    this.use(timingMiddleware);
  }
}
```

See [Middleware Guide](../guides/middleware.md) for more examples.

### Can I use NatsPubsub with GraphQL subscriptions?

Yes! Use NatsPubsub as the pub/sub engine:

```typescript
// JavaScript - GraphQL integration
import { Publisher, Subscriber } from "nats-pubsub";
import { PubSub } from "graphql-subscriptions";

class NatsPubSub extends PubSub {
  constructor() {
    super();
    this.publisher = new Publisher(config);
  }

  async publish(topic: string, payload: any) {
    await this.publisher.publish(topic, payload);
  }

  async subscribe(topic: string, onMessage: Function) {
    const subscriber = new Subscriber(topic);
    subscriber.handle = (message) => onMessage(message);
    await subscriber.connect(config);
    return () => subscriber.close();
  }
}

const pubsub = new NatsPubSub();
```

### How do I implement saga patterns?

Use subscribers to orchestrate sagas:

```typescript
// JavaScript - Saga orchestrator
class OrderSagaOrchestrator extends Subscriber {
  constructor() {
    super("order.created");
  }

  async handle(message, metadata) {
    const { orderId } = message;

    try {
      // Step 1: Reserve inventory
      await publisher.publish("inventory.reserve", {
        orderId,
        items: message.items,
      });

      // Step 2: Charge payment
      await publisher.publish("payment.charge", {
        orderId,
        amount: message.amount,
      });

      // Step 3: Ship order
      await publisher.publish("shipping.create", {
        orderId,
        address: message.shippingAddress,
      });

      // Saga completed
      await publisher.publish("order.completed", { orderId });
    } catch (error) {
      // Compensating transactions
      await publisher.publish("order.failed", { orderId });
      await this.compensate(orderId);
    }
  }

  private async compensate(orderId: string) {
    await publisher.publish("inventory.release", { orderId });
    await publisher.publish("payment.refund", { orderId });
  }
}
```

### Can I use NatsPubsub for request/reply patterns?

Yes! Use request/reply:

```typescript
// JavaScript - Request/reply
import { Publisher } from "nats-pubsub";

const publisher = new Publisher(config);

// Request
const response = await publisher.request(
  "order.get",
  { orderId: "123" },
  { timeout: 5000 },
);

console.log("Response:", response);

// Reply
class OrderGetSubscriber extends Subscriber {
  constructor() {
    super("order.get");
  }

  async handle(message, metadata) {
    const order = await fetchOrder(message.orderId);

    // Send reply
    await metadata.reply(order);
  }
}
```

### How do I implement event sourcing?

Use NatsPubsub with JetStream persistence:

```typescript
// JavaScript - Event sourcing
class OrderEventStore {
  constructor(private publisher: Publisher) {}

  async appendEvent(aggregateId: string, event: any) {
    await this.publisher.publish(`order.events.${aggregateId}`, {
      aggregateId,
      eventType: event.type,
      eventData: event.data,
      timestamp: Date.now(),
      version: event.version,
    });
  }

  async getEvents(aggregateId: string): Promise<any[]> {
    // Fetch from JetStream stream
    const events = await this.fetchEventsFromStream(aggregateId);
    return events;
  }

  async rebuild(aggregateId: string): Promise<Order> {
    const events = await this.getEvents(aggregateId);
    return events.reduce((order, event) => {
      return order.apply(event);
    }, new Order());
  }
}
```

See [Event Sourcing Guide](../patterns/event-sourcing.md) for details.

### How do I implement CQRS?

Separate command and query handlers:

```typescript
// JavaScript - CQRS
// Command side
class CreateOrderCommand extends Subscriber {
  constructor() {
    super("order.command.create");
  }

  async handle(command, metadata) {
    // Validate and create order
    const order = await orderService.create(command);

    // Publish event
    await publisher.publish("order.created", order);
  }
}

// Query side (projection)
class OrderProjection extends Subscriber {
  constructor() {
    super("order.created");
  }

  async handle(event, metadata) {
    // Update read model
    await readModel.upsert({
      id: event.orderId,
      status: "created",
      amount: event.amount,
      createdAt: new Date(),
    });
  }
}

// Query API
async function getOrder(orderId: string) {
  return await readModel.findById(orderId);
}
```

---

## Still Have Questions?

If your question isn't answered here:

1. Check the [full documentation](../index.md)
2. Search [GitHub Issues](https://github.com/anthropics/nats-pubsub/issues)
3. Ask in [GitHub Discussions](https://github.com/anthropics/nats-pubsub/discussions)
4. Join the [NATS Slack community](https://natsio.slack.com)

---

## Related Documentation

- [Common Issues](./common-issues.md) - Solutions to frequent problems
- [Debugging Guide](./debugging.md) - Step-by-step debugging procedures
- [Getting Started](../getting-started/introduction.md) - Introduction and setup
- [Configuration Reference](../reference/configuration.md) - All configuration options
- [Performance Guide](../guides/performance.md) - Optimization strategies

---

**Last Updated**: November 2025 | **Version**: 1.0.0
