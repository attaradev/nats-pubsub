# NatsPubsub ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)

[![npm version](https://img.shields.io/npm/v/nats-pubsub.svg)](https://www.npmjs.com/package/nats-pubsub)
[![npm downloads](https://img.shields.io/npm/dm/nats-pubsub.svg)](https://www.npmjs.com/package/nats-pubsub)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

**Declarative PubSub messaging for NATS JetStream**

A production-ready pub/sub library for Node.js/TypeScript with declarative subscribers, middleware support, and battle-tested reliability patterns including DLQ and automatic retries with backoff.

This is the Node.js/TypeScript implementation of NatsPubsub. For the Ruby version, see [../ruby](../ruby).

## 🚀 Quick Start (< 5 minutes)

```typescript
// 1. Install
// pnpm add nats-pubsub

// 2. Start NATS Server (in terminal)
// docker run -d -p 4222:4222 nats:latest -js

// 3. Configure and Publish
import NatsPubsub from 'nats-pubsub';

NatsPubsub.configure({
  natsUrls: 'nats://localhost:4222',
  appName: 'my-app',
  env: 'development',
});

await NatsPubsub.publish('notification.email', {
  to: 'user@example.com',
  subject: 'Welcome!',
});

// 4. Create a Subscriber
import { Subscriber, TopicMetadata } from 'nats-pubsub';

class EmailSubscriber extends Subscriber<Record<string, unknown>, TopicMetadata> {
  constructor() {
    super('development.my-app.notification.email');
  }

  async handle(message: Record<string, unknown>, metadata: TopicMetadata): Promise<void> {
    console.log('Sending email:', message);
    // Your logic here
  }
}

// 5. Start Processing
NatsPubsub.registerSubscriber(new EmailSubscriber());
await NatsPubsub.start();
```

That's it! You're now publishing and consuming messages with NATS JetStream.

## Table of Contents

- [Quick Start](#-quick-start---5-minutes)
- [Features](#-features)
- [Installation](#-install)
- [Prerequisites](#prerequisites)
- [Configuration](#-configure)
- [Environment Variables](#environment-variables)
- [Subject Pattern](#-subject-pattern)
- [Declarative Subscribers](#-declarative-subscribers)
- [Publishing Events](#-publish-events)
- [Running Subscribers](#-run-subscribers)
- [Middleware](#-middleware)
- [CLI Tool](#%EF%B8%8F-cli-tool)
- [Testing](#-testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [License](#-license)

---

## ✨ Features

- 🎯 **Topic-Based Messaging** - Simple, hierarchical topic pattern (e.g., `order.created`, `user.updated`)
- 🔌 **Declarative Subscribers** - Clean class-based subscription API with TypeScript support
- 🌲 **Wildcard Subscriptions** - Support for `*` (single level) and `>` (multi-level) wildcards
- 🧨 **Dead Letter Queue** - Automatic handling of failed messages after max retries
- ⚙️ **Durable Pull Consumers** - Reliable message delivery with exponential backoff
- 🎭 **Middleware System** - Extensible processing pipeline for cross-cutting concerns
- 🚀 **TypeScript First** - Full type safety, generics, and IntelliSense support
- 📦 **Batch Publishing** - Efficient multi-message publishing with fluent API
- 🧱 **Auto-Topology Management** - Automatic JetStream stream creation, prevents overlap errors
- 📊 **Structured Logging** - Configurable logging with sensible defaults
- ❤️ **Health Checks** - Built-in health check endpoints for Kubernetes/Docker

---

## 📦 Install

```bash
pnpm add nats-pubsub
# or
npm install nats-pubsub
# or
yarn add nats-pubsub
```

### Prerequisites

- Node.js 20+
- NATS Server with JetStream enabled
- pnpm 10+ (recommended) or npm/yarn

### Start NATS Server

```bash
# macOS
brew install nats-server
nats-server -js

# Linux
curl -L https://github.com/nats-io/nats-server/releases/download/v2.10.0/nats-server-v2.10.0-linux-amd64.zip -o nats-server.zip
unzip nats-server.zip
sudo mv nats-server-v2.10.0-linux-amd64/nats-server /usr/local/bin/
nats-server -js
```

---

## 🔧 Configure

```typescript
import NatsPubsub from 'nats-pubsub';

NatsPubsub.configure({
  natsUrls: process.env.NATS_URLS || 'nats://localhost:4222',
  env: process.env.NODE_ENV || 'development',
  appName: process.env.APP_NAME || 'app',

  // Consumer tuning
  concurrency: 10,
  maxDeliver: 5,
  ackWait: 30000, // 30 seconds in ms
  backoff: [1000, 5000, 15000, 30000, 60000], // in ms

  // Features
  useDlq: true,

  // Custom logger (optional)
  logger: customLogger,
});
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

**Required Variables:**

- `NATS_URLS` - NATS server URLs (comma-separated for clusters)
- `NODE_ENV` - Environment (development/production)
- `APP_NAME` - Application name for event producer identification

**Optional Variables:**

- `CONCURRENCY` - Number of concurrent message processors (default: 10)
- `MAX_DELIVER` - Maximum delivery attempts before DLQ (default: 5)
- `ACK_WAIT` - Acknowledgment timeout in milliseconds (default: 30000)
- `USE_DLQ` - Enable Dead Letter Queue (default: true)
- `LOG_LEVEL` - Logging level (default: info)

---

## 📡 Subject Pattern

NatsPubsub uses a **topic-based subject pattern**:

```md
{env}.{appName}.{topic}
```

**Components:**

- `env` - Environment (production, staging, development) for isolation
- `appName` - Your application/service name for multi-service communication
- `topic` - Hierarchical topic using dot notation (e.g., `order.created`, `user.updated`)

**Examples:**

- `production.myapp.order.created`
- `production.myapp.user.updated`
- `staging.payments-service.payment.completed`
- `development.shop.notification.email`

**Wildcard Support:**

- `*` - Matches exactly one token: `production.myapp.user.*` matches `user.created`, `user.updated`
- `>` - Matches one or more tokens: `production.myapp.order.>` matches all order-related topics

**DLQ Subject:**

Failed messages are automatically routed to:

```md
{env}.dlq
```

---

## 🎯 Declarative Subscribers

### Basic Subscriber

```typescript
import { Subscriber, TopicMetadata } from 'nats-pubsub';

class OrderCreatedSubscriber extends Subscriber {
  constructor() {
    super('production.myapp.order.created', {
      retry: 3,
      ackWait: 60000,
      maxDeliver: 5,
    });
  }

  async handle(message: Record<string, unknown>, metadata: TopicMetadata): Promise<void> {
    // metadata provides: event_id, trace_id, topic, occurred_at, deliveries
    console.log(`Processing order: ${message.order_id}`);

    // Your idempotent domain logic here
    await OrderProcessor.process(message);
  }
}

// Register the subscriber
const subscriber = new OrderCreatedSubscriber();
NatsPubsub.registerSubscriber(subscriber);
```

### Subscriber Options

All available options for subscribers:

```typescript
class MySubscriber extends Subscriber {
  constructor() {
    super('production.myapp.topic', {
      // Retry configuration
      retry: 3, // Number of retry attempts (simple)
      maxDeliver: 5, // Maximum delivery attempts before DLQ
      ackWait: 30000, // Ack timeout in milliseconds

      // Advanced retry strategy
      retryStrategy: {
        maxAttempts: 3,
        backoff: 'exponential', // 'exponential' | 'linear' | 'fixed'
        initialDelay: 1000, // Initial delay in ms
        maxDelay: 60000, // Max delay in ms
        multiplier: 2, // Backoff multiplier
      },

      // Circuit breaker (fault tolerance)
      circuitBreaker: {
        enabled: true,
        threshold: 5, // Failures before opening
        timeout: 60000, // Time before half-open
        halfOpenMaxCalls: 3, // Max calls in half-open state
      },

      // Dead letter queue
      deadLetter: {
        enabled: true,
        maxAttempts: 5,
        subject: 'custom.dlq', // Custom DLQ subject
      },
      // Or simply: deadLetter: true

      // Schema validation (Zod)
      schema: z.object({
        id: z.string(),
        name: z.string(),
      }),
    });
  }

  async handle(message: Record<string, unknown>, metadata: TopicMetadata): Promise<void> {
    // Process message
  }
}
```

### Wildcard Subscriptions

```typescript
import { Subscriber, TopicMetadata } from 'nats-pubsub';

// Subscribe to all user-related topics
class UserActivitySubscriber extends Subscriber {
  constructor() {
    super('production.myapp.user.*', {
      retry: 3,
      ackWait: 60000,
    });
  }

  async handle(message: Record<string, unknown>, metadata: TopicMetadata): Promise<void> {
    console.log(`User activity: ${metadata.topic}`);

    switch (metadata.topic) {
      case 'user.created':
        await this.handleUserCreated(message);
        break;
      case 'user.updated':
        await this.handleUserUpdated(message);
        break;
      case 'user.deleted':
        await this.handleUserDeleted(message);
        break;
    }
  }

  private async handleUserCreated(message: Record<string, unknown>): Promise<void> {
    // Implementation
  }

  private async handleUserUpdated(message: Record<string, unknown>): Promise<void> {
    // Implementation
  }

  private async handleUserDeleted(message: Record<string, unknown>): Promise<void> {
    // Implementation
  }
}
```

### With TypeScript Generics

```typescript
interface OrderCreatedMessage {
  order_id: string;
  customer_id: string;
  total: number;
  item: Array<{ product_id: string; quantity: number }>;
}

class OrderCreatedSubscriber extends Subscriber<OrderCreatedMessage> {
  constructor() {
    super('production.myapp.order.created');
  }

  async handle(message: OrderCreatedMessage, metadata: TopicMetadata): Promise<void> {
    // message is fully typed!
    console.log(`Order ${message.order_id} total: $${message.total}`);

    for (const item of message.item) {
      await this.reserveInventory(item.product_id, item.quantity);
    }
  }

  private async reserveInventory(productId: string, quantity: number): Promise<void> {
    // Implementation
  }
}
```

---

## 📤 Publish Events

### Basic Publishing

```typescript
import NatsPubsub from 'nats-pubsub';

// Publish to a single topic
await NatsPubsub.publish('order.created', {
  order_id: 'ORD-123',
  customer_id: 'CUST-456',
  total: 99.99,
  item: [{ product_id: 'PROD-1', quantity: 2 }],
});

// Alternative syntax
await NatsPubsub.publish({
  topic: 'order.created',
  message: {
    order_id: 'ORD-123',
    customer_id: 'CUST-456',
    total: 99.99,
  },
});
```

### Multi-Topic Publishing

```typescript
// Publish to multiple topics at once (fan-out)
await NatsPubsub.publish({
  topics: ['order.created', 'notification.email', 'audit.order'],
  message: {
    order_id: 'ORD-123',
    customer_id: 'CUST-456',
    total: 99.99,
  },
});
```

### With Options

```typescript
// Add metadata like trace_id, event_id, etc.
await NatsPubsub.publish(
  'order.created',
  {
    order_id: 'ORD-123',
    customer_id: 'CUST-456',
    total: 99.99,
  },
  {
    trace_id: 'trace-123',
    event_id: 'evt-456',
    occurred_at: new Date(),
    message_type: 'OrderCreated',
  }
);
```

### Batch Publishing

```typescript
// Efficient batch publishing with fluent API
const batch = NatsPubsub.batch();

await batch
  .add('order.created', { order_id: 'ORD-1', total: 10.0 })
  .add('order.created', { order_id: 'ORD-2', total: 20.0 })
  .add('order.created', { order_id: 'ORD-3', total: 30.0 })
  .publish();

console.log(`Published ${batch.count()} messages`);
```

---

## 🚀 Run Subscribers

```typescript
import NatsPubsub, { loggingMiddleware, retryLoggerMiddleware } from 'nats-pubsub';

// Configure
NatsPubsub.configure({
  /* ... */
});

// Add middleware
NatsPubsub.use(loggingMiddleware);
NatsPubsub.use(retryLoggerMiddleware);

// Register subscribers
const userSubscriber = new UserActivitySubscriber();
NatsPubsub.registerSubscriber(userSubscriber);

// Start consuming
await NatsPubsub.start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await NatsPubsub.stop();
  process.exit(0);
});
```

---

## 🎭 Middleware

Build a processing pipeline with middleware:

```typescript
import { Middleware, EventMetadata } from 'nats-pubsub';

class CustomMiddleware implements Middleware {
  async call(
    event: Record<string, unknown>,
    metadata: EventMetadata,
    next: () => Promise<void>
  ): Promise<void> {
    console.log('Before processing');
    await next();
    console.log('After processing');
  }
}

NatsPubsub.use(new CustomMiddleware());
```

---

## 📬 Envelope Format

```json
{
  "event_id": "01H1234567890ABCDEF",
  "schema_version": 1,
  "topic": "user.created",
  "message_type": "UserCreated",
  "producer": "myapp",
  "occurred_at": "2025-08-13T21:00:00Z",
  "trace_id": "abc123",
  "message": {
    "id": "01H1234567890ABCDEF",
    "name": "Ada Lovelace",
    "email": "ada@example.com"
  }
}
```

---

## 🧨 Dead-Letter Queue (DLQ)

When enabled, messages that exceed `maxDeliver` are moved to the DLQ subject:
**`{env}.{appName}.dlq`**

---

## 🛠️ CLI Tool

NatsPubsub includes a CLI tool for managing subscribers and streams.

### Start Subscribers

Start the consumer to process messages:

```bash
npx nats-pubsub start --env production --app my-app --url nats://localhost:4222
```

**Options:**

- `-e, --env <env>` - Environment (default: development)
- `-a, --app <name>` - Application name (default: app)
- `-u, --url <url>` - NATS server URL (default: nats://localhost:4222)
- `-c, --concurrency <number>` - Message concurrency (default: 10)

### Check Health

Verify NATS connection and JetStream availability:

```bash
npx nats-pubsub health --url nats://localhost:4222
```

Output:

```
✓ Connected to NATS
  Server: nats://localhost:4222
  Status: open
✓ JetStream available
  Streams: 3
  Consumers: 5
  Memory: 0 bytes
  Storage: 1024 bytes

Health check passed ✓
```

### Show Configuration & Stream Info

Display current configuration and stream information:

```bash
npx nats-pubsub info --env production --app my-app --url nats://localhost:4222
```

Output:

```
=== NatsPubsub Configuration ===
Environment: production
App Name: my-app
NATS URLs: nats://localhost:4222
Stream Name: production-events-stream
DLQ Subject: production.my-app.dlq
Concurrency: 10
Max Deliver: 5
Use DLQ: true

=== Stream Information ===
Stream: production-events-stream
Subjects: production.my-app.>
Messages: 1234
Bytes: 567890
First Seq: 1
Last Seq: 1234
Consumers: 3
```

### Purge Stream

Delete all messages from a stream:

```bash
# Purge main stream (requires --force)
npx nats-pubsub purge --env production --app my-app --force

# Purge DLQ stream
npx nats-pubsub purge --env production --app my-app --dlq --force
```

⚠️ **Warning**: This permanently deletes all messages!

### Delete Stream

Completely remove a stream:

```bash
# Delete main stream (requires --force)
npx nats-pubsub delete --env production --app my-app --force

# Delete DLQ stream
npx nats-pubsub delete --env production --app my-app --dlq --force
```

⚠️ **Warning**: This permanently deletes the stream and all its data!

---

## 🧪 Testing

```typescript
import NatsPubsub from 'nats-pubsub';

describe('UserSubscriber', () => {
  it('processes user events', async () => {
    const subscriber = new UserActivitySubscriber();
    const event = { id: '123', name: 'Alice' };
    const metadata = {
      event_id: 'test-id',
      subject: 'production.events.users.user.created',
      domain: 'users',
      resource: 'user',
      action: 'created',
    };

    await subscriber.call(event, metadata);
    // Add your assertions here
  });
});
```

---

## 🔗 Integration with Express

```typescript
import express from 'express';
import NatsPubsub from 'nats-pubsub';

const app = express();
app.use(express.json());

// POST /api/v1/users
app.post('/api/v1/users', async (req, res) => {
  try {
    const user = await createUser(req.body);

    // Publish event
    await NatsPubsub.publish('user.created', {
      id: user.id,
      name: user.name,
      email: user.email,
    });

    res.status(201).location(`/api/v1/users/${user.id}`).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/v1/users/:id
app.get('/api/v1/users/:id', async (req, res) => {
  try {
    const user = await findUser(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/v1/users/:id
app.patch('/api/v1/users/:id', async (req, res) => {
  try {
    const user = await updateUser(req.params.id, req.body);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await NatsPubsub.publish('user.updated', {
      id: user.id,
      changes: req.body,
    });

    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/v1/users/:id
app.delete('/api/v1/users/:id', async (req, res) => {
  try {
    const deleted = await deleteUser(req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: 'User not found' });
    }

    await NatsPubsub.publish('user.deleted', {
      id: req.params.id,
    });

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000);
```

---

## Deployment

### Production Checklist

- [ ] Use TLS for NATS connections (`nats://` → `tls://`)
- [ ] Enable authentication on NATS server
- [ ] Set appropriate `NODE_ENV=production`
- [ ] Configure proper logging levels
- [ ] Set up monitoring and alerting
- [ ] Use process manager (PM2, systemd)
- [ ] Configure graceful shutdown handling
- [ ] Set resource limits (memory, CPU)
- [ ] Enable health checks
- [ ] Review and tune `concurrency`, `maxDeliver`, `ackWait`

### Process Manager (PM2)

```bash
pnpm add -g pm2

# Start application
pm2 start dist/index.js --name nats-subscriber

# Configure for production
pm2 startup
pm2 save

# Monitor
pm2 monit
pm2 logs nats-subscriber
```

### Systemd Service

Create `/etc/systemd/system/nats-subscriber.service`:

```ini
[Unit]
Description=NATS PubSub Subscriber
After=network.target

[Service]
Type=simple
User=nodejs
WorkingDirectory=/app
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable nats-subscriber
sudo systemctl start nats-subscriber
sudo systemctl status nats-subscriber
```

### Environment-Specific Configuration

Use environment variables or configuration files per environment:

```typescript
// config/production.ts
export default {
  natsUrls: process.env.NATS_URLS,
  env: 'production',
  appName: 'my-app-prod',
  concurrency: 20,
  maxDeliver: 5,
  useDlq: true,
  logger: productionLogger,
};
```

---

## Troubleshooting

### Connection Issues

**Problem**: Cannot connect to NATS server

**Solutions**:

- Verify NATS server is running: `nats-server -js`
- Check `NATS_URLS` configuration
- Ensure JetStream is enabled on NATS server
- Check firewall rules and network connectivity
- Verify TLS certificates if using secure connections

### No Messages Received

**Problem**: Subscriber not receiving messages

**Solutions**:

- Verify environment matches between publisher and subscriber
- Check subject patterns match
- Ensure subscriber is registered before calling `start()`
- Check NATS server logs for errors
- Verify stream and consumer exist:

  ```bash
  nats stream ls
  nats stream info <stream-name>
  nats consumer ls <stream-name>
  ```

### Memory Leaks

**Problem**: Application memory usage grows over time

**Solutions**:

- Review custom middleware for resource cleanup
- Check for unhandled promise rejections
- Monitor event loop lag
- Use `--max-old-space-size` flag if needed
- Profile with Node.js profiling tools

### High CPU Usage

**Problem**: CPU usage is higher than expected

**Solutions**:

- Reduce `concurrency` setting
- Review subscriber logic for expensive operations
- Add caching where appropriate
- Consider scaling horizontally instead
- Profile with `node --inspect`

### Messages Going to DLQ

**Problem**: Too many messages ending up in Dead Letter Queue

**Solutions**:

- Review subscriber error logs
- Increase `ackWait` if processing takes longer
- Increase `maxDeliver` if appropriate
- Fix bugs in subscriber logic
- Add better error handling and logging
- Check for external service timeouts

### TypeScript Errors

**Problem**: TypeScript compilation errors

**Solutions**:

- Ensure TypeScript version compatibility
- Check `tsconfig.json` configuration
- Verify all type definitions are installed
- Run `pnpm add -D @types/node`

---

## Performance Tuning

### Concurrency

Adjust based on your workload:

```typescript
NatsPubsub.configure({
  concurrency: 20, // Higher for I/O-bound tasks
  // concurrency: 5, // Lower for CPU-bound tasks
});
```

### Batch Processing

For high-throughput scenarios, consider batching:

```typescript
class BatchProcessor extends Subscriber {
  private batch: any[] = [];
  private batchSize = 100;

  async call(event: Record<string, unknown>, metadata: EventMetadata): Promise<void> {
    this.batch.push(event);

    if (this.batch.length >= this.batchSize) {
      await this.processBatch(this.batch);
      this.batch = [];
    }
  }

  private async processBatch(events: any[]): Promise<void> {
    // Process multiple events at once
  }
}
```

---

## 📄 License

[MIT License](../../LICENSE)

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for contribution guidelines.

## Support

- GitHub Issues: [https://github.com/attaradev/nats_pubsub/issues](https://github.com/attaradev/nats_pubsub/issues)
- Email: <mpyebattara@gmail.com>
