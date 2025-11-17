---
sidebar_position: 1
---

# Welcome to NatsPubsub

**NatsPubsub** is a production-ready pub/sub library for NATS JetStream with implementations in both **TypeScript** and **Ruby**.

## 🚀 Quick Links

- [JavaScript/TypeScript Package](https://www.npmjs.com/package/nats-pubsub)
- [Ruby Package](https://rubygems.org/gems/nats_pubsub)
- [GitHub Repository](https://github.com/attaradev/nats-pubsub)

## ✨ Key Features

- 🎯 **Topic-Based Messaging** - Simple, hierarchical topic pattern
- 🔌 **Declarative Subscribers** - Clean DSL for defining subscribers
- 🌲 **Wildcard Subscriptions** - Support for `*` and `>` wildcards
- 🛡️ **Inbox/Outbox Patterns** - Transactional guarantees
- 🧨 **Dead Letter Queue** - Automatic handling of failed messages
- ⚙️ **Durable Pull Consumers** - Reliable message delivery
- 🎭 **Middleware System** - Extensible processing pipeline
- 🚀 **TypeScript First** - Full type safety (JavaScript package)
- 🔗 **Rails Integration** - Deep ActiveRecord integration (Ruby package)

## 📦 Choose Your Package

### JavaScript/TypeScript

Perfect for Node.js microservices, perfect for modern JavaScript/TypeScript applications.

```bash
npm install nats-pubsub
```

**Best For:**

- Modern JavaScript/TypeScript applications
- Framework-agnostic projects
- Type-safe development
- Microservices architecture

### Ruby

Perfect for Ruby on Rails applications with deep ActiveRecord integration.

```bash
gem install nats_pubsub
```

**Best For:**

- Rails applications
- Ruby microservices
- Teams needing Web UI
- Transactional guarantees with Inbox/Outbox

## 🌐 Cross-Language Compatibility

Both packages use identical event formats, enabling seamless communication across languages!

```
Ruby Service → NATS → JavaScript Service ✅
JavaScript Service → NATS → Ruby Service ✅
```

## 📖 Getting Started

For detailed documentation and examples:

- **JavaScript/TypeScript**: See the [package README](https://github.com/attaradev/nats-pubsub/tree/main/packages/javascript) and [examples](https://github.com/attaradev/nats-pubsub/tree/main/packages/javascript/examples)
- **Ruby**: See the [package README](https://github.com/attaradev/nats-pubsub/tree/main/packages/ruby) and [Rails Quick Start](https://github.com/attaradev/nats-pubsub/blob/main/packages/ruby/RAILS_QUICK_START.md)

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](https://github.com/attaradev/nats-pubsub/blob/main/CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see [LICENSE](https://github.com/attaradev/nats-pubsub/blob/main/LICENSE) for details.
