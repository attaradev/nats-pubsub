# NatsPubsub Monorepo

Declarative PubSub messaging for NATS JetStream

A production-ready pub/sub library with a familiar, declarative API. Features declarative subscribers, middleware support, and battle-tested reliability patterns including Inbox/Outbox, DLQ, and automatic retries with backoff.

This monorepo contains implementations for both **Ruby** and **Node.js/TypeScript**.

---

## 📚 Table of Contents

- [Quick Start](#-quick-start)
- [New Features](#-new-features)
- [Packages](#-packages)
- [Shared Features](#-shared-features)
- [Development](#-development)
- [Subject Pattern](#-subject-pattern)
- [Envelope Format](#-envelope-format)
- [Monorepo Structure](#️-monorepo-structure)
- [Rails Generators & Rake Task](#-rails-generators--rake-task)
- [Configure (Rails)](#-configure-rails)
- [Database Setup (Inbox / Outbox)](#-database-setup-inbox--outbox)
- [Declarative Subscribers](#-declarative-subscribers)
- [Publish Events](#-publish-events)
- [ActiveRecord Integration](#-activerecord-integration)
- [Run Subscribers](#-run-subscribers)
- [Web UI](#-web-ui)
- [Middleware](#-middleware)
- [Testing](#-testing)
- [Dead-Letter Queue (DLQ)](#-dead-letter-queue-dlq)
- [Operations Guide](#-operations-guide)
- [Troubleshooting](#troubleshooting)
- [Deployment](#-deployment)
- [CI/CD & Releases](#-cicd--releases)
- [Additional Documentation](#-additional-documentation)
- [License](#-license)

---

## 🚀 Quick Start

Get started with NatsPubsub in either Ruby or Node.js/TypeScript.

### Prerequisites

- NATS Server with JetStream enabled
- Ruby 2.7+ (for Ruby implementation) or Node.js 24+ (for Node.js implementation)

### Start NATS Server

**Option 1: Docker Compose (Recommended)** 🐳

```bash
# Start NATS, PostgreSQL, Prometheus, and Grafana
docker-compose up -d

# View NATS monitoring at http://localhost:8222
# View Grafana dashboards at http://localhost:3000 (admin/admin)
```

#### Option 2: Local Installation

```bash
# Install NATS server (if not already installed)
# macOS
brew install nats-server

# Linux
curl -L https://github.com/nats-io/nats-server/releases/download/v2.10.0/nats-server-v2.10.0-linux-amd64.zip -o nats-server.zip
unzip nats-server.zip
sudo mv nats-server-v2.10.0-linux-amd64/nats-server /usr/local/bin/

# Start with JetStream
nats-server -js
```

### Ruby Quick Start

#### 1. Install

```bash
cd packages/ruby
bundle install
```

Or add to your Gemfile:

```ruby
gem "nats_pubsub", "~> 0.1"
```

#### 2. Configure

```ruby
# config/initializers/nats_pubsub.rb (Rails)
# or standalone Ruby script
require 'nats_pubsub'

NatsPubsub.configure do |config|
  config.nats_urls = ENV.fetch("NATS_URLS", "nats://localhost:4222")
  config.env       = "development"
  config.app_name  = "my-app"
  config.concurrency = 5
  config.max_deliver = 3
  config.use_dlq = true
end
```

#### 3. Publish Events

```ruby
NatsPubsub.publish('users', 'user', 'created',
  id: 123,
  name: 'Alice Smith',
  email: 'alice@example.com'
)
```

#### 4. Create Subscribers

```ruby
# app/subscribers/user_subscriber.rb
class UserSubscriber
  include NatsPubsub::Subscriber

  subscribe_to 'development.events.users.user.*'

  def call(event, metadata)
    puts "User #{metadata[:action]}: #{event['name']}"
    # Your business logic here
  end
end
```

#### 5. Run Subscribers

```bash
bundle exec exe/nats_pubsub -e development -c 5
```

### Node.js/TypeScript Quick Start

#### 1. Install

```bash
cd packages/javascript
npm install
npm run build
```

Or install as a dependency:

```bash
npm install nats-pubsub
```

#### 2. Configure

```typescript
import NatsPubsub from 'nats-pubsub';

NatsPubsub.configure({
  natsUrls: process.env.NATS_URLS || 'nats://localhost:4222',
  env: 'development',
  appName: 'my-app',
  concurrency: 5,
  maxDeliver: 3,
  useDlq: true,
});
```

#### 3. Publish Events

```typescript
await NatsPubsub.publish('users', 'user', 'created', {
  id: 123,
  name: 'Alice Smith',
  email: 'alice@example.com',
});
```

#### 4. Create Subscribers

```typescript
import { BaseSubscriber, EventMetadata } from 'nats-pubsub';

class UserSubscriber extends BaseSubscriber {
  constructor() {
    super('development.events.users.user.*');
  }

  async call(event: Record<string, unknown>, metadata: EventMetadata): Promise<void> {
    console.log(`User ${metadata.action}: ${event.name}`);
    // Your business logic here
  }
}
```

#### 5. Run Subscribers

```typescript
import NatsPubsub from 'nats-pubsub';
import { UserSubscriber } from './subscribers/user-subscriber';

// Add middleware
NatsPubsub.use(loggingMiddleware);

// Register subscribers
NatsPubsub.registerSubscriber(new UserSubscriber());

// Start consuming
await NatsPubsub.start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await NatsPubsub.stop();
  process.exit(0);
});
```

Or run the example:

```bash
npm run build
node dist/examples/basic-usage.js
```

### Test Interoperability

#### Ruby Publisher → Node.js Subscriber

Terminal 1 (Node.js subscriber):

```bash
cd packages/javascript
npm run build
node dist/examples/basic-usage.js
```

Terminal 2 (Ruby publisher):

```bash
cd packages/ruby
bundle exec ruby -I lib -e "
require 'nats_pubsub'
NatsPubsub.configure { |c| c.nats_urls = 'nats://localhost:4222' }
NatsPubsub.publish('users', 'user', 'created', { id: 1, name: 'Bob' })
"
```

#### Node.js Publisher → Ruby Subscriber

Terminal 1 (Ruby subscriber):

```bash
cd packages/ruby
bundle exec exe/nats_pubsub -e development
```

Terminal 2 (Node.js publisher):

```bash
cd packages/javascript
npm run build
node -e "
const NatsPubsub = require('./dist/index').default;
NatsPubsub.configure({ natsUrls: 'nats://localhost:4222' });
NatsPubsub.publish('users', 'user', 'created', { id: 1, name: 'Alice' });
"
```

### Common Patterns

#### Wildcard Subscriptions

Ruby:

```ruby
subscribe_to 'production.events.users.user.*'  # All user events
subscribe_to 'production.events.>'             # All events
```

TypeScript:

```typescript
super('production.events.users.user.*');  // All user events
super('production.events.>');             // All events
```

#### Multiple Subjects

Ruby:

```ruby
subscribe_to 'production.events.users.user.created',
             'production.events.orders.order.placed'
```

TypeScript:

```typescript
super([
  'production.events.users.user.created',
  'production.events.orders.order.placed'
]);
```

#### Custom Middleware

TypeScript:

```typescript
class TimingMiddleware implements Middleware {
  async call(event, metadata, next) {
    const start = Date.now();
    await next();
    console.log(`Took ${Date.now() - start}ms`);
  }
}

NatsPubsub.use(new TimingMiddleware());
```

Ruby:

```ruby
class TimingMiddleware
  def call(event, metadata)
    start = Time.now
    yield
    puts "Took #{(Time.now - start) * 1000}ms"
  end
end

NatsPubsub.configure do |config|
  config.server_middleware do |chain|
    chain.add TimingMiddleware
  end
end
```

---

## 🎁 New Features

NatsPubsub now includes enterprise-grade features for production deployments:

### 📊 Monitoring & Observability

- **Prometheus Metrics** - Track messages, processing duration, DLQ, and connection health
- **Health Check Endpoints** - Production-ready health checks for NATS, JetStream, and consumer lag
- **Grafana Dashboards** - Pre-configured dashboards for real-time monitoring

### 🚀 Enhanced Publishing

- **Batch Publishing** - Publish multiple events efficiently with `publishBatch()`, `publishMany()`, and `fanout()`
- **Error Handling** - Detailed error reporting with batch results

### ☠️ DLQ Management

- **DLQ Consumer** - Built-in dead letter queue monitoring
- **Custom Handlers** - Logging, alerting, and storage handlers
- **Statistics** - Track DLQ messages by subject and age

### 🛠️ Developer Experience

- **Docker Compose** - Complete local development environment with NATS, PostgreSQL, Prometheus, and Grafana
- **TypeDoc** - Auto-generated API documentation
- **Comprehensive Tests** - 50+ unit tests for JavaScript implementation
- **GitHub Templates** - Professional issue and PR templates

📖 **[View Complete Improvements Guide →](./IMPROVEMENTS.md)**

🚀 **[Quick Start with New Features →](./QUICK_START_IMPROVEMENTS.md)**

---

## 📦 Packages

### [Ruby](./packages/ruby)

Production-ready pub/sub library with Rails integration, Web UI for monitoring, and complete Inbox/Outbox support.

```ruby
# Gemfile
gem "nats_pubsub", "~> 0.1"
```

**Features:**

- 🎯 Declarative API with familiar Ruby patterns
- 🛡 Outbox (reliable send) & Inbox (idempotent receive)
- 📊 Web UI for monitoring
- 🔗 ActiveRecord integration
- 🧪 RSpec matchers and testing helpers

[📖 Full Documentation →](./packages/ruby/README.md)

### [JavaScript/TypeScript](./packages/javascript)

Production-ready pub/sub library for Node.js with full TypeScript support.

```bash
npm install nats-pubsub
```

**Features:**

- 🎯 Declarative API for Node.js
- 🚀 TypeScript first with full type safety
- 🎭 Middleware system
- 🧪 Jest testing support
- 📊 **NEW:** Prometheus metrics integration
- ❤️ **NEW:** Health check endpoints
- 📦 **NEW:** Batch publishing API
- ☠️ **NEW:** DLQ consumer utilities

[📖 Full Documentation →](./packages/javascript/README.md)

---

## ✨ Shared Features

Both implementations provide:

- 🔌 **Simple Publishing** - `NatsPubsub.publish(domain, resource, action, payload)`
- 🧨 **DLQ** for poison messages
- ⚙️ Durable `pull_subscribe` with backoff & `max_deliver`
- 🎭 **Middleware system** - Extensible processing pipeline
- 🧱 **Overlap-safe stream provisioning** - Prevents "subjects overlap" errors
- 📊 Configurable logging with sensible defaults

---

## 📦 Development

### Install Dependencies

```bash
# Ruby package
cd packages/ruby && bundle install

# JavaScript package
cd packages/javascript && npm install
```

### Build & Test

```bash
# Build JavaScript
cd packages/javascript && npm run build

# Test Ruby
cd packages/ruby && bundle exec rspec

# Test JavaScript
cd packages/javascript && npm test
```

---

## 📡 Subject Pattern

Both implementations use a consistent PubSub event pattern:

```md
{env}.events.{domain}.{resource}.{action}
```

**Examples:**

- `production.events.users.user.created`
- `production.events.orders.order.placed`
- `staging.events.payments.payment.completed`

**Components:**

- `{env}`: Environment (e.g., `production`, `staging`, `development`)
- `{domain}`: Business domain (e.g., `users`, `orders`, `payments`)
- `{resource}`: Resource type (e.g., `user`, `order`, `payment`)
- `{action}`: Event action (e.g., `created`, `updated`, `deleted`)

**DLQ Subject:** `{env}.events.dlq`

---

## 📬 Envelope Format

Both implementations use the same event envelope structure:

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

This ensures complete interoperability between Ruby and Node.js services.

---

## 🏗️ Monorepo Structure

```
nats-pubsub/
├── packages/
│   ├── ruby/     # Ruby implementation
│   │   ├── lib/
│   │   ├── spec/
│   │   ├── exe/
│   │   ├── Gemfile
│   │   └── nats_pubsub.gemspec
│   │
│   └── javascript/        # Node.js/TypeScript implementation
│       ├── src/
│       ├── dist/
│       ├── package.json
│       └── tsconfig.json
│
├── package.json               # Root workspace configuration
├── README.md                  # This file
└── LICENSE
```

---

## 🧰 Rails Generators & Rake Task

From your Rails app:

```bash
# Create initializer + migrations
bin/rails g nats_pubsub:install

# Or run them separately:
bin/rails g nats_pubsub:initializer
bin/rails g nats_pubsub:migrations

# Rake task (does both initializer + migrations)
bin/rake nats_pubsub:install
```

Then:

```bash
bin/rails db:migrate
```

> The generators create:
>
> - `config/initializers/nats_pubsub.rb`
> - `db/migrate/*_create_jetstream_outbox_events.rb`
> - `db/migrate/*_create_jetstream_inbox_events.rb`

---

## 🔧 Configure (Rails)

```ruby
# config/initializers/nats_pubsub.rb
NatsPubsub.configure do |config|
  # NATS connection
  config.nats_urls = ENV.fetch("NATS_URLS", "nats://localhost:4222")
  config.env       = ENV.fetch("NATS_ENV", Rails.env)
  config.app_name  = ENV.fetch("APP_NAME", "app")

  # Consumer tuning
  config.concurrency = 10
  config.max_deliver = 5
  config.ack_wait    = "30s"
  config.backoff     = %w[1s 5s 15s 30s 60s]

  # Reliability features (opt-in)
  config.use_outbox = true
  config.use_inbox  = true
  config.use_dlq    = true

  # Models (override if you use custom AR classes/table names)
  config.outbox_model = "NatsPubsub::OutboxEvent"
  config.inbox_model  = "NatsPubsub::InboxEvent"

  # Middleware
  config.server_middleware do |chain|
    chain.add NatsPubsub::Middleware::Logging
    chain.add NatsPubsub::Middleware::RetryLogger
    chain.add NatsPubsub::Middleware::ActiveRecord
  end
end
```

> **Defaults:**
>
> - `stream_name` → `#{env}-events-stream`
> - `dlq_subject` → `#{env}.events.dlq`

### Logging

NatsPubsub logs through `config.logger` when set, falling back to `Rails.logger` or STDOUT. Provide any `Logger`-compatible instance in the initializer to integrate with your application's logging setup.

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

**Components:**

- `{env}`: Environment (e.g., `production`, `staging`, `development`)
- `{domain}`: Business domain (e.g., `users`, `orders`, `payments`)
- `{resource}`: Resource type (e.g., `user`, `order`, `payment`)
- `{action}`: Event action (e.g., `created`, `updated`, `deleted`)

**DLQ Subject:** `{env}.events.dlq`

---

## 🧱 Stream Topology (auto-ensure and overlap-safe)

On first connection, NatsPubsub **ensures** a single stream exists for your `env`:

- Stream name: `{env}-events-stream`
- Subscribes to: `{env}.events.>` (all events in the environment)
- DLQ subject: `{env}.events.dlq` (if enabled)

It's **overlap-safe**:

- Skips adding subjects already covered by existing wildcards
- Pre-filters subjects owned by other streams to avoid `BadRequest: subjects overlap with an existing stream`
- Retries once on concurrent races, then logs and continues safely

---

## 🗃 Database Setup (Inbox / Outbox)

Inbox/Outbox are **optional**. The library detects columns at runtime and only sets what exists, so you can start minimal and evolve later.

### Generator-created tables (recommended)

```ruby
# jetstream_outbox_events
create_table :jetstream_outbox_events do |t|
  t.string  :event_id, null: false
  t.string  :subject,  null: false
  t.jsonb   :payload,  null: false, default: {}
  t.jsonb   :headers,  null: false, default: {}
  t.string  :status,   null: false, default: "pending" # pending|publishing|sent|failed
  t.integer :attempts, null: false, default: 0
  t.text    :last_error
  t.datetime :enqueued_at
  t.datetime :sent_at
  t.timestamps
end
add_index :jetstream_outbox_events, :event_id, unique: true
add_index :jetstream_outbox_events, :status

# jetstream_inbox_events
create_table :jetstream_inbox_events do |t|
  t.string   :event_id                              # preferred dedupe key
  t.string   :subject,     null: false
  t.jsonb    :payload,     null: false, default: {}
  t.jsonb    :headers,     null: false, default: {}
  t.string   :stream
  t.bigint   :stream_seq
  t.integer  :deliveries
  t.string   :status,      null: false, default: "received" # received|processing|processed|failed
  t.text     :last_error
  t.datetime :received_at
  t.datetime :processed_at
  t.timestamps
end
add_index :jetstream_inbox_events, :event_id, unique: true, where: 'event_id IS NOT NULL'
add_index :jetstream_inbox_events, [:stream, :stream_seq], unique: true, where: 'stream IS NOT NULL AND stream_seq IS NOT NULL'
add_index :jetstream_inbox_events, :status
```

> Already have different table names? Point the config to your AR classes via `config.outbox_model` / `config.inbox_model`.

---

## 🎯 Declarative Subscribers

Create subscribers that automatically discover and route events:

```ruby
# app/subscribers/user_activity_subscriber.rb
class UserActivitySubscriber
  include NatsPubsub::Subscriber

  subscribe_to 'production.events.users.user.*'

  jetstream_options retry: 3, ack_wait: 60

  def call(event, metadata)
    logger.info "User #{metadata[:action]}: #{event['name']}"
    # Your idempotent domain logic here
  end
end
```

### Multiple Subjects

```ruby
class EmailNotificationSubscriber
  include NatsPubsub::Subscriber

  subscribe_to 'production.events.users.user.created',
               'production.events.orders.order.placed'

  def call(event, metadata)
    case metadata[:subject]
    when /users\.user\.created/
      send_welcome_email(event)
    when /orders\.order\.placed/
      send_order_confirmation(event)
    end
  end
end
```

### Wildcard Subscriptions

```ruby
class AuditLogSubscriber
  include NatsPubsub::Subscriber

  subscribe_to 'production.events.>'  # All events

  def call(event, metadata)
    AuditLog.create!(
      event_id: metadata[:event_id],
      subject: metadata[:subject],
      payload: event
    )
  end
end
```

---

## 📤 Publish Events

### Simple API

```ruby
NatsPubsub.publish('users', 'user', 'created',
  id: user.id,
  name: user.name,
  email: user.email
)
```

### With Options

```ruby
NatsPubsub.publish('users', 'user', 'created',
  { id: user.id, name: user.name },
  event_id: "uuid-or-ulid",
  trace_id: "hex",
  occurred_at: Time.now.utc
)
```

If **Outbox** is enabled, the publish call:

- Upserts an outbox row by `event_id`
- Publishes with `nats-msg-id` (idempotent)
- Marks status `sent` or records `failed` with `last_error`

---

## 🔗 ActiveRecord Integration

Auto-publish events when models change:

```ruby
class User < ApplicationRecord
  include NatsPubsub::ActiveRecord::Publishable

  publishes_events domain: 'users', resource: 'user'
end

# Now User.create! automatically publishes events!
user = User.create!(name: "Alice", email: "alice@example.com")
# Publishes: production.events.users.user.created
```

---

## 🚀 Run Subscribers

### CLI Executable

```bash
bundle exec exe/nats_pubsub -e production -c 10
```

**Options:**

- `-e, --environment ENV` - Environment (default: development)
- `-c, --concurrency NUM` - Number of consumer threads (default: 5)
- `-r, --require PATH` - File to require (default: ./config/environment)

### Programmatic

```ruby
# Start the consumer pool
NatsPubsub::CLI.new.run
```

---

## 📊 Web UI

Monitor your Inbox/Outbox events with the included Web UI:

```ruby
# config/routes.rb
require 'nats_pubsub/web'
mount NatsPubsub::Web, at: '/nats_pubsub'
```

Visit: `http://localhost:3000/nats_pubsub`

**Features:**

- Dashboard with statistics
- Inbox/Outbox monitoring
- Retry failed events
- Filter by status
- View full event details

---

## 📬 Envelope Format

```json
{
  "event_id":       "01H1234567890ABCDEF",
  "schema_version": 1,
  "event_type":     "created",
  "producer":       "myapp",
  "resource_type":  "user",
  "resource_id":    "01H1234567890ABCDEF",
  "occurred_at":    "2025-08-13T21:00:00Z",
  "trace_id":       "abc123",
  "payload":        { "id": "01H...", "name": "Ada" }
}
```

- `resource_id` is inferred from `payload[:id]` or `payload["id"]` when publishing.

---

## 🎭 Middleware

Build a processing pipeline with middleware:

```ruby
NatsPubsub.configure do |config|
  config.server_middleware do |chain|
    chain.add NatsPubsub::Middleware::Logging
    chain.add NatsPubsub::Middleware::RetryLogger
    chain.add NatsPubsub::Middleware::ActiveRecord
    chain.add MyCustomMiddleware
  end
end
```

### Custom Middleware

```ruby
class MyCustomMiddleware
  def call(event, metadata)
    # Before processing
    result = yield
    # After processing
    result
  end
end
```

---

## 🧪 Testing

### RSpec Setup

```ruby
# spec/support/nats_pubsub.rb
require 'nats_pubsub/testing'
require 'nats_pubsub/testing/matchers'

RSpec.configure do |config|
  config.before(:each) do
    NatsPubsub::Testing.fake!
  end
end
```

### Test Publishing

```ruby
RSpec.describe User do
  it "publishes user.created event" do
    expect {
      User.create!(name: "Alice", email: "alice@example.com")
    }.to have_published_event('users', 'user', 'created')
  end
end
```

### Test Subscribers

```ruby
RSpec.describe UserActivitySubscriber do
  it "handles user events" do
    subscriber = described_class.new
    payload = { 'id' => '123', 'name' => 'Alice' }
    metadata = { action: 'created', subject: 'production.events.users.user.created' }

    expect { subscriber.call(payload, metadata) }.not_to raise_error
  end
end
```

### Inline Mode

```ruby
RSpec.describe "User signup" do
  before { NatsPubsub::Testing.inline! }

  it "sends welcome email" do
    expect(WelcomeMailer).to receive(:send_email)
    User.create!(name: "Alice", email: "alice@example.com")
  end
end
```

---

## 🧨 Dead-Letter Queue (DLQ)

When enabled, the topology ensures the DLQ subject exists:
**`{env}.events.dlq`**

You may run a separate process to subscribe and triage messages that exceed `max_deliver` or are NAK'ed to the DLQ.

---

## 🛠 Operations Guide

### Monitoring

- **Consumer lag**: `nats consumer info <stream> <durable>`
- **DLQ volume**: subscribe/metrics on `{env}.events.dlq`
- **Outbox backlog**: alert on `jetstream_outbox_events` with `status != 'sent'` and growing count

### Scaling

- Run subscribers in **separate processes/containers**
- Scale subscribers independently of web
- Tune `concurrency`, `batch_size`, `ack_wait`, `max_deliver`, and `backoff`

### Health check

- Force-connect & ensure topology at boot or in a check:

  ```ruby
  # Returns JetStream context if successful
  NatsPubsub.ensure_topology!
  ```

### When to Use

- **Inbox**: you need idempotent processing and replay safety
- **Outbox**: you want "DB commit ⇒ event published (or recorded for retry)" guarantees

---

## 🧩 Troubleshooting

- **`subjects overlap with an existing stream`**
  The library pre-filters overlapping subjects and retries once. If another team owns a broad wildcard (e.g., `env.events.>`), coordinate subject boundaries.

- **Consumer exists with mismatched filter**
  The library detects and recreates the durable with the desired filter subject.

- **Repeated redeliveries**
  Increase `ack_wait`, review handler acks/NACKs, or move poison messages to DLQ.

---

## 🚀 Deployment

### Docker

```dockerfile
FROM ruby:3.2
WORKDIR /app
COPY . .
RUN bundle install
CMD ["bundle", "exec", "exe/nats_pubsub", "-e", "production", "-c", "10"]
```

### Systemd

```ini
[Unit]
Description=NatsPubsub Subscribers

[Service]
Type=simple
WorkingDirectory=/app
Environment=RAILS_ENV=production
ExecStart=/usr/local/bin/bundle exec exe/nats_pubsub -c 10
Restart=always

[Install]
WantedBy=multi-user.target
```

---

## 🚀 Getting Started

1. Add the gem & run `bundle install`
2. `bin/rails g nats_pubsub:install`
3. `bin/rails db:migrate`
4. Create subscribers in `app/subscribers/`
5. Start publishing/consuming!

---

## 🚦 CI/CD & Releases

This monorepo uses automated CI/CD with conventional commits:

- **Automatic Versioning**: Commits following [conventional commit](https://www.conventionalcommits.org/) format trigger automatic version bumps
- **Automated Publishing**: Packages are automatically published to RubyGems (Ruby) and npm (JavaScript)
- **Independent Releases**: Each package has its own versioning and release cycle

### Commit Format

```bash
# Patch version bump (0.1.0 -> 0.1.1)
git commit -m "fix(ruby): handle connection timeout gracefully"

# Minor version bump (0.1.0 -> 0.2.0)
git commit -m "feat(javascript): add batch processing support"

# Major version bump (0.1.0 -> 1.0.0)
git commit -m "feat(api)!: redesign subscriber API

BREAKING CHANGE: Subscriber base class constructor signature has changed"
```

[📖 Full CI/CD Documentation →](./docs/CI_CD_SETUP.md)

---

## Troubleshooting

### Connection Issues

1. Make sure NATS server is running:

   ```bash
   nats-server -js
   ```

2. Check NATS URL is correct:
   - Ruby: `config.nats_urls = "nats://localhost:4222"`
   - Node.js: `natsUrls: 'nats://localhost:4222'`

3. Verify JetStream is enabled (should see "JetStream" in NATS server logs)

### Stream Already Exists

If you see "stream already exists" errors, it's safe to ignore - the library handles existing streams.

### No Messages Being Received

1. Check that env matches between publisher and subscriber
2. Verify subject patterns match
3. Check NATS server logs for errors
4. Use NATS CLI to inspect:

   ```bash
   nats stream ls
   nats stream info <stream-name>
   nats consumer ls <stream-name>
   ```

### Subjects Overlap Error

The library pre-filters overlapping subjects and retries once. If another team owns a broad wildcard (e.g., `env.events.>`), coordinate subject boundaries.

### Consumer Exists with Mismatched Filter

The library detects and recreates the durable with the desired filter subject.

### Repeated Redeliveries

Increase `ack_wait`, review handler acks/NACKs, or move poison messages to DLQ.

---

## 📚 Additional Documentation

- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Contribution guidelines and development setup
- **[docs/CI_CD_SETUP.md](./docs/CI_CD_SETUP.md)** - CI/CD configuration and release process

---

## 📄 License

[MIT License](LICENSE)
