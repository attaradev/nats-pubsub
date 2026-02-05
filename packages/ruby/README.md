# NatsPubsub ![Ruby](https://img.shields.io/badge/Ruby-CC342D?logo=ruby&logoColor=white)

[![Gem Version](https://badge.fury.io/rb/nats_pubsub.svg)](https://badge.fury.io/rb/nats_pubsub)
[![Ruby](https://img.shields.io/badge/Ruby-3.2%2B-CC342D?logo=ruby&logoColor=white)](https://www.ruby-lang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Rails](https://img.shields.io/badge/Rails-6%2B-CC342D?logo=rubyonrails&logoColor=white)](https://rubyonrails.org/)

**Declarative PubSub messaging for NATS JetStream**

A production-ready pub/sub library for Ruby with Rails integration, declarative subscribers, middleware support, Web UI for monitoring, and battle-tested reliability patterns including Inbox/Outbox, DLQ, and automatic retries with backoff.

This is the Ruby implementation of NatsPubsub. For the Node.js/TypeScript version, see [../javascript](../javascript).

## 🚀 Quick Start (< 5 minutes)

```ruby
# 1. Install
# Add to Gemfile: gem "nats_pubsub", "~> 0.1"
# Run: bundle install

# 2. Start NATS Server (in terminal)
# docker run -d -p 4222:4222 nats:latest -js

# 3. Configure and Publish
# config/initializers/nats_pubsub.rb
NatsPubsub.configure do |config|
  config.nats_urls = "nats://localhost:4222"
  config.app_name = "my-app"
  config.env = "development"
end

# In your code
NatsPubsub.publish(
  topic: "user.created",
  message: { id: 123, name: "Alice" }
)

# 4. Create a Subscriber
# app/subscribers/user_subscriber.rb
class UserSubscriber < NatsPubsub::Subscriber
  subscribe_to "users.created"

  def handle(message, context)
    puts "New user: #{message['name']}"
    # Your logic here
  end
end

# 5. Start Processing
# bundle exec nats_pubsub
```

That's it! You're now publishing and consuming messages with NATS JetStream.

## Table of Contents

- [Quick Start](#-quick-start---5-minutes)
- [Features](#-features)
- [Install](#-install)
- [Configuration](#-configure)
- [Subject Pattern](#-subject-pattern)
- [Declarative Subscribers](#-declarative-subscribers)
- [Publish Events](#-publish-events)
- [Run Subscribers](#-run-subscribers)
- [Middleware](#-middleware)
- [Inbox/Outbox Pattern](#%EF%B8%8F-inboxoutbox-pattern)
- [Testing](#-testing)
- [Web UI](#-web-ui)
- [Rails Integration](#-rails-integration)
- [Best Practices](#-best-practices)
- [License](#-license)

---

## ✨ Features

- 🎯 **Topic-Based Messaging** - Simple, hierarchical topic pattern (e.g., `orders.created`, `users.updated`)
- 🔌 **Declarative Subscribers** - `subscribe_to 'orders.created'` - clean DSL for defining subscribers
- 🌲 **Wildcard Subscriptions** - Support for `*` (single level) and `>` (multi-level) wildcards
- 🛡️ **Outbox** (reliable send) & **Inbox** (idempotent receive), opt-in for transactional guarantees
- 🧨 **Dead Letter Queue** - Automatic handling of failed messages after max retries
- ⚙️ **Durable Pull Consumers** - Reliable message delivery with exponential backoff
- 📊 **Web UI** - Monitor Inbox/Outbox events, retry failures, view message details
- 🧪 **Testing Helpers** - Fake mode, inline mode, and RSpec matchers for easy testing
- 🔗 **ActiveRecord Integration** - Auto-publish model events with callbacks
- 🎭 **Middleware System** - Extensible processing pipeline for cross-cutting concerns
- 🚀 **CLI Executable** - Run subscribers with concurrency control and graceful shutdown
- 🧱 **Auto-Topology Management** - Automatic JetStream stream creation, prevents overlap errors
- 🔐 **Authentication & TLS** - Built-in support for token, user/password, NKey, credentials, and TLS/mTLS
- ⚡️ **Rails Integration** - Railtie for eager loading, generators for setup
- 📊 **Structured Logging** - Configurable logging with sensible defaults

---

## 📦 Install

```ruby
# Gemfile
gem "nats_pubsub", "~> 0.1"
```

```bash
bundle install
```

### Prerequisites

- Ruby 3.2+
- NATS Server with JetStream enabled
- PostgreSQL (for Inbox/Outbox pattern)
- Rails 7+ (optional, for Rails integration)

### Start NATS Server

```bash
# macOS
brew install nats-server
nats-server -js

# Linux
curl -L https://github.com/nats-io/nats-server/releases/download/v2.10.0/nats-server-v2.10.0-linux-amd64.tar.gz -o nats-server.tar.gz
tar -xzf nats-server.tar.gz
sudo mv nats-server-v2.10.0-linux-amd64/nats-server /usr/local/bin/
nats-server -js
```

---

## 🔧 Configure

```ruby
# config/initializers/nats_pubsub.rb
NatsPubsub.configure do |config|
  config.nats_urls = ENV.fetch("NATS_URLS", "nats://localhost:4222")
  config.env = ENV.fetch("RAILS_ENV", "development")
  config.app_name = ENV.fetch("APP_NAME", "myapp")

  # Consumer tuning
  config.concurrency = 10
  config.max_deliver = 5
  config.ack_wait = 30_000 # 30 seconds in ms
  config.backoff = [1_000, 5_000, 15_000, 30_000, 60_000] # in ms

  # Features
  config.use_dlq = true
  config.use_inbox = false # Enable for idempotent receive
  config.use_outbox = false # Enable for reliable send

  # Authentication (pick one)
  config.auth_token = ENV['NATS_TOKEN']
  # config.auth_user = ENV['NATS_USER']
  # config.auth_password = ENV['NATS_PASSWORD']
  # config.nkeys_seed = ENV['NATS_NKEYS_SEED']
  # config.user_credentials = ENV['NATS_CREDENTIALS']

  # TLS (for tls:// URLs)
  # config.tls_ca_file = '/path/to/ca.crt'
  # config.tls_cert_file = '/path/to/client.crt'  # optional, for mTLS
  # config.tls_key_file = '/path/to/client.key'   # optional, for mTLS

  # Custom logger (optional)
  config.logger = Rails.logger
end
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

**Required Variables:**

- `NATS_URLS` - NATS server URLs (comma-separated for clusters)
- `RAILS_ENV` - Environment (development/production)
- `APP_NAME` - Application name for event producer identification

**Optional Variables:**

- `CONCURRENCY` - Number of concurrent message processors (default: 10)
- `MAX_DELIVER` - Maximum delivery attempts before DLQ (default: 5)
- `ACK_WAIT` - Acknowledgment timeout in milliseconds (default: 30000)
- `USE_DLQ` - Enable Dead Letter Queue (default: true)
- `USE_INBOX` - Enable Inbox pattern (default: false)
- `USE_OUTBOX` - Enable Outbox pattern (default: false)

---

## 📡 Subject Pattern

NatsPubsub uses a **topic-based subject pattern**:

```md
{env}.{app_name}.{topic}
```

**Components:**

- `env` - Environment (production, staging, development) for isolation
- `app_name` - Your application/service name for multi-service communication
- `topic` - Hierarchical topic using dot notation (e.g., `order.created`, `user.updated`)

**Examples:**

- `production.myapp.order.created`
- `production.myapp.user.updated`
- `staging.payment-service.payment.completed`
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

```ruby
# app/subscribers/order_created_subscriber.rb
class OrderCreatedSubscriber < NatsPubsub::Subscriber
  subscribe_to "order.created"

  def handle(message, context)
    # context provides: event_id, trace_id, topic, occurred_at, deliveries
    logger.info "Processing order: #{message['order_id']}"

    # Your idempotent domain logic here
    OrderProcessor.process(message)
  end
end
```

### Wildcard Subscriptions

```ruby
# Subscribe to all user-related topics
class UserActivitySubscriber < NatsPubsub::Subscriber
  subscribe_to "user.*"  # Matches user.created, user.updated, user.deleted

  jetstream_options retry: 3, ack_wait: 60_000

  def handle(message, context)
    logger.info "User activity: #{context.topic}"

    case context.topic
    when "user.created"
      handle_user_created(message)
    when "user.updated"
      handle_user_updated(message)
    when "user.deleted"
      handle_user_deleted(message)
    end
  end
end
```

### Multiple Topics

```ruby
class EmailNotificationSubscriber < NatsPubsub::Subscriber
  subscribe_to "user.created", "order.placed"

  def handle(message, context)
    case context.topic
    when "user.created"
      send_welcome_email(message)
    when "order.placed"
      send_order_confirmation(message)
    end
  end

  private

  def send_welcome_email(message)
    # Implementation
  end

  def send_order_confirmation(message)
    # Implementation
  end
end
```

---

## 📤 Publish Events

### Basic Publishing

```ruby
# Simple topic publishing (keyword arguments)
NatsPubsub.publish(topic: "order.created", message: {
  order_id: order.id,
  customer_id: order.customer_id,
  total: order.total
})

# Or using positional arguments
NatsPubsub.publish("order.created", {
  order_id: order.id,
  customer_id: order.customer_id,
  total: order.total
})
```

### Multi-Topic Publishing

```ruby
# Publish to multiple topics at once (fan-out)
NatsPubsub.publish(
  topics: ["order.created", "notification.email", "audit.order"],
  message: {
    order_id: order.id,
    customer_id: order.customer_id,
    total: order.total
  }
)
```

### With Options

```ruby
NatsPubsub.publish(
  "user.created",
  { id: user.id, name: user.name },
  event_id: SecureRandom.uuid,
  trace_id: request_id,
  occurred_at: Time.current,
  message_type: "UserCreated"
)
```

### Using Outbox Pattern

```ruby
# Transactional publish with automatic retry
User.transaction do
  user = User.create!(params)

  NatsPubsub.publish_via_outbox(
    topic: "user.created",
    message: {
      id: user.id,
      name: user.name,
      email: user.email
    }
  )
end
```

---

## 🚀 Run Subscribers

### Using CLI

```bash
# Run all subscribers
bundle exec nats_pubsub

# With custom concurrency
CONCURRENCY=20 bundle exec nats_pubsub

# Run specific subscribers
bundle exec nats_pubsub UserActivitySubscriber EmailNotificationSubscriber
```

### Programmatically

```ruby
# config/subscribers.rb
require_relative "../app/subscribers/user_activity_subscriber"

NatsPubsub.configure do |config|
  # Configuration here
end

# Add middleware
NatsPubsub.use NatsPubsub::Middleware::Logging
NatsPubsub.use NatsPubsub::Middleware::RetryLogger

# Register subscribers
NatsPubsub.register_subscriber UserActivitySubscriber.new

# Start consuming
NatsPubsub.start

# Graceful shutdown
Signal.trap("TERM") do
  NatsPubsub.stop
  exit
end

Signal.trap("INT") do
  NatsPubsub.stop
  exit
end
```

---

## 🎭 Middleware

Build a processing pipeline with middleware:

```ruby
class CustomMiddleware
  def call(event, metadata, &next_middleware)
    puts "Before processing"
    next_middleware.call
    puts "After processing"
  end
end

NatsPubsub.use CustomMiddleware
```

---

## 🛡️ Inbox/Outbox Pattern

### Outbox Pattern (Reliable Send)

Ensures messages are published even if external systems fail:

```ruby
# Enable in configuration
NatsPubsub.configure do |config|
  config.use_outbox = true
end

# Publish with outbox
User.transaction do
  user = User.create!(params)

  NatsPubsub.publish_via_outbox("users", "user", "created", {
    id: user.id,
    name: user.name
  })
end

# Run outbox worker to process pending messages
bundle exec rake nats_pubsub:outbox:worker
```

### Inbox Pattern (Idempotent Receive)

Prevents duplicate message processing:

```ruby
# Enable in configuration
NatsPubsub.configure do |config|
  config.use_inbox = true
end

# Messages are automatically deduplicated based on event_id
class UserSubscriber < NatsPubsub::Subscriber
  subscribe_to "production.events.users.user.created"

  def call(event, metadata)
    # This will only execute once per unique event_id
    User.create!(event)
  end
end
```

---

## 📬 Envelope Format

### Topic-Based Envelope

```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "schema_version": 1,
  "topic": "user.created",
  "message_type": "UserCreated",
  "producer": "myapp",
  "occurred_at": "2025-11-16T22:00:00Z",
  "trace_id": "abc123def456",
  "message": {
    "id": "01H1234567890ABCDEF",
    "name": "Ada Lovelace",
    "email": "ada@example.com"
  }
}
```

### Domain/Resource/Action Envelope (Legacy)

```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "schema_version": 1,
  "domain": "users",
  "resource": "user",
  "action": "created",
  "producer": "myapp",
  "resource_id": "01H1234567890ABCDEF",
  "occurred_at": "2025-11-16T22:00:00Z",
  "trace_id": "abc123def456",
  "payload": {
    "id": "01H1234567890ABCDEF",
    "name": "Ada Lovelace",
    "email": "ada@example.com"
  }
}
```

**Common Fields:**

- `event_id` - Unique identifier for idempotency (UUID)
- `schema_version` - Envelope schema version (currently 1)
- `producer` - Application name that published the event
- `occurred_at` - ISO8601 timestamp when event occurred
- `trace_id` - Distributed tracing identifier (optional)

---

## 🧨 Dead-Letter Queue (DLQ)

When enabled, messages that exceed `max_deliver` are moved to the DLQ subject:
**`{env}.events.dlq`**

### Viewing DLQ Messages

Use the Web UI or programmatically:

```ruby
# Get DLQ messages
dlq_messages = NatsPubsub::DLQ.messages

# Retry a message
NatsPubsub::DLQ.retry(event_id: "abc-123")

# Delete a message
NatsPubsub::DLQ.delete(event_id: "abc-123")
```

---

## 🧪 Testing

### RSpec Matchers

```ruby
# spec/spec_helper.rb
require "nats_pubsub/testing"

RSpec.configure do |config|
  config.include NatsPubsub::Testing::Helpers
end
```

### Fake Mode

```ruby
RSpec.describe UsersController do
  before do
    NatsPubsub.fake!
  end

  after do
    NatsPubsub.unfake!
  end

  it "publishes user created event" do
    post :create, params: { name: "Alice" }

    expect(NatsPubsub).to have_published_event("users", "user", "created")
      .with_payload(hash_including(name: "Alice"))
  end
end
```

### Inline Mode

```ruby
RSpec.describe UserSubscriber do
  before do
    NatsPubsub.inline! # Subscribers execute immediately
  end

  after do
    NatsPubsub.uninline!
  end

  it "processes user events" do
    expect {
      NatsPubsub.publish("users", "user", "created", { id: 1, name: "Alice" })
    }.to change(User, :count).by(1)
  end
end
```

### Unit Testing Subscribers

```ruby
RSpec.describe UserActivitySubscriber do
  subject(:subscriber) { described_class.new }

  let(:event) { { "id" => "123", "name" => "Alice" } }
  let(:metadata) do
    {
      event_id: "test-id",
      subject: "production.events.users.user.created",
      domain: "users",
      resource: "user",
      action: "created"
    }
  end

  it "processes user events" do
    expect { subscriber.call(event, metadata) }.not_to raise_error
  end
end
```

---

## 📊 Web UI

NatsPubsub includes a Sinatra-based Web UI for monitoring:

### Mounting in Rails

```ruby
# config/routes.rb
Rails.application.routes.draw do
  mount NatsPubsub::WebUI => "/nats_pubsub"
end
```

### Features

- View Inbox/Outbox messages
- Monitor processing status
- Retry failed messages
- View message details and payloads
- Search and filter events

Access at: `http://localhost:3000/nats_pubsub`

---

## 🚂 Rails Integration

### Generators

```bash
# Generate everything (initializer + migrations)
rails generate nats_pubsub:install
rails db:migrate

# Or generate individually
rails generate nats_pubsub:initializer
rails generate nats_pubsub:migrations

# Skip specific parts
rails generate nats_pubsub:install --skip-migrations
rails generate nats_pubsub:install --skip-initializer

# Generate subscriber (coming soon)
# rails generate nats_pubsub:subscriber UserActivity
```

The install generator creates:

- `config/initializers/nats_pubsub.rb` - Configuration file
- `db/migrate/*_create_nats_pubsub_outbox.rb` - Outbox pattern table
- `db/migrate/*_create_nats_pubsub_inbox.rb` - Inbox pattern table

### ActiveRecord Callbacks

```ruby
class User < ApplicationRecord
  include NatsPubsub::ActiveRecordPublisher

  publishes :created, on: :create
  publishes :updated, on: :update
  publishes :deleted, on: :destroy
end
```

---

## Deployment

### Production Checklist

- [ ] Use TLS for NATS connections (`nats://` → `tls://`)
- [ ] Enable authentication on NATS server
- [ ] Set appropriate `RAILS_ENV=production`
- [ ] Configure proper logging levels
- [ ] Set up monitoring and alerting
- [ ] Use process manager (systemd, foreman)
- [ ] Configure graceful shutdown handling
- [ ] Set resource limits (memory, CPU)
- [ ] Review and tune `concurrency`, `max_deliver`, `ack_wait`
- [ ] Set up database backups (for Inbox/Outbox)

### Systemd Service

Create `/etc/systemd/system/nats-subscriber.service`:

```ini
[Unit]
Description=NATS PubSub Subscriber
After=network.target postgresql.service

[Service]
Type=simple
User=deploy
WorkingDirectory=/var/www/myapp
Environment=RAILS_ENV=production
ExecStart=/usr/local/bin/bundle exec nats_pubsub
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

### Foreman/Procfile

```yaml
# Procfile
web: bundle exec rails server
worker: bundle exec nats_pubsub
outbox: bundle exec rake nats_pubsub:outbox:worker
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
- Ensure subscriber is registered before calling `start`
- Check NATS server logs for errors
- Verify stream and consumer exist using NATS CLI

### Duplicate Processing

**Problem**: Messages being processed multiple times

**Solutions**:

- Enable Inbox pattern for automatic deduplication
- Ensure your subscriber logic is idempotent
- Check for multiple subscriber instances
- Review ack/nak logic in custom middleware

### Performance Issues

**Problem**: High memory or CPU usage

**Solutions**:

- Reduce `concurrency` setting
- Review subscriber logic for expensive operations
- Add caching where appropriate
- Monitor database connection pool
- Check for memory leaks in custom middleware

---

## Development

### Running Tests

```bash
cd packages/ruby
bundle exec rspec
```

### Running Tests with Coverage

```bash
bundle exec rspec --format documentation
```

### Linting

```bash
bundle exec rubocop
bundle exec rubocop -a # Auto-fix
```

### Release Scripts

The repository includes helper scripts for managing releases:

```bash
# Check release status
./scripts/release-status.sh

# Preview pending releases
./scripts/release-preview.sh

# Run pre-release checks
./scripts/release-check.sh

# Validate Ruby version (for maintainers)
./scripts/ruby-version-sync.sh
```

**What the scripts check:**

- Git status and branch
- Pending changesets
- Node.js, pnpm, and Ruby installations
- JavaScript and Ruby tests
- Build processes
- Publishing credentials
- Version consistency

See [scripts/README.md](../../scripts/README.md) for detailed documentation.

---

## 💡 Best Practices

### Message Design

**Recommended practices:**

- ✅ Use topic-based pattern for new applications (simpler, more flexible)
- ✅ Keep message payloads small and focused
- ✅ Include all necessary data to avoid additional lookups
- ✅ Use semantic versioning for message types
- ✅ Include `event_id` for idempotency tracking

**Avoid:**

- ❌ Include sensitive data (passwords, tokens) in messages
- ❌ Create circular dependencies between services
- ❌ Use messages as a database replacement
- ❌ Publish events for every single field change

### Subscriber Design

**Recommended practices:**

- ✅ Make subscribers idempotent (safe to process multiple times)
- ✅ Keep processing logic fast and focused
- ✅ Use database transactions when modifying data
- ✅ Log processing errors with context
- ✅ Handle partial failures gracefully

**Avoid:**

- ❌ Block on external API calls without timeout
- ❌ Perform expensive operations synchronously
- ❌ Assume message ordering (unless using same subject)
- ❌ Retry indefinitely without backoff
- ❌ Swallow exceptions silently

### Performance

**Recommended practices:**

- ✅ Enable Inbox pattern for automatic deduplication
- ✅ Use connection pooling for database operations
- ✅ Monitor memory usage and tune concurrency
- ✅ Cache frequently accessed data
- ✅ Use indexes on Inbox/Outbox tables

**Avoid:**

- ❌ Set concurrency too high (causes memory issues)
- ❌ Process messages synchronously in web requests
- ❌ Skip database indexes on event tables
- ❌ Ignore DLQ messages indefinitely
- ❌ Run subscribers in the same process as web server

### Security

**Recommended practices:**

- ✅ Use TLS for NATS connections in production
- ✅ Enable authentication on NATS server
- ✅ Rotate credentials regularly
- ✅ Validate and sanitize all incoming messages
- ✅ Use environment variables for secrets

**Avoid:**

- ❌ Commit credentials to version control
- ❌ Trust message data without validation
- ❌ Expose Web UI publicly without authentication
- ❌ Use default NATS passwords
- ❌ Skip input sanitization

### Monitoring

**Recommended practices:**

- ✅ Monitor DLQ message count
- ✅ Track message processing latency
- ✅ Alert on consumer lag
- ✅ Log all publishing failures
- ✅ Monitor Outbox table growth

**Avoid:**

- ❌ Ignore steadily growing DLQ
- ❌ Skip health checks in production
- ❌ Assume everything works without monitoring
- ❌ Overlook memory leak patterns
- ❌ Ignore slow query warnings

---

## 📄 License

[MIT License](../../LICENSE)

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for contribution guidelines.

## Support

- GitHub Issues: [https://github.com/attaradev/nats_pubsub/issues](https://github.com/attaradev/nats_pubsub/issues)
- Email: <mpyebattara@gmail.com>
