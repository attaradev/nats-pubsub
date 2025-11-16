# NatsPubsub

<p align="center">
  <strong>Declarative Pub/Sub messaging for NATS JetStream</strong>
</p>

<p align="center">
  A production-ready pub/sub library with a familiar, declarative API. Features declarative subscribers, middleware support, and battle-tested reliability patterns including Inbox/Outbox, DLQ, and automatic retries with backoff.
</p>

<p align="center">
  <a href="https://github.com/attaradev/nats_pubsub/actions/workflows/ruby.yml"><img src="https://github.com/attaradev/nats_pubsub/actions/workflows/ruby.yml/badge.svg" alt="Ruby CI"></a>
  <a href="https://github.com/attaradev/nats_pubsub/actions/workflows/javascript.yml"><img src="https://github.com/attaradev/nats_pubsub/actions/workflows/javascript.yml/badge.svg" alt="JavaScript CI"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
  <a href="https://rubygems.org/gems/nats_pubsub"><img src="https://img.shields.io/gem/v/nats_pubsub.svg" alt="Gem Version"></a>
  <a href="https://www.npmjs.com/package/nats-pubsub"><img src="https://img.shields.io/npm/v/nats-pubsub.svg" alt="npm Version"></a>
  <a href="https://rubygems.org/gems/nats_pubsub"><img src="https://img.shields.io/gem/dt/nats_pubsub.svg" alt="Gem Downloads"></a>
  <a href="https://www.npmjs.com/package/nats-pubsub"><img src="https://img.shields.io/npm/dt/nats-pubsub.svg" alt="npm Downloads"></a>
</p>

<p align="center">
  <strong>Implementations for Ruby 💎 and JavaScript/TypeScript 🟦 with full interoperability</strong>
</p>

---

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Packages](#-packages)
- [Features](#-features)
- [Development](#️-development)
- [Contributing](#-contributing)
- [License](#-license)

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

### 💎 [Ruby Package](./packages/ruby)

Rails-integrated Pub/Sub library with Web UI, Inbox/Outbox, and ActiveRecord support.

```ruby
gem "nats_pubsub", "~> 0.1"
```

**[📖 Full Ruby Docs →](./packages/ruby/README.md)**

---

### 🟦 [JavaScript/TypeScript Package](./packages/javascript)

Node.js Pub/Sub library with full TypeScript support and enterprise monitoring.

```bash
pnpm add nats-pubsub
```

**[📖 Full JavaScript Docs →](./packages/javascript/README.md)**

---

## ✨ Features

### Core Capabilities

- 🎯 Declarative subscriber API
- 🧨 Dead Letter Queue (DLQ) support
- ⚙️ Durable pull consumers with exponential backoff
- 🎭 Middleware system for extensibility
- 🔄 Auto-topology management for JetStream

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

For detailed feature documentation, see each package’s README.

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
