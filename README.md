<p align="center">
  <img src="./website/static/img/logo.svg" alt="NatsPubsub Logo" width="200" height="200">
</p>

<h1 align="center">NatsPubsub</h1>

<p align="center">
  <strong>Declarative Pub/Sub messaging for NATS JetStream</strong>
</p>

<p align="center">
  A production-ready pub/sub library with a familiar, declarative API. Features declarative subscribers, middleware support, and battle-tested reliability patterns including Inbox/Outbox, DLQ, and automatic retries with backoff.
</p>

<p align="center">
  <a href="https://github.com/attaradev/nats-pubsub/actions/workflows/ruby.yml"><img src="https://github.com/attaradev/nats-pubsub/actions/workflows/ruby.yml/badge.svg" alt="Ruby CI"></a>
  <a href="https://github.com/attaradev/nats-pubsub/actions/workflows/javascript.yml"><img src="https://github.com/attaradev/nats-pubsub/actions/workflows/javascript.yml/badge.svg" alt="JavaScript CI"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
  <a href="https://rubygems.org/gems/nats_pubsub"><img src="https://img.shields.io/gem/v/nats_pubsub.svg" alt="Gem Version"></a>
  <a href="https://www.npmjs.com/package/nats-pubsub"><img src="https://img.shields.io/npm/v/nats-pubsub.svg" alt="npm Version"></a>
  <a href="https://rubygems.org/gems/nats_pubsub"><img src="https://img.shields.io/gem/dt/nats_pubsub.svg" alt="Gem Downloads"></a>
  <a href="https://www.npmjs.com/package/nats-pubsub"><img src="https://img.shields.io/npm/dt/nats-pubsub.svg" alt="npm Downloads"></a>
</p>

**Implementations for [![Ruby](https://img.shields.io/badge/Ruby-CC342D?logo=ruby&logoColor=white)](./packages/ruby) and [![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](./packages/javascript) with full interoperability**

---

## 📋 Table of Contents

- [Documentation](#-documentation)
- [Quick Start](#-quick-start)
- [Packages](#-packages)
- [Features](#-features)
- [Real-World Examples](#-real-world-examples)
- [Performance](#-performance)
- [Development](#️-development)
- [Contributing](#-contributing)
- [License](#-license)

---

## 📖 Documentation

**📚 [View Full Documentation Site →](https://attaradev.github.io/nats-pubsub/)**

**Comprehensive documentation is available in the [docs/](./docs/) directory:**

### Getting Started

- **[Introduction](./docs/getting-started/introduction.md)** - What is NatsPubsub and why use it
- **[Installation](./docs/getting-started/installation.md)** - Setup for JavaScript and Ruby
- **[JavaScript Quick Start](./docs/getting-started/quick-start-js.md)** - Get running in 5 minutes
- **[Ruby Quick Start](./docs/getting-started/quick-start-ruby.md)** - Get running in 5 minutes
- **[Core Concepts](./docs/getting-started/concepts.md)** - Topics, subscribers, reliability patterns

### Guides

- **[Publishing Messages](./docs/guides/publishing.md)** - Complete publishing guide
- **[Creating Subscribers](./docs/guides/subscribing.md)** - Subscriber patterns and best practices
- **[Middleware System](./docs/guides/middleware.md)** - Add cross-cutting concerns
- **[Testing Strategies](./docs/guides/testing.md)** - Unit, integration, and E2E testing
- **[Deployment Guide](./docs/guides/deployment.md)** - Docker, Kubernetes, production setup
- **[Performance Tuning](./docs/guides/performance.md)** - Optimization strategies

### Patterns

- **[Inbox/Outbox Pattern](./docs/patterns/inbox-outbox.md)** - Guaranteed delivery and exactly-once processing
- **[Dead Letter Queue](./docs/patterns/dlq.md)** - Handle failed messages
- **[Schema Validation](./docs/patterns/schema-validation.md)** - Validate messages with Zod
- **[Event Sourcing](./docs/patterns/event-sourcing.md)** - Build event-sourced systems

### Integrations

- **[Ruby on Rails](./docs/integrations/rails.md)** - Rails integration guide
- **[Express.js](./docs/integrations/express.md)** - Express integration
- **[NestJS](./docs/integrations/nestjs.md)** - NestJS integration
- **[Databases](./docs/integrations/databases.md)** - PostgreSQL, MySQL, SQLite

### Reference

- **[JavaScript API](./docs/reference/javascript-api.md)** - Complete TypeScript/JavaScript API
- **[Ruby API](./docs/reference/ruby-api.md)** - Complete Ruby API
- **[Configuration](./docs/reference/configuration.md)** - All configuration options
- **[CLI Reference](./docs/reference/cli.md)** - Command-line tools

### Advanced

- **[Architecture](./docs/advanced/architecture.md)** - System design and components
- **[Internals](./docs/advanced/internals.md)** - How NatsPubsub works
- **[Custom Repositories](./docs/advanced/custom-repositories.md)** - Implement custom storage
- **[Security](./docs/advanced/security.md)** - Security best practices

### Architecture Plans

- **[v2 Architecture Plan](./v2-plan/)** - Multi-stream, multi-application architecture proposal
  - Multi-stream consumption pattern
  - Independent subscriber acknowledgment
  - Stream ownership and isolation
  - Many-to-many messaging patterns

### Troubleshooting

- **[Common Issues](./docs/troubleshooting/common-issues.md)** - Solutions to frequent problems
- **[Debugging Guide](./docs/troubleshooting/debugging.md)** - Debug message flow
- **[FAQ](./docs/troubleshooting/faq.md)** - Frequently asked questions

### Examples

- **[Example Projects](./examples/)** - Complete working examples
- **[Microservices Example](./examples/microservices/)** - Multi-service architecture
- **[JavaScript Examples](./examples/javascript/)** - TypeScript/JavaScript examples
- **[Ruby Examples](./examples/ruby/)** - Ruby examples

**[📚 Start with the Documentation Index →](./docs/index.md)**

---

## 🚀 Quick Start

Start the full development environment with Docker Compose:

```bash
git clone https://github.com/attaradev/nats_pubsub.git
cd nats-pubsub
docker compose up -d
```

This starts NATS, PostgreSQL, Prometheus, and Grafana with preconfigured monitoring.

**For package-specific setup:**

- **[Ruby Setup →](./packages/ruby/README.md#quick-start)**
- **[JavaScript Setup →](./packages/javascript/README.md#quick-start)**

---

## 📦 Packages

### ![Ruby](https://img.shields.io/badge/Ruby-CC342D?logo=ruby&logoColor=white) [Ruby Package](./packages/ruby)

Rails-integrated Pub/Sub library with Web UI, Inbox/Outbox, and ActiveRecord support.

```ruby
gem "nats_pubsub", "~> 0.1"
```

**[📖 Full Ruby Docs →](./packages/ruby/README.md)**

---

### ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white) [JavaScript/TypeScript Package](./packages/javascript)

Node.js Pub/Sub library with full TypeScript support and enterprise monitoring.

```bash
pnpm add nats-pubsub
```

**[📖 Full JavaScript Docs →](./packages/javascript/README.md)**

---

## ✨ Features

### Core Capabilities

- 🎯 **Topic-Based Messaging** - Flexible pub/sub with hierarchical topics (e.g., `order.created`, `notification.email`)
- 🔌 **Declarative Subscriber API** - Clean, decorator-based subscription patterns
- 🌲 **Hierarchical Topics** - Organize messages with dot notation and wildcard subscriptions (`*` for single level, `>` for multiple levels)
- 🧨 **Dead Letter Queue (DLQ)** - Automatic handling of failed messages
- ⚙️ **Durable Pull Consumers** - Reliable message delivery with exponential backoff
- 🎭 **Middleware System** - Extensible processing pipeline for cross-cutting concerns
- 🔄 **Auto-Topology Management** - Automatic JetStream stream and consumer creation

### Ruby-Specific

- 🛡️ Inbox/Outbox reliability patterns
- 📊 Web UI for monitoring
- 🔗 ActiveRecord integration
- 🚂 Rails generators

### JavaScript-Specific

- 📊 Prometheus metrics
- ❤️ Health check endpoints
- 📦 Batch publishing API
- 🚀 Full TypeScript support

### Cross-Language

Both implementations use identical event formats, enabling seamless interoperability between Ruby and JavaScript services.

**📖 Learn More:**

- [Ruby Package Docs](./packages/ruby/README.md) - Full Ruby documentation with Rails integration
- [JavaScript Package Docs](./packages/javascript/README.md) - Full TypeScript/JavaScript documentation
- [Performance Benchmarks](./PERFORMANCE_BENCHMARKS.md) - Throughput and latency metrics
- [Contributing Guide](./CONTRIBUTING.md) - How to contribute to the project

---

## 📚 Real-World Examples

### E-Commerce Order Processing

**Scenario**: Process orders across multiple services (inventory, shipping, notifications)

**Ruby Publisher (Order Service)**:

```ruby
# app/services/order_service.rb
class OrderService
  def create_order(user_id, items)
    Order.transaction do
      order = Order.create!(user_id: user_id, status: 'pending')

      # Publish order created event
      NatsPubsub.publish(
        topic: 'order.created',
        message: {
          order_id: order.id,
          user_id: user_id,
          item: items,
          total: calculate_total(items)
        }
      )
    end
  end
end
```

**JavaScript Subscriber (Inventory Service)**:

```typescript
// subscribers/inventory-subscriber.ts
import { Subscriber, TopicMetadata } from "nats-pubsub";

class InventorySubscriber extends Subscriber {
  constructor() {
    super("production.order-service.order.created");
  }

  async handle(message: Record<string, unknown>, metadata: TopicMetadata) {
    const { order_id, item } = message;

    // Reserve inventory
    await this.reserveInventory(item as Array<any>);

    // Publish inventory reserved event
    await NatsPubsub.publish("inventory.reserved", {
      order_id,
      reserved_at: new Date(),
    });
  }

  private async reserveInventory(item: any[]) {
    // Inventory reservation logic
  }
}
```

### User Notification System

**Scenario**: Send welcome emails, SMS, and push notifications when users sign up

**JavaScript Publisher (Auth Service)**:

```typescript
// services/auth.service.ts
async function createUser(userData: UserData) {
  const user = await User.create(userData);

  // Publish to multiple notification topics
  await NatsPubsub.publish({
    topics: ["notification.email", "notification.sms", "audit.user-created"],
    message: {
      user_id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
    },
  });

  return user;
}
```

**Ruby Subscribers (Notification Service)**:

```ruby
# app/subscribers/email_notification_subscriber.rb
class EmailNotificationSubscriber < NatsPubsub::Subscriber
  subscribe_to "notification.email"

  def handle(message, context)
    WelcomeMailer.welcome_email(
      email: message['email'],
      name: message['name']
    ).deliver_later
  end
end

# app/subscribers/sms_notification_subscriber.rb
class SmsNotificationSubscriber < NatsPubsub::Subscriber
  subscribe_to "notification.sms"

  def handle(message, context)
    TwilioService.send_welcome_sms(
      phone: message['phone'],
      name: message['name']
    )
  end
end
```

### Microservices Communication

**Scenario**: Payment service notifies order and analytics services

```typescript
// Payment Service (Publisher)
await NatsPubsub.publish("payment.completed", {
  payment_id: payment.id,
  order_id: payment.order_id,
  amount: payment.amount,
  currency: "USD",
});

// Order Service (Subscriber)
class PaymentCompletedSubscriber extends Subscriber {
  constructor() {
    super("production.payment-service.payment.completed");
  }

  async handle(message: Record<string, unknown>) {
    await Order.update(message.order_id, { status: "paid" });
  }
}

// Analytics Service (Subscriber with wildcard)
class PaymentAnalyticsSubscriber extends Subscriber {
  constructor() {
    super("production.payment-service.payment.*"); // Wildcard subscription
  }

  async handle(message: Record<string, unknown>, metadata: TopicMetadata) {
    await Analytics.track({
      event: metadata.topic,
      properties: message,
    });
  }
}
```

### Audit Logging

**Scenario**: Centralized audit log for all system events

```ruby
# Any service publishing events
NatsPubsub.publish(
  topic: 'user.login',
  message: { user_id: user.id, ip: request.ip },
  trace_id: request_id
)

# Audit Service (Subscriber) - Wildcard to capture all events
class AuditLogSubscriber < NatsPubsub::Subscriber
  subscribe_to "production.*.>" # Subscribe to ALL topics from all services

  def handle(message, context)
    AuditLog.create!(
      event_type: context.topic,
      user_id: message['user_id'],
      data: message,
      trace_id: context.trace_id,
      occurred_at: context.occurred_at
    )
  end
end
```

---

## 📊 Performance

### Benchmarks

NatsPubsub leverages NATS JetStream for high-performance messaging:

| Metric                   | Performance   | Configuration                 |
| ------------------------ | ------------- | ----------------------------- |
| **Latency (p50)**        | < 1ms         | Single server, local network  |
| **Latency (p99)**        | < 5ms         | Single server, local network  |
| **Throughput**           | 1M+ msg/sec   | Single NATS server, in-memory |
| **Throughput**           | 500K+ msg/sec | With JetStream persistence    |
| **Message Size**         | Up to 1MB     | Default, configurable         |
| **Concurrent Consumers** | 1000+         | Per stream                    |

### Real-World Performance

**Typical Microservices Setup:**

- Latency: 2-10ms (including network + processing)
- Throughput: 50K-200K msg/sec per service
- Concurrency: 10-50 concurrent message processors

**Factors Affecting Performance:**

- 🔸 Network latency between services
- 🔸 Message size and serialization
- 🔸 Subscriber processing time
- 🔸 Database operations in subscribers
- 🔸 JetStream storage type (memory vs file)

### Performance Tuning

#### 1. Optimize Concurrency

```typescript
// JavaScript
NatsPubsub.configure({
  concurrency: 20, // Adjust based on workload
});
```

```ruby
# Ruby
NatsPubsub.configure do |config|
  config.concurrency = 20
end
```

**Guidelines:**

- CPU-bound tasks: `concurrency = CPU cores`
- I/O-bound tasks: `concurrency = 2-4x CPU cores`
- Database-heavy: `concurrency ≤ DB pool size`

#### 2. Batch Processing

```typescript
class BatchProcessor extends BaseSubscriber {
  private batch: any[] = [];
  private batchSize = 100;
  private flushInterval = 1000; // 1 second

  async call(message: Record<string, unknown>) {
    this.batch.push(message);

    if (this.batch.length >= this.batchSize) {
      await this.flush();
    }
  }

  private async flush() {
    if (this.batch.length === 0) return;

    // Process batch
    await Database.bulkInsert(this.batch);
    this.batch = [];
  }
}
```

#### 3. Connection Pooling

```typescript
// Reuse database connections
const pool = new Pool({
  max: 20, // Match or exceed concurrency
  min: 5,
});
```

#### 4. Message Size Optimization

```typescript
// Keep messages small
await NatsPubsub.publish("user.created", {
  id: user.id, // ✅ Reference
  // user: fullUserObject  // ❌ Avoid embedding large objects
});
```

### Monitoring Performance

```typescript
// Add timing middleware
class PerformanceMiddleware {
  async call(event: any, metadata: any, next: () => Promise<void>) {
    const start = Date.now();

    await next();

    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`Slow processing: ${metadata.subject} took ${duration}ms`);
    }
  }
}

NatsPubsub.use(new PerformanceMiddleware());
```

### Scaling Guidelines

| Messages/Day | Setup                             | Estimated Cost |
| ------------ | --------------------------------- | -------------- |
| < 1M         | Single NATS server                | ~$50/month     |
| 1M - 10M     | Single NATS server + monitoring   | ~$100/month    |
| 10M - 100M   | NATS cluster (3 nodes)            | ~$300/month    |
| 100M - 1B    | NATS cluster (5 nodes) + replicas | ~$1000/month   |
| > 1B         | Contact for architecture review   | Varies         |

**Note:** Based on AWS/GCP pricing for comparable instances.

---

## 🛠️ Development

```bash
# Install dependencies (monorepo root)
pnpm install

# Or install per package
cd packages/ruby && bundle install
cd packages/javascript && pnpm install

# Run tests
cd packages/ruby && bundle exec rspec
cd packages/javascript && pnpm test

# Run with coverage
cd packages/javascript && pnpm test -- --coverage
cd packages/ruby && bundle exec rspec --format documentation

# Build all packages
pnpm build

# Lint all packages
pnpm lint

# Documentation website
pnpm start:website    # Start dev server
pnpm build:website    # Build for production
```

### Git Hooks

This repository uses **Husky** for Git hooks:

- **pre-commit** → runs lint-staged
- **commit-msg** → validates Conventional Commits
- **pre-push** → runs tests before pushing

Set up hooks after cloning:

```bash
pnpm install  # Automatically configures hooks
```

**More guides:**

- [Ruby Development →](./packages/ruby/README.md#development)
- [JavaScript Development →](./packages/javascript/README.md#development)
- [CI/CD Setup →](./docs/CI_CD_SETUP.md)

---

## 🤝 Contributing

We welcome contributions!

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

**Quick Steps:**

1. Fork the repo
2. Create a branch (`git checkout -b feat/awesome-feature`)
3. Add tests and implement changes
4. Commit using [Conventional Commits](https://www.conventionalcommits.org/)
5. Open a Pull Request

---

## 📄 License

[MIT License](LICENSE) - Copyright (c) 2025 Mike Attara
