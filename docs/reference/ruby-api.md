# Ruby API Reference

Complete API reference for the NatsPubsub Ruby library.

## Table of Contents

- [Core Module](#core-module)
- [Publisher API](#publisher-api)
- [Subscriber API](#subscriber-api)
- [Pool API](#pool-api)
- [Outbox Pattern API](#outbox-pattern-api)
- [Middleware API](#middleware-api)
- [Configuration API](#configuration-api)
- [Models](#models)
- [Utilities](#utilities)
- [ActiveRecord Integration](#activerecord-integration)

---

## Core Module

### NatsPubsub

The main module for all NatsPubsub functionality.

#### Module Methods

##### `configure(overrides = {}, &block)`

Configure the library with custom settings.

**Parameters:**

- `overrides` - Hash of configuration overrides
- `block` - Optional block for configuration

**Returns:** `Config` - Configuration object

**Example:**

```ruby
NatsPubsub.configure do |config|
  config.env = 'production'
  config.app_name = 'my-service'
  config.nats_urls = 'nats://nats.example.com:4222'
  config.concurrency = 10
  config.use_dlq = true
  config.use_outbox = true
  config.use_inbox = true
end
```

##### `config`

Get the current configuration.

**Returns:** `Config` - Current configuration object

**Example:**

```ruby
config = NatsPubsub.config
puts "Environment: #{config.env}"
puts "App Name: #{config.app_name}"
```

##### `reset!`

Reset configuration to defaults.

**Example:**

```ruby
NatsPubsub.reset!
```

##### `use_outbox?`

Check if outbox pattern is enabled.

**Returns:** `Boolean`

##### `use_inbox?`

Check if inbox pattern is enabled.

**Returns:** `Boolean`

##### `use_dlq?`

Check if dead letter queue is enabled.

**Returns:** `Boolean`

##### `ensure_topology!`

Establish connection and ensure stream topology.

**Returns:** JetStream context

**Example:**

```ruby
NatsPubsub.ensure_topology!
puts "Topology ensured"
```

##### `publish(topic:, message:, **options)`

Publish a message to a topic.

**Parameters:**

- `topic` - Topic name (e.g., 'orders.created', 'notifications.email.send')
- `message` - Message payload (Hash)
- `options` - Additional options (event_id, trace_id, correlation_id, occurred_at, message_type)

**Returns:** `PublishResult` - Result object with success status and details

**Example:**

```ruby
# Simple publish
result = NatsPubsub.publish(
  topic: 'orders.created',
  message: { order_id: '123', amount: 99.99 }
)
puts "Published: #{result.event_id}" if result.success?

# With metadata
result = NatsPubsub.publish(
  topic: 'orders.created',
  message: { order_id: '123' },
  trace_id: 'trace-123',
  correlation_id: 'corr-456'
)
```

##### `batch(&block)`

Create a batch publisher for publishing multiple messages efficiently.

**Yields:** `FluentBatch` - Batch publisher instance

**Returns:** `FluentBatch` - Batch publisher instance for chaining

**Example:**

```ruby
# Block syntax
result = NatsPubsub.batch do |b|
  b.add 'user.created', { id: 1, name: 'Alice' }
  b.add 'user.created', { id: 2, name: 'Bob' }
  b.with_options trace_id: 'batch-123'
end.publish

# Chaining syntax
result = NatsPubsub.batch
  .add('user.created', { id: 1 })
  .add('notification.sent', { user_id: 1 })
  .publish
```

##### `setup!(&block)`

Configure and initialize in one call.

**Yields:** `Config` - Configuration block

**Returns:** JetStream context

**Example:**

```ruby
NatsPubsub.setup! do |config|
  config.app_name = 'my_app'
  config.nats_urls = ['nats://localhost:4222']
  config.env = 'production'
end
```

##### `setup_with_preset!(preset, &block)`

Setup with a configuration preset.

**Parameters:**

- `preset` - Preset name (:development, :production, :testing)

**Yields:** `Config` - Configuration block for customization

**Returns:** JetStream context

**Example:**

```ruby
NatsPubsub.setup_with_preset!(:production) do |config|
  config.nats_urls = ENV['NATS_URLS']
  config.app_name = 'my-app'
end
```

##### `connect!`

Connect to NATS (idempotent).

**Returns:** JetStream context

**Example:**

```ruby
NatsPubsub.connect!
```

##### `health_check`

Perform comprehensive health check.

**Returns:** `Core::HealthCheck::Result` - Health check result

**Example:**

```ruby
status = NatsPubsub.health_check
puts "Status: #{status.status}"
puts "Healthy: #{status.healthy?}"
```

##### `quick_health_check`

Perform quick health check (connection only).

**Returns:** `Core::HealthCheck::Result` - Health check result

**Example:**

```ruby
status = NatsPubsub.quick_health_check
puts "Healthy: #{status.healthy?}"
```

##### `health_check_middleware`

Get health check middleware for Rack apps.

**Returns:** `Proc` - Rack middleware

**Example:**

```ruby
# Sinatra
get '/health' do
  status, headers, body = NatsPubsub.health_check_middleware.call(env)
  [status, headers, body]
end

# Rails
get '/health', to: NatsPubsub.health_check_middleware
```

##### `quick_health_check_middleware`

Get quick health check middleware for Rack apps.

**Returns:** `Proc` - Rack middleware

---

## Publisher API

### Publisher Class

Handles message publishing to NATS JetStream.

#### Constructor

```ruby
Publisher.new
```

**Example:**

```ruby
publisher = NatsPubsub::Publisher.new
```

#### Methods

##### `publish(*args, **kwargs)`

Polymorphic publish method supporting multiple patterns.

**Signatures:**

1. Topic-based (positional): `publish(topic, message, **opts)`
2. Topic-based (keyword): `publish(topic:, message:, **opts)`
3. Domain/resource/action: `publish(domain:, resource:, action:, payload:, **opts)`
4. Multi-topic: `publish(topics:, message:, **opts)`

**Returns:** `PublishResult` or `Hash` of results

**Examples:**

```ruby
# Topic-based (positional)
result = publisher.publish('orders.created', { order_id: '123' })

# Topic-based (keyword)
result = publisher.publish(
  topic: 'orders.created',
  message: { order_id: '123' }
)

# Domain/resource/action
result = publisher.publish(
  domain: 'orders',
  resource: 'order',
  action: 'created',
  payload: { id: '123' }
)

# Multi-topic
results = publisher.publish(
  topics: ['orders.created', 'notifications.sent'],
  message: { id: '123' }
)
```

##### `publish_to_topic(topic, message, **options)`

Publish to a single topic (internal method).

**Parameters:**

- `topic` - Topic name
- `message` - Message payload
- `options` - Additional options

**Returns:** `PublishResult`

##### `publish_event(domain, resource, action, payload, **options)`

Publish using domain/resource/action pattern (internal method).

**Parameters:**

- `domain` - Business domain
- `resource` - Resource type
- `action` - Event action
- `payload` - Event payload
- `options` - Additional options

**Returns:** `PublishResult`

##### `publish_to_topics(topics, message, **options)`

Publish to multiple topics (internal method).

**Parameters:**

- `topics` - Array of topic names
- `message` - Message payload
- `options` - Additional options

**Returns:** `Hash` - Results keyed by topic

### FluentBatch Class

Fluent interface for batch publishing.

#### Methods

##### `add(topic, message)`

Add a message to the batch.

**Parameters:**

- `topic` - Topic name
- `message` - Message payload

**Returns:** `self` - For chaining

##### `with_options(options)`

Set options for all messages in the batch.

**Parameters:**

- `options` - Publish options

**Returns:** `self` - For chaining

##### `publish`

Publish all messages in the batch.

**Returns:** `FluentBatch::Result` - Result with statistics

**Example:**

```ruby
result = NatsPubsub.batch
  .add('user.created', { id: 1, name: 'Alice' })
  .add('user.created', { id: 2, name: 'Bob' })
  .add('notification.sent', { user_id: 1 })
  .with_options(trace_id: 'batch-123')
  .publish

puts "Success: #{result.success_count}, Failed: #{result.failure_count}"
```

---

## Subscriber API

### Subscriber Module

Include this module in your subscriber classes to handle NATS JetStream messages.

#### Class Methods

##### `subscribe_to(*topics, **options)`

Subscribe to one or more topics.

**Parameters:**

- `topics` - Topic names to subscribe to
- `options` - Additional subscription options

**Example:**

```ruby
class NotificationSubscriber
  include NatsPubsub::Subscriber

  subscribe_to 'notifications.email'
  # or with multiple topics
  subscribe_to 'notifications.email', 'notifications.sms'
  # or with wildcards
  subscribe_to 'users.user.*'

  jetstream_options retry: 3, ack_wait: 60

  def handle(message, context)
    # Handle the message
    puts "Received: #{message}"
    puts "Event ID: #{context.event_id}"
    puts "Trace ID: #{context.trace_id}"
  end
end
```

##### `subscribe_to_wildcard(topic, **options)`

Subscribe to all subtopics using wildcard (>).

**Parameters:**

- `topic` - Topic name
- `options` - Additional subscription options

**Example:**

```ruby
class AllNotificationsSubscriber
  include NatsPubsub::Subscriber

  subscribe_to_wildcard 'notifications'  # Subscribes to notifications.>

  def handle(message, context)
    puts "Notification on topic: #{context.topic}"
  end
end
```

##### `jetstream_options(opts = {})`

Configure JetStream-specific options.

**Parameters:**

- `opts` - Options hash

**Options:**

- `:retry` - Number of retries (default: 5)
- `:ack_wait` - ACK wait timeout in seconds (default: 30)
- `:max_deliver` - Maximum delivery attempts (default: 5)
- `:dead_letter` - Enable DLQ (default: true)
- `:batch_size` - Batch size for fetching (default: 25)

**Returns:** `Hash` - Merged options

**Example:**

```ruby
class EmailSubscriber
  include NatsPubsub::Subscriber

  subscribe_to 'notifications.email'
  jetstream_options retry: 3, ack_wait: 60, max_deliver: 10

  def handle(message, context)
    send_email(message)
  end
end
```

##### `topic_subscriptions`

Get all topic subscriptions.

**Returns:** `Array<Hash>` - Array of subscription hashes

##### `all_subscriptions`

Get all subscriptions.

**Returns:** `Array<Hash>` - Array of all subscription hashes

#### Instance Methods

##### `handle(message, context)`

Override this method to handle messages.

**Parameters:**

- `message` - Message payload (Hash)
- `context` - Message context (Core::MessageContext)

**Raises:** `NotImplementedError` - If not overridden

**Example:**

```ruby
def handle(message, context)
  # Your message processing logic
  OrderService.create_order(message)

  # Access context information
  logger.info "Processed event #{context.event_id}"
  logger.info "Trace: #{context.trace_id}"
  logger.info "Delivery attempt: #{context.deliveries}"
end
```

##### `on_error(error_context)`

Optional: Override for custom error handling.

**Parameters:**

- `error_context` - Error context (Core::ErrorContext)

**Returns:** `Symbol` - Error action (:retry, :discard, :dlq)

**Example:**

```ruby
def on_error(error_context)
  case error_context.error
  when ValidationError
    Core::ErrorAction::DISCARD
  when NetworkError
    Core::ErrorAction::RETRY
  else
    Core::ErrorAction::DLQ
  end
end
```

##### `logger`

Access to logger.

**Returns:** `Logger` - Logger instance

##### `from_topic?(context, topic_name)`

Check if message is from a specific topic.

**Parameters:**

- `context` - Message context
- `topic_name` - Topic name to check

**Returns:** `Boolean`

**Example:**

```ruby
def handle(message, context)
  if from_topic?(context, 'notifications.email')
    send_email(message)
  elsif from_topic?(context, 'notifications.sms')
    send_sms(message)
  end
end
```

---

## Pool API

### Pool Class

Manages concurrent subscriber workers.

#### Constructor

```ruby
Pool.new(concurrency: 5)
```

**Parameters:**

- `concurrency` - Number of concurrent workers (default: 5)

#### Methods

##### `start!`

Start the worker pool.

**Example:**

```ruby
pool = NatsPubsub::Subscribers::Pool.new(concurrency: 10)
pool.start!
```

##### `stop!`

Stop the worker pool gracefully.

**Example:**

```ruby
pool.stop!
```

---

## Outbox Pattern API

### OutboxPublisher Class

Handles publishing messages using the Outbox pattern.

#### Class Methods

##### `publish(subject:, envelope:, event_id:, &block)`

Publish using the Outbox pattern.

**Parameters:**

- `subject` - NATS subject
- `envelope` - Message envelope
- `event_id` - Event identifier
- `block` - Block containing actual publish logic

**Returns:** `PublishResult`

**Example:**

```ruby
OutboxPublisher.publish(
  subject: subject,
  envelope: envelope,
  event_id: event_id
) do
  # Actual NATS publish
  jts.publish(subject, Oj.dump(envelope), header: headers)
end
```

### OutboxRepository Class

Persistence layer for outbox events.

#### Methods

##### `find_or_create(params)`

Find or create an outbox event.

**Parameters:**

- `params` - Event parameters

**Returns:** `OutboxEvent` - Outbox event model

##### `find_pending(limit: 100)`

Find pending events.

**Parameters:**

- `limit` - Maximum number of events

**Returns:** `Array<OutboxEvent>`

##### `mark_as_sent(event_id)`

Mark event as sent.

**Parameters:**

- `event_id` - Event identifier

##### `mark_as_failed(event_id, error)`

Mark event as failed.

**Parameters:**

- `event_id` - Event identifier
- `error` - Error message

##### `cleanup(older_than)`

Cleanup old sent events.

**Parameters:**

- `older_than` - Date threshold

**Returns:** `Integer` - Number of deleted events

---

## Middleware API

### Middleware::Chain Class

Manages middleware execution chain.

#### Methods

##### `add(middleware)`

Add middleware to the chain.

**Parameters:**

- `middleware` - Middleware instance

##### `call(message, context, &handler)`

Execute the middleware chain.

**Parameters:**

- `message` - Message payload
- `context` - Message context
- `handler` - Final handler block

### Built-in Middleware

#### Logging Middleware

Logs message processing.

**Example:**

```ruby
NatsPubsub.config.server_middleware do |chain|
  chain.add NatsPubsub::Middleware::Logging.new
end
```

#### StructuredLogging Middleware

Structured logging with context.

**Example:**

```ruby
NatsPubsub.config.server_middleware do |chain|
  chain.add NatsPubsub::Middleware::StructuredLogging.new
end
```

#### ActiveRecord Middleware

ActiveRecord connection management.

**Example:**

```ruby
NatsPubsub.config.server_middleware do |chain|
  chain.add NatsPubsub::Middleware::ActiveRecord.new
end
```

### Custom Middleware

**Example:**

```ruby
class TimingMiddleware
  def call(message, context)
    start_time = Time.now
    yield
    duration = Time.now - start_time
    puts "Processing took #{duration}s"
  end
end

NatsPubsub.config.server_middleware do |chain|
  chain.add TimingMiddleware.new
end
```

---

## Configuration API

### Config Class

Configuration object.

#### Attributes

- `nats_urls` - NATS server URL(s)
- `env` - Environment name
- `app_name` - Application name
- `destination_app` - Destination application name
- `max_deliver` - Maximum delivery attempts
- `ack_wait` - Acknowledgment wait time
- `backoff` - Backoff strategy
- `use_outbox` - Enable outbox pattern
- `use_inbox` - Enable inbox pattern
- `inbox_model` - Inbox model class name
- `outbox_model` - Outbox model class name
- `use_dlq` - Enable dead letter queue
- `dlq_max_attempts` - DLQ max attempts
- `dlq_stream_suffix` - DLQ stream suffix
- `logger` - Logger instance
- `concurrency` - Concurrency level
- `connection_pool_size` - Connection pool size
- `connection_pool_timeout` - Connection pool timeout

#### Methods

##### `initialize(preset: nil)`

Create a new configuration.

**Parameters:**

- `preset` - Optional preset name

##### `stream_name`

Get stream name for the environment.

**Returns:** `String` - Stream name

**Example:**

```ruby
config.stream_name
# => "production-events-stream"
```

##### `event_subject(domain, resource, action)`

Build event subject.

**Parameters:**

- `domain` - Business domain
- `resource` - Resource type
- `action` - Event action

**Returns:** `String` - NATS subject

**Example:**

```ruby
subject = config.event_subject('orders', 'order', 'created')
# => "production.myapp.orders.order.created"
```

##### `dlq_subject`

Get DLQ subject.

**Returns:** `String` - DLQ subject

##### `dlq_stream_name`

Get DLQ stream name.

**Returns:** `String` - DLQ stream name

##### `durable_name`

Get durable consumer name.

**Returns:** `String` - Durable name

##### `server_middleware(&block)`

Access/configure server middleware.

**Yields:** `Middleware::Chain` - Middleware chain

**Returns:** `Middleware::Chain`

**Example:**

```ruby
config.server_middleware do |chain|
  chain.add CustomMiddleware.new
end
```

##### `apply_preset!(preset_name)`

Apply a configuration preset.

**Parameters:**

- `preset_name` - Preset name (:development, :production, :testing)

**Example:**

```ruby
config.apply_preset!(:production)
```

##### `validate!`

Validate configuration. Raises `ConfigurationError` if invalid.

**Example:**

```ruby
begin
  config.validate!
rescue NatsPubsub::ConfigurationError => e
  puts "Invalid config: #{e.message}"
end
```

---

## Models

### OutboxEvent Model

ActiveRecord model for outbox events.

#### Attributes

- `event_id` - Event identifier (string)
- `subject` - NATS subject (string)
- `payload` - Message payload (text)
- `headers` - Message headers (text)
- `status` - Event status (string: 'pending', 'publishing', 'sent', 'failed')
- `attempts` - Number of attempts (integer)
- `last_error` - Last error message (text)
- `enqueued_at` - Enqueued timestamp (datetime)
- `sent_at` - Sent timestamp (datetime)

#### Scopes

- `pending` - Events with pending status
- `failed` - Events with failed status
- `sent` - Events with sent status

**Example:**

```ruby
# Find pending events
pending = NatsPubsub::OutboxEvent.pending.limit(100)

# Find failed events
failed = NatsPubsub::OutboxEvent.failed

# Cleanup old sent events
old_events = NatsPubsub::OutboxEvent.sent.where('sent_at < ?', 7.days.ago)
old_events.delete_all
```

### InboxEvent Model

ActiveRecord model for inbox events.

#### Attributes

- `event_id` - Event identifier (string)
- `subject` - NATS subject (string)
- `payload` - Message payload (text)
- `headers` - Message headers (text)
- `status` - Event status (string: 'pending', 'processing', 'processed', 'failed')
- `deliveries` - Number of deliveries (integer)
- `last_error` - Last error message (text)
- `received_at` - Received timestamp (datetime)
- `processed_at` - Processed timestamp (datetime)

#### Scopes

- `pending` - Events with pending status
- `failed` - Events with failed status
- `processed` - Events with processed status

**Example:**

```ruby
# Check if already processed
event = NatsPubsub::InboxEvent.find_by(event_id: 'event-123')
if event&.processed?
  puts "Already processed"
end

# Find failed events for retry
failed = NatsPubsub::InboxEvent.failed.limit(10)
```

---

## Utilities

### Subject Class

Subject parsing and building utilities.

#### Class Methods

##### `from_event(env:, app_name:, domain:, resource:, action:)`

Build NATS subject from event components.

**Parameters:**

- `env` - Environment name
- `app_name` - Application name
- `domain` - Business domain
- `resource` - Resource type
- `action` - Event action

**Returns:** `Subject` - Subject object

**Example:**

```ruby
subject = NatsPubsub::Subject.from_event(
  env: 'production',
  app_name: 'myapp',
  domain: 'orders',
  resource: 'order',
  action: 'created'
)
puts subject.to_s
# => "production.myapp.orders.order.created"
```

##### `from_topic(env:, app_name:, topic:)`

Build NATS subject from topic.

**Parameters:**

- `env` - Environment name
- `app_name` - Application name
- `topic` - Topic name

**Returns:** `Subject` - Subject object

**Example:**

```ruby
subject = NatsPubsub::Subject.from_topic(
  env: 'production',
  app_name: 'myapp',
  topic: 'orders.created'
)
puts subject.to_s
# => "production.myapp.orders.created"
```

##### `parse(subject_string)`

Parse NATS subject string.

**Parameters:**

- `subject_string` - Subject string

**Returns:** `Subject` - Subject object

**Example:**

```ruby
subject = NatsPubsub::Subject.parse('production.myapp.orders.created')
puts subject.env         # => "production"
puts subject.app_name    # => "myapp"
puts subject.topic       # => "orders.created"
```

##### `normalize_topic(name)`

Normalize topic name.

**Parameters:**

- `name` - Topic name

**Returns:** `String` - Normalized topic

### Duration Module

Duration parsing utilities.

#### Module Methods

##### `parse(str)`

Parse duration string.

**Parameters:**

- `str` - Duration string (e.g., '30s', '5m', '1h')

**Returns:** `Integer` - Duration in milliseconds

**Example:**

```ruby
ms = NatsPubsub::Duration.parse('30s')  # => 30000
ms = NatsPubsub::Duration.parse('5m')   # => 300000
ms = NatsPubsub::Duration.parse('1h')   # => 3600000
```

##### `to_nanos(milliseconds)`

Convert milliseconds to nanoseconds.

**Parameters:**

- `milliseconds` - Duration in milliseconds

**Returns:** `Integer` - Duration in nanoseconds

##### `from_nanos(nanoseconds)`

Convert nanoseconds to milliseconds.

**Parameters:**

- `nanoseconds` - Duration in nanoseconds

**Returns:** `Integer` - Duration in milliseconds

### Error Classes

- `NatsPubsub::Error` - Base error class
- `NatsPubsub::ConfigurationError` - Configuration errors
- `NatsPubsub::ConnectionError` - Connection errors
- `NatsPubsub::PublishError` - Publishing errors
- `NatsPubsub::SubscriptionError` - Subscription errors

**Example:**

```ruby
begin
  NatsPubsub.publish(topic: 'test', message: {})
rescue NatsPubsub::PublishError => e
  puts "Publish failed: #{e.message}"
end
```

---

## ActiveRecord Integration

### Publishable Module

Include in ActiveRecord models to enable automatic event publishing.

#### Class Methods

##### `publishes_event(event_name, if: nil, unless: nil, &block)`

Configure automatic event publishing.

**Parameters:**

- `event_name` - Event name or :auto for automatic naming
- `if` - Conditional proc/symbol
- `unless` - Negative conditional proc/symbol
- `block` - Block to customize event payload

**Example:**

```ruby
class Order < ApplicationRecord
  include NatsPubsub::ActiveRecord::Publishable

  # Automatic event publishing on create
  publishes_event :created, on: :create

  # With custom payload
  publishes_event :updated, on: :update do |order|
    {
      id: order.id,
      status: order.status,
      total: order.total,
      updated_at: order.updated_at
    }
  end

  # With conditions
  publishes_event :completed, on: :update, if: :status_changed_to_completed?

  private

  def status_changed_to_completed?
    saved_change_to_status? && status == 'completed'
  end
end

# Usage
order = Order.create!(total: 99.99)
# Automatically publishes to 'orders.order.created'

order.update!(status: 'shipped')
# Automatically publishes to 'orders.order.updated'
```

#### Instance Methods

##### `publish_event(action, payload = nil)`

Manually publish an event.

**Parameters:**

- `action` - Event action
- `payload` - Optional payload (defaults to model attributes)

**Example:**

```ruby
order = Order.find(123)
order.publish_event(:shipped, {
  id: order.id,
  shipped_at: Time.now
})
```

---

## Rails Integration

### Railtie

Automatic Rails integration.

#### Rake Tasks

##### `nats_pubsub:install`

Install NatsPubsub in Rails app.

```bash
rails nats_pubsub:install
```

##### `nats_pubsub:config`

Generate configuration file.

```bash
rails generate nats_pubsub:config
```

##### `nats_pubsub:subscriber NAME`

Generate a subscriber.

```bash
rails generate nats_pubsub:subscriber EmailNotification
```

##### `nats_pubsub:migrations`

Generate database migrations.

```bash
rails generate nats_pubsub:migrations
```

### Generators

#### Config Generator

```bash
rails generate nats_pubsub:config
```

Creates `config/initializers/nats_pubsub.rb`

#### Subscriber Generator

```bash
rails generate nats_pubsub:subscriber NotificationSubscriber
```

Creates `app/subscribers/notification_subscriber.rb`

#### Migrations Generator

```bash
rails generate nats_pubsub:migrations
```

Creates migrations for inbox and outbox tables.

---

## Testing Support

### Testing Module

Test helpers for NatsPubsub.

#### Methods

##### `enable_test_mode!`

Enable test mode (messages are captured, not published).

**Example:**

```ruby
RSpec.configure do |config|
  config.before(:each) do
    NatsPubsub::Testing.enable_test_mode!
  end

  config.after(:each) do
    NatsPubsub::Testing.reset!
  end
end
```

##### `disable_test_mode!`

Disable test mode.

##### `reset!`

Clear captured messages.

##### `published_messages`

Get captured messages.

**Returns:** `Array` - Array of published messages

**Example:**

```ruby
NatsPubsub.publish(topic: 'test', message: { id: 1 })

messages = NatsPubsub::Testing.published_messages
expect(messages.length).to eq(1)
expect(messages.first[:topic]).to eq('test')
```

### RSpec Matchers

#### `have_published_message`

Matcher for published messages.

**Example:**

```ruby
# Basic usage
expect(NatsPubsub).to have_published_message('orders.created')

# With message content
expect(NatsPubsub).to have_published_message('orders.created')
  .with_message(order_id: '123')

# With options
expect(NatsPubsub).to have_published_message('orders.created')
  .with_options(trace_id: 'trace-123')
```

---

## See Also

- [JavaScript API Reference](./javascript-api.md)
- [Configuration Reference](./configuration.md)
- [CLI Reference](./cli.md)
- [Getting Started with Ruby](../getting-started/ruby.md)
- [Topic-Based PubSub Guide](../guides/topics.md)
