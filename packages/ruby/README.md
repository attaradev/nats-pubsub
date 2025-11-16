# NatsPubsub (Ruby)

**Declarative PubSub messaging for NATS JetStream**

A production-ready pub/sub library for Ruby with Rails integration, declarative subscribers, middleware support, Web UI for monitoring, and battle-tested reliability patterns including Inbox/Outbox, DLQ, and automatic retries with backoff.

This is the Ruby implementation of NatsPubsub. For the Node.js/TypeScript version, see [../javascript](../javascript).

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
- [Inbox/Outbox Pattern](#-inboxoutbox-pattern)
- [Testing](#-testing)
- [Web UI](#-web-ui)
- [Rails Integration](#-rails-integration)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [License](#-license)

---

## ✨ Features

- 🎯 **Declarative API** - Familiar pattern for defining subscribers
- 🔌 **Simple Publishing** - `NatsPubsub.publish(domain, resource, action, payload)`
- 🛡️ **Outbox** (reliable send) & **Inbox** (idempotent receive), opt-in
- 🧨 **DLQ** for poison messages
- ⚙️ Durable `pull_subscribe` with backoff & `max_deliver`
- 📊 **Web UI** - Monitor Inbox/Outbox events, retry failures, view details
- 🧪 **Testing helpers** - Fake mode, inline mode, and RSpec matchers
- 🔗 **ActiveRecord integration** - Auto-publish model events
- 🎭 **Middleware system** - Extensible processing pipeline
- 🚀 **CLI executable** - Run subscribers with concurrency control
- 🧱 **Overlap-safe stream provisioning** - Prevents "subjects overlap" errors
- ⚡️ **Eager-loaded models** via Railtie (production)
- 📊 Configurable logging with sensible defaults

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

```ruby
# app/subscribers/user_activity_subscriber.rb
class UserActivitySubscriber < NatsPubsub::Subscriber
  subscribe_to "production.events.users.user.*", retry: 3, ack_wait: 60_000

  def call(event, metadata)
    logger.info "User #{metadata[:action]}: #{event['name']}"
    # Your idempotent domain logic here
  end
end
```

### Multiple Subjects

```ruby
class EmailNotificationSubscriber < NatsPubsub::Subscriber
  subscribe_to [
    "production.events.users.user.created",
    "production.events.orders.order.placed"
  ]

  def call(event, metadata)
    case metadata[:subject]
    when /users\.user\.created/
      send_welcome_email(event)
    when /orders\.order\.placed/
      send_order_confirmation(event)
    end
  end

  private

  def send_welcome_email(event)
    # Implementation
  end

  def send_order_confirmation(event)
    # Implementation
  end
end
```

---

## 📤 Publish Events

### Simple API

```ruby
NatsPubsub.publish("users", "user", "created", {
  id: user.id,
  name: user.name,
  email: user.email
})
```

### With Options

```ruby
NatsPubsub.publish(
  "users",
  "user",
  "created",
  { id: user.id, name: user.name },
  event_id: SecureRandom.uuid,
  trace_id: request_id,
  occurred_at: Time.current
)
```

### Using Outbox Pattern

```ruby
# Transactional publish with automatic retry
User.transaction do
  user = User.create!(params)

  NatsPubsub.publish_via_outbox("users", "user", "created", {
    id: user.id,
    name: user.name,
    email: user.email
  })
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
# Generate subscriber
rails generate nats_pubsub:subscriber UserActivity

# Generate migrations for Inbox/Outbox
rails generate nats_pubsub:install
rails db:migrate
```

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

---

## 📄 License

[MIT License](../../LICENSE)

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for contribution guidelines.

## Support

- GitHub Issues: [https://github.com/attaradev/nats_pubsub/issues](https://github.com/attaradev/nats_pubsub/issues)
- Email: <mpyebattara@gmail.com>
