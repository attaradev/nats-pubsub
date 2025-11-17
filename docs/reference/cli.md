# CLI Reference

Complete command-line interface reference for NatsPubsub (JavaScript/TypeScript and Ruby).

## Table of Contents

- [JavaScript/TypeScript CLI](#javascripttypescript-cli)
- [Ruby CLI](#ruby-cli)
- [Rails Generators](#rails-generators)
- [Rake Tasks](#rake-tasks)
- [Common Operations](#common-operations)
- [Debugging Commands](#debugging-commands)
- [Monitoring Commands](#monitoring-commands)

---

## JavaScript/TypeScript CLI

### Installation

```bash
npm install -g nats-pubsub
# or use npx
npx nats-pubsub --help
```

### Global Options

All commands support these global options:

| Option         | Alias | Description      | Default                 |
| -------------- | ----- | ---------------- | ----------------------- |
| `--env <env>`  | `-e`  | Environment name | `development`           |
| `--app <name>` | `-a`  | Application name | `app`                   |
| `--url <url>`  | `-u`  | NATS server URL  | `nats://localhost:4222` |

---

### Commands

#### `start`

Start the consumer to process messages.

**Usage:**

```bash
nats-pubsub start [options]
```

**Options:**

| Option                   | Alias | Description         | Default                 |
| ------------------------ | ----- | ------------------- | ----------------------- |
| `--env <env>`            | `-e`  | Environment         | `development`           |
| `--app <name>`           | `-a`  | Application name    | `app`                   |
| `--url <url>`            | `-u`  | NATS server URL     | `nats://localhost:4222` |
| `--concurrency <number>` | `-c`  | Message concurrency | `10`                    |

**Examples:**

```bash
# Start with defaults
nats-pubsub start

# Start in production
nats-pubsub start --env production --app order-service --url nats://nats.example.com:4222

# Start with high concurrency
nats-pubsub start --concurrency 50

# Short form
nats-pubsub start -e production -a my-app -u nats://nats:4222 -c 20
```

**Output:**

```
Starting NatsPubsub consumer...
  Environment: production
  App Name: order-service
  NATS URL: nats://nats.example.com:4222
  Concurrency: 10
Consumer started successfully
```

**Graceful Shutdown:**

The consumer handles SIGINT (Ctrl+C) and SIGTERM signals gracefully:

```bash
# Press Ctrl+C to stop
^C
Received SIGINT, shutting down gracefully...
Consumer stopped
```

---

#### `info`

Show stream and configuration information.

**Usage:**

```bash
nats-pubsub info [options]
```

**Options:**

| Option         | Alias | Description      | Default                 |
| -------------- | ----- | ---------------- | ----------------------- |
| `--env <env>`  | `-e`  | Environment      | `development`           |
| `--app <name>` | `-a`  | Application name | `app`                   |
| `--url <url>`  | `-u`  | NATS server URL  | `nats://localhost:4222` |

**Examples:**

```bash
# Show info for development
nats-pubsub info

# Show info for production
nats-pubsub info --env production --app order-service --url nats://nats.example.com:4222
```

**Output:**

```
=== NatsPubsub Configuration ===
Environment: production
App Name: order-service
NATS URLs: nats://nats.example.com:4222
Stream Name: production-events-stream
DLQ Subject: production.order-service.dlq
Concurrency: 10
Max Deliver: 5
Use DLQ: true

=== Stream Information ===
Stream: production-events-stream
Subjects: production.order-service.>
Messages: 1234
Bytes: 567890
First Seq: 1
Last Seq: 1234
Consumers: 3

=== DLQ Stream Information ===
Stream: production-events-stream-dlq
Subjects: production.order-service.dlq
Messages: 5
Bytes: 1024
```

---

#### `health`

Check connection health.

**Usage:**

```bash
nats-pubsub health [options]
```

**Options:**

| Option        | Alias | Description     | Default                 |
| ------------- | ----- | --------------- | ----------------------- |
| `--url <url>` | `-u`  | NATS server URL | `nats://localhost:4222` |

**Examples:**

```bash
# Check local NATS
nats-pubsub health

# Check remote NATS
nats-pubsub health --url nats://nats.example.com:4222
```

**Output (Success):**

```
Checking NATS connection...
✓ Connected to NATS
  Server: nats://localhost:4222
  Status: open
✓ JetStream available
  Streams: 2
  Consumers: 5
  Memory: 2048 bytes
  Storage: 1048576 bytes

Health check passed ✓
```

**Output (Failure):**

```
Checking NATS connection...
Health check failed: Error: connect ECONNREFUSED 127.0.0.1:4222
```

**Exit Codes:**

- `0` - Health check passed
- `1` - Health check failed

---

#### `purge`

Purge messages from stream.

**Usage:**

```bash
nats-pubsub purge [options]
```

**Options:**

| Option         | Alias | Description       | Default                 |
| -------------- | ----- | ----------------- | ----------------------- |
| `--env <env>`  | `-e`  | Environment       | `development`           |
| `--app <name>` | `-a`  | Application name  | `app`                   |
| `--url <url>`  | `-u`  | NATS server URL   | `nats://localhost:4222` |
| `--dlq`        | -     | Purge DLQ stream  | `false`                 |
| `--force`      | -     | Skip confirmation | `false`                 |

**Examples:**

```bash
# Show warning (no --force)
nats-pubsub purge --env development
# Output: WARNING: This will delete all messages from stream: development-events-stream
#         Use --force to skip this confirmation

# Purge main stream
nats-pubsub purge --env development --force

# Purge DLQ stream
nats-pubsub purge --env production --dlq --force
```

**Output:**

```
Purging stream: development-events-stream...
✓ Stream purged successfully
```

**Warning:** This operation is destructive and cannot be undone!

---

#### `delete`

Delete stream.

**Usage:**

```bash
nats-pubsub delete [options]
```

**Options:**

| Option         | Alias | Description       | Default                 |
| -------------- | ----- | ----------------- | ----------------------- |
| `--env <env>`  | `-e`  | Environment       | `development`           |
| `--app <name>` | `-a`  | Application name  | `app`                   |
| `--url <url>`  | `-u`  | NATS server URL   | `nats://localhost:4222` |
| `--dlq`        | -     | Delete DLQ stream | `false`                 |
| `--force`      | -     | Skip confirmation | `false`                 |

**Examples:**

```bash
# Show warning (no --force)
nats-pubsub delete --env development
# Output: WARNING: This will permanently delete stream: development-events-stream
#         Use --force to skip this confirmation

# Delete main stream
nats-pubsub delete --env development --force

# Delete DLQ stream
nats-pubsub delete --env production --dlq --force
```

**Output:**

```
Deleting stream: development-events-stream...
✓ Stream deleted successfully
```

**Warning:** This operation is destructive and cannot be undone!

---

#### `--version`

Show version information.

**Usage:**

```bash
nats-pubsub --version
```

**Output:**

```
0.2.0
```

---

#### `--help`

Show help information.

**Usage:**

```bash
nats-pubsub --help
nats-pubsub <command> --help
```

**Output:**

```
Usage: nats-pubsub [options] [command]

CLI tool for NatsPubsub management

Options:
  -V, --version                 output the version number
  -h, --help                    display help for command

Commands:
  start [options]               Start consumer to process messages
  info [options]                Show stream and configuration information
  health [options]              Check connection health
  purge [options]               Purge messages from stream
  delete [options]              Delete stream
  help [command]                display help for command
```

---

## Ruby CLI

### Installation

The CLI is included with the gem:

```bash
gem install nats_pubsub
```

Or add to Gemfile:

```ruby
gem 'nats_pubsub'
```

### Commands

#### `nats_pubsub`

Run the subscriber pool.

**Usage:**

```bash
bundle exec nats_pubsub [options]
```

**Options:**

| Option                  | Description       | Default                 |
| ----------------------- | ----------------- | ----------------------- |
| `-e, --environment ENV` | Environment name  | From RAILS_ENV/RACK_ENV |
| `-r, --require PATH`    | File to require   | `config/environment.rb` |
| `-c, --concurrency NUM` | Number of workers | From config or `5`      |

**Examples:**

```bash
# Start in Rails app (auto-loads config/environment.rb)
bundle exec nats_pubsub

# Start with specific environment
bundle exec nats_pubsub -e production

# Start with high concurrency
bundle exec nats_pubsub -c 20

# Require specific file
bundle exec nats_pubsub -r ./config/boot.rb

# Combined options
bundle exec nats_pubsub -e production -c 20
```

**Output:**

```
NatsPubsub starting in production environment
Discovered 5 subscribers:
  - OrderSubscriber (orders.order.*)
  - NotificationSubscriber (notifications.email)
  - AnalyticsSubscriber (analytics.>)
  - AuditSubscriber (audit.*)
  - UserSubscriber (users.user.*)

Starting worker pool with 20 workers...
```

**Graceful Shutdown:**

The CLI handles INT and TERM signals gracefully:

```bash
# Press Ctrl+C to stop
^C
Received INT, shutting down gracefully...
Waiting for in-flight messages to complete...
Shutdown complete
```

**Signal Handlers:**

- `INT` / `TERM` - Graceful shutdown
- `USR1` - Thread dump (for debugging)

```bash
# Send USR1 signal for thread dump
kill -USR1 <pid>
```

**Output:**

```
Thread dump:
12345: run
12346: sleep
12347: run
```

---

## Rails Generators

### Overview

NatsPubsub provides Rails generators for easy setup and scaffolding.

---

### `nats_pubsub:install`

Install NatsPubsub in a Rails application.

**Usage:**

```bash
rails generate nats_pubsub:install
```

**What it does:**

- Creates `config/initializers/nats_pubsub.rb`
- Creates `app/subscribers/` directory
- Adds example configuration

**Example Output:**

```
create  config/initializers/nats_pubsub.rb
create  app/subscribers
create  app/subscribers/application_subscriber.rb
```

**Generated Configuration:**

```ruby
# config/initializers/nats_pubsub.rb
NatsPubsub.configure do |config|
  config.env = ENV.fetch('NATS_ENV', Rails.env)
  config.app_name = ENV.fetch('APP_NAME', 'app')
  config.nats_urls = ENV.fetch('NATS_URLS', 'nats://localhost:4222')

  config.concurrency = 5
  config.use_outbox = false
  config.use_inbox = false
  config.use_dlq = true

  config.logger = Rails.logger

  config.server_middleware do |chain|
    chain.add NatsPubsub::Middleware::Logging.new
    chain.add NatsPubsub::Middleware::ActiveRecord.new
  end
end
```

---

### `nats_pubsub:config`

Generate NatsPubsub configuration file.

**Usage:**

```bash
rails generate nats_pubsub:config
```

**What it does:**

- Creates `config/initializers/nats_pubsub.rb`
- Creates `config/nats_pubsub.yml` (optional YAML config)

**Options:**

| Option            | Description                                   |
| ----------------- | --------------------------------------------- |
| `--yaml`          | Generate YAML configuration instead of Ruby   |
| `--preset PRESET` | Use preset (development, production, testing) |

**Examples:**

```bash
# Generate Ruby config
rails generate nats_pubsub:config

# Generate YAML config
rails generate nats_pubsub:config --yaml

# Generate with production preset
rails generate nats_pubsub:config --preset production
```

---

### `nats_pubsub:subscriber`

Generate a subscriber class.

**Usage:**

```bash
rails generate nats_pubsub:subscriber NAME [topics] [options]
```

**Arguments:**

- `NAME` - Subscriber class name (e.g., EmailNotification, OrderProcessor)
- `topics` - Optional topic names to subscribe to

**Options:**

| Option               | Description                    |
| -------------------- | ------------------------------ |
| `--topics TOPICS`    | Comma-separated list of topics |
| `--wildcard`         | Use wildcard subscription      |
| `--retry NUM`        | Number of retries              |
| `--ack-wait SECONDS` | Ack wait time in seconds       |

**Examples:**

```bash
# Basic subscriber
rails generate nats_pubsub:subscriber EmailNotification

# With topics
rails generate nats_pubsub:subscriber EmailNotification notifications.email

# Multiple topics
rails generate nats_pubsub:subscriber NotificationProcessor notifications.email notifications.sms

# With wildcard
rails generate nats_pubsub:subscriber AllNotifications notifications --wildcard

# With options
rails generate nats_pubsub:subscriber OrderProcessor orders.order.* --retry 5 --ack-wait 60
```

**Generated File:**

```ruby
# app/subscribers/email_notification_subscriber.rb
class EmailNotificationSubscriber
  include NatsPubsub::Subscriber

  subscribe_to 'notifications.email'

  jetstream_options retry: 3, ack_wait: 30

  def handle(message, context)
    # TODO: Implement message handling
    Rails.logger.info "Received message: #{message.inspect}"
    Rails.logger.info "Event ID: #{context.event_id}"
  end
end
```

---

### `nats_pubsub:migrations`

Generate database migrations for inbox and outbox tables.

**Usage:**

```bash
rails generate nats_pubsub:migrations
```

**What it does:**

- Creates migration for `nats_pubsub_outbox` table
- Creates migration for `nats_pubsub_inbox` table

**Example Output:**

```
create  db/migrate/20231117000001_create_nats_pubsub_outbox.rb
create  db/migrate/20231117000002_create_nats_pubsub_inbox.rb
```

**Generated Migrations:**

```ruby
# db/migrate/XXXXXX_create_nats_pubsub_outbox.rb
class CreateNatsPubsubOutbox < ActiveRecord::Migration[7.0]
  def change
    create_table :nats_pubsub_outbox do |t|
      t.string :event_id, null: false, index: { unique: true }
      t.string :subject, null: false
      t.text :payload, null: false
      t.text :headers
      t.string :status, null: false, default: 'pending'
      t.integer :attempts, null: false, default: 0
      t.text :last_error
      t.datetime :enqueued_at, null: false
      t.datetime :sent_at
      t.timestamps
    end

    add_index :nats_pubsub_outbox, :status
    add_index :nats_pubsub_outbox, :enqueued_at
  end
end

# db/migrate/XXXXXX_create_nats_pubsub_inbox.rb
class CreateNatsPubsubInbox < ActiveRecord::Migration[7.0]
  def change
    create_table :nats_pubsub_inbox do |t|
      t.string :event_id, null: false, index: { unique: true }
      t.string :subject, null: false
      t.text :payload, null: false
      t.text :headers
      t.string :status, null: false, default: 'pending'
      t.integer :deliveries, null: false, default: 0
      t.text :last_error
      t.datetime :received_at, null: false
      t.datetime :processed_at
      t.timestamps
    end

    add_index :nats_pubsub_inbox, :status
    add_index :nats_pubsub_inbox, :received_at
  end
end
```

**Run Migrations:**

```bash
rails db:migrate
```

---

## Rake Tasks

### Overview

NatsPubsub provides Rake tasks for common operations.

---

### `nats_pubsub:install`

Install NatsPubsub in the application.

**Usage:**

```bash
rake nats_pubsub:install
```

Same as `rails generate nats_pubsub:install`.

---

### `nats_pubsub:health`

Check NATS connection health.

**Usage:**

```bash
rake nats_pubsub:health
```

**Output:**

```
Checking NATS connection...
✓ Connected to nats://localhost:4222
✓ JetStream available
  Streams: 2
  Consumers: 5
```

---

### `nats_pubsub:info`

Show stream and configuration information.

**Usage:**

```bash
rake nats_pubsub:info
```

**Output:**

```
=== Configuration ===
Environment: development
App Name: my-app
NATS URLs: nats://localhost:4222
Stream: development-events-stream
Concurrency: 5

=== Streams ===
development-events-stream:
  Messages: 123
  Consumers: 3
  Subjects: development.my-app.>
```

---

### `nats_pubsub:purge`

Purge messages from stream.

**Usage:**

```bash
rake nats_pubsub:purge
rake nats_pubsub:purge STREAM=development-events-stream
```

**Environment Variables:**

- `STREAM` - Stream name to purge (default: from config)
- `CONFIRM` - Set to 'yes' to skip confirmation

**Examples:**

```bash
# Purge with confirmation
rake nats_pubsub:purge

# Skip confirmation
rake nats_pubsub:purge CONFIRM=yes

# Purge specific stream
rake nats_pubsub:purge STREAM=production-events-stream CONFIRM=yes
```

---

### `nats_pubsub:outbox:process`

Process pending outbox events.

**Usage:**

```bash
rake nats_pubsub:outbox:process
rake nats_pubsub:outbox:process LIMIT=100
```

**Environment Variables:**

- `LIMIT` - Maximum number of events to process (default: 100)

**Example:**

```bash
rake nats_pubsub:outbox:process LIMIT=500
```

---

### `nats_pubsub:outbox:cleanup`

Cleanup old outbox events.

**Usage:**

```bash
rake nats_pubsub:outbox:cleanup
rake nats_pubsub:outbox:cleanup DAYS=7
```

**Environment Variables:**

- `DAYS` - Number of days to retain (default: 7)

**Example:**

```bash
# Keep 30 days
rake nats_pubsub:outbox:cleanup DAYS=30
```

---

### `nats_pubsub:inbox:cleanup`

Cleanup old inbox events.

**Usage:**

```bash
rake nats_pubsub:inbox:cleanup
rake nats_pubsub:inbox:cleanup DAYS=30
```

**Environment Variables:**

- `DAYS` - Number of days to retain (default: 30)

**Example:**

```bash
# Keep 90 days
rake nats_pubsub:inbox:cleanup DAYS=90
```

---

## Common Operations

### Starting the Consumer

#### Development

```bash
# JavaScript
nats-pubsub start

# Ruby
bundle exec nats_pubsub
```

#### Production

```bash
# JavaScript with PM2
pm2 start "nats-pubsub start -e production -a order-service" --name nats-consumer

# Ruby with systemd
systemctl start nats-pubsub

# Ruby with Docker
docker run -d myapp bundle exec nats_pubsub -e production -c 20
```

### Checking Health

```bash
# JavaScript
nats-pubsub health

# Ruby
rake nats_pubsub:health
```

### Viewing Stream Information

```bash
# JavaScript
nats-pubsub info

# Ruby
rake nats_pubsub:info
```

### Purging Messages

```bash
# JavaScript
nats-pubsub purge --env development --force

# Ruby
rake nats_pubsub:purge CONFIRM=yes
```

---

## Debugging Commands

### JavaScript/TypeScript

#### Debug Mode

```bash
# Set DEBUG environment variable
DEBUG=nats-pubsub:* nats-pubsub start

# Verbose logging
NODE_ENV=development nats-pubsub start
```

#### Inspect Configuration

```bash
# Show configuration
nats-pubsub info --env production
```

#### Test Connection

```bash
# Test NATS connection
nats-pubsub health --url nats://localhost:4222
```

### Ruby

#### Debug Mode

```bash
# Set log level to DEBUG
RAILS_LOG_LEVEL=debug bundle exec nats_pubsub

# Enable verbose logging
NATS_DEBUG=1 bundle exec nats_pubsub
```

#### Thread Dump

```bash
# Get thread dump
kill -USR1 <pid>

# Or use pgrep
kill -USR1 $(pgrep -f nats_pubsub)
```

#### Rails Console

```ruby
# In Rails console
rails console

# Check configuration
NatsPubsub.config.inspect

# Test connection
NatsPubsub.ensure_topology!

# Publish test message
NatsPubsub.publish(topic: 'test', message: { test: true })

# Check outbox
NatsPubsub::OutboxEvent.pending.count

# Check inbox
NatsPubsub::InboxEvent.processed.count
```

---

## Monitoring Commands

### Stream Statistics

#### JavaScript

```bash
# Get stream info
nats-pubsub info --env production

# Watch continuously
watch -n 5 nats-pubsub info --env production
```

#### Ruby

```bash
# Get stream info
rake nats_pubsub:info

# Watch continuously
watch -n 5 rake nats_pubsub:info
```

### Consumer Statistics

#### JavaScript

```bash
# Monitor consumer
nats-pubsub start --env production
# Watch logs for statistics
```

#### Ruby

```bash
# Monitor consumer
bundle exec nats_pubsub -e production
# Watch logs for statistics
```

### DLQ Monitoring

#### JavaScript

```bash
# Check DLQ stream
nats-pubsub info --env production
# Look for "DLQ Stream Information" section
```

#### Ruby

```bash
# Check DLQ in Rails console
NatsPubsub::DlqEvent.count
NatsPubsub::DlqEvent.recent.limit(10)
```

### Outbox/Inbox Monitoring

#### Ruby (Rails Console)

```ruby
# Outbox statistics
puts "Pending: #{NatsPubsub::OutboxEvent.pending.count}"
puts "Sent: #{NatsPubsub::OutboxEvent.sent.count}"
puts "Failed: #{NatsPubsub::OutboxEvent.failed.count}"

# Inbox statistics
puts "Pending: #{NatsPubsub::InboxEvent.pending.count}"
puts "Processed: #{NatsPubsub::InboxEvent.processed.count}"
puts "Failed: #{NatsPubsub::InboxEvent.failed.count}"

# Failed events
NatsPubsub::OutboxEvent.failed.each do |event|
  puts "Event #{event.event_id}: #{event.last_error}"
end
```

---

## See Also

- [JavaScript API Reference](./javascript-api.md)
- [Ruby API Reference](./ruby-api.md)
- [Configuration Reference](./configuration.md)
- [Deployment Guide](../guides/deployment.md)
- [Monitoring Guide](../guides/monitoring.md)
