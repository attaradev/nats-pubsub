---
slug: introducing-natspubsub-1.0
title: Introducing NatsPubsub 1.0
authors: [mike]
tags: [announcement, release]
hide_table_of_contents: false
---

# Introducing NatsPubsub 1.0

We're excited to announce the release of **NatsPubsub 1.0**, a production-ready pub/sub messaging library for NATS JetStream!

<!--truncate-->

## What is NatsPubsub?

NatsPubsub is a declarative pub/sub library that makes working with NATS JetStream effortless. Available in both **JavaScript/TypeScript** and **Ruby**, it brings battle-tested reliability patterns to your event-driven architecture.

## Key Features

### 🎯 Declarative API

Write clean, maintainable message handlers with a familiar, class-based API:

```typescript
import { Subscriber, TopicMetadata } from "nats-pubsub";

class OrderCreatedSubscriber extends Subscriber<
  Record<string, unknown>,
  TopicMetadata
> {
  constructor() {
    super("production.myapp.order.created");
  }

  async handle(
    message: Record<string, unknown>,
    metadata: TopicMetadata,
  ): Promise<void> {
    await processOrder(message);
  }
}
```

### 🔒 Built-in Reliability

- **Inbox/Outbox Pattern**: Guaranteed message delivery with transactional guarantees
- **Dead Letter Queue**: Automatic handling of failed messages
- **Automatic Retries**: Exponential backoff with configurable retry strategies

### 🌐 Cross-Language Support

JavaScript and Ruby implementations use identical event formats, enabling seamless communication between polyglot microservices.

### ⚡ Production Ready

- Comprehensive monitoring with Prometheus metrics
- Health check endpoints
- Structured logging
- 95%+ test coverage

## Getting Started

### JavaScript/TypeScript

```bash
npm install nats-pubsub
```

```typescript
import NatsPubsub from "nats-pubsub";

NatsPubsub.configure({
  natsUrls: "nats://localhost:4222",
  env: "production",
  appName: "my-app",
});

await NatsPubsub.publish("order.created", {
  orderId: "123",
  amount: 99.99,
});
```

### Ruby

```bash
gem install nats_pubsub
```

```ruby
require 'nats_pubsub'

NatsPubsub.configure do |config|
  config.nats_urls = 'nats://localhost:4222'
  config.env = 'production'
  config.app_name = 'my-app'
end

NatsPubsub.publish(
  topic: 'order.created',
  message: {
    order_id: '123',
    amount: 99.99
  }
)
```

## Why NatsPubsub?

### vs. Raw NATS Client

- ✅ Declarative subscriber API (vs. imperative callbacks)
- ✅ Built-in reliability patterns (vs. manual implementation)
- ✅ Comprehensive testing utilities
- ✅ Auto-topology management
- ✅ Framework integrations (Rails, Express, NestJS)

### vs. Kafka

- ✅ Simpler operations (no ZooKeeper)
- ✅ Lower latency (&lt;1ms vs. 5-50ms)
- ✅ Smaller resource footprint
- ✅ Built-in request/reply pattern

### vs. RabbitMQ

- ✅ Higher performance (2-10x throughput)
- ✅ Simpler configuration
- ✅ Better cloud-native support
- ✅ Built-in message persistence

## What's Next?

We're committed to making NatsPubsub the best pub/sub library for NATS JetStream. Upcoming features include:

- Enhanced observability with OpenTelemetry integration
- GraphQL subscriptions support
- Additional language implementations (Python, Go)
- Cloud deployment templates (AWS, GCP, Azure)

## Get Involved

- **GitHub**: [github.com/attaradev/nats-pubsub](https://github.com/attaradev/nats-pubsub)
- **Documentation**: [Full documentation](/docs/intro)
- **JavaScript Examples**: [Working examples](https://github.com/attaradev/nats-pubsub/tree/main/packages/javascript/examples)
- **Ruby Examples**: [Working examples](https://github.com/attaradev/nats-pubsub/tree/main/packages/ruby/examples)
- **Discussions**: [GitHub Discussions](https://github.com/attaradev/nats-pubsub/discussions)

## Acknowledgments

Special thanks to the NATS community and all early adopters who provided feedback during the beta phase. Your input was invaluable in shaping this release.

---

Ready to get started? Check out our [documentation](/docs/intro) and start building event-driven applications today!
