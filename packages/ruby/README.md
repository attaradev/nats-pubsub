# NatsPubsub (Ruby)

**Declarative PubSub messaging for NATS JetStream**

A production-ready pub/sub library with Rails integration, declarative subscribers, middleware support, Web UI for monitoring, and battle-tested reliability patterns including Inbox/Outbox, DLQ, and automatic retries with backoff.

This is the Ruby implementation of NatsPubsub. For the Node.js version, see [../javascript](../javascript).

---

## ✨ Features

* 🎯 **Declarative API** - Familiar pattern for defining subscribers
* 🔌 **Simple Publishing** - `NatsPubsub.publish(domain, resource, action, payload)`
* 🛡 **Outbox** (reliable send) & **Inbox** (idempotent receive), opt-in
* 🧨 **DLQ** for poison messages
* ⚙️ Durable `pull_subscribe` with backoff & `max_deliver`
* 📊 **Web UI** - Monitor Inbox/Outbox events, retry failures, view details
* 🧪 **Testing helpers** - Fake mode, inline mode, and RSpec matchers
* 🔗 **ActiveRecord integration** - Auto-publish model events
* 🎭 **Middleware system** - Extensible processing pipeline
* 🚀 **CLI executable** - Run subscribers with concurrency control
* 🧱 **Overlap-safe stream provisioning** - Prevents "subjects overlap" errors
* ⚡️ **Eager-loaded models** via Railtie (production)
* 📊 Configurable logging with sensible defaults

---

## 📦 Install

```ruby
# Gemfile
gem "nats_pubsub", "~> 0.1"
```

```bash
bundle install
```

For full documentation, see the [main README](../../README.md).

---

## 📄 License

[MIT License](../../LICENSE)
