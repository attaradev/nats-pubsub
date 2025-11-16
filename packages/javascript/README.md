# NatsPubsub (Node.js/TypeScript)

**Declarative PubSub messaging for NATS JetStream**

A production-ready pub/sub library for Node.js/TypeScript with declarative subscribers, middleware support, and battle-tested reliability patterns including DLQ and automatic retries with backoff.

This is the Node.js/TypeScript implementation of NatsPubsub. For the Ruby version, see [../ruby](../ruby).

## Table of Contents

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
- [Testing](#-testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [License](#-license)

---

## ✨ Features

- 🎯 **Declarative API** - Familiar pattern for defining subscribers
- 🔌 **Simple Publishing** - `NatsPubsub.publish(domain, resource, action, payload)`
- 🧨 **DLQ** for poison messages
- ⚙️ Durable `pull_subscribe` with backoff & `max_deliver`
- 🎭 **Middleware system** - Extensible processing pipeline
- 🚀 **TypeScript first** - Full type safety and IntelliSense support
- 🧱 **Overlap-safe stream provisioning** - Prevents "subjects overlap" errors
- 📊 Configurable logging with sensible defaults

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

- Node.js 24+
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

NatsPubsub uses a PubSub event pattern:

```md
{env}.events.{domain}.{resource}.{action}
```

**Examples:**

- `production.events.users.user.created`
- `production.events.orders.order.placed`
- `staging.events.payments.payment.completed`

---

## 🎯 Declarative Subscribers

### Using Class-based Approach

```typescript
import { BaseSubscriber, EventMetadata } from 'nats-pubsub';

class UserActivitySubscriber extends BaseSubscriber {
  constructor() {
    super('production.events.users.user.*', {
      retry: 3,
      ackWait: 60000,
    });
  }

  async call(event: Record<string, unknown>, metadata: EventMetadata): Promise<void> {
    console.log(`User ${metadata.action}: ${event.name}`);
    // Your idempotent domain logic here
  }
}

// Register the subscriber
const subscriber = new UserActivitySubscriber();
NatsPubsub.registerSubscriber(subscriber);
```

### Using Decorator (experimental)

```typescript
import { subscriber, EventMetadata } from 'nats-pubsub';

@subscriber('production.events.users.user.*', { retry: 3 })
class UserActivitySubscriber {
  async call(event: Record<string, unknown>, metadata: EventMetadata): Promise<void> {
    console.log(`User ${metadata.action}: ${event.name}`);
  }
}
```

### Multiple Subjects

```typescript
class EmailNotificationSubscriber extends BaseSubscriber {
  constructor() {
    super([
      'production.events.users.user.created',
      'production.events.orders.order.placed'
    ]);
  }

  async call(event: Record<string, unknown>, metadata: EventMetadata): Promise<void> {
    if (metadata.subject.includes('users.user.created')) {
      await this.sendWelcomeEmail(event);
    } else if (metadata.subject.includes('orders.order.placed')) {
      await this.sendOrderConfirmation(event);
    }
  }

  private async sendWelcomeEmail(event: Record<string, unknown>): Promise<void> {
    // Implementation
  }

  private async sendOrderConfirmation(event: Record<string, unknown>): Promise<void> {
    // Implementation
  }
}
```

---

## 📤 Publish Events

### Simple API

```typescript
import NatsPubsub from 'nats-pubsub';

await NatsPubsub.publish('users', 'user', 'created', {
  id: user.id,
  name: user.name,
  email: user.email,
});
```

### With Options

```typescript
await NatsPubsub.publish(
  'users',
  'user',
  'created',
  { id: user.id, name: user.name },
  {
    event_id: 'uuid-or-ulid',
    trace_id: 'hex',
    occurred_at: new Date(),
  }
);
```

---

## 🚀 Run Subscribers

```typescript
import NatsPubsub, { loggingMiddleware, retryLoggerMiddleware } from 'nats-pubsub';

// Configure
NatsPubsub.configure({ /* ... */ });

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
  "event_type": "created",
  "producer": "myapp",
  "resource_type": "user",
  "resource_id": "01H1234567890ABCDEF",
  "occurred_at": "2025-08-13T21:00:00Z",
  "trace_id": "abc123",
  "payload": { "id": "01H...", "name": "Ada" }
}
```

---

## 🧨 Dead-Letter Queue (DLQ)

When enabled, messages that exceed `maxDeliver` are moved to the DLQ subject:
**`{env}.events.dlq`**

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

app.post('/users', async (req, res) => {
  const user = await createUser(req.body);

  // Publish event
  await NatsPubsub.publish('users', 'user', 'created', {
    id: user.id,
    name: user.name,
    email: user.email,
  });

  res.json(user);
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
class BatchProcessor extends BaseSubscriber {
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
