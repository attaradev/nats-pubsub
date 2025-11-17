# NatsPubsub Ruby Examples

This directory contains Ruby examples for NatsPubsub, demonstrating various patterns and use cases.

## Examples

### Basic Usage

Simple publisher and subscriber examples:

```ruby
require 'nats_pubsub'

# Configure
NatsPubsub.configure do |config|
  config.nats_urls = ['nats://localhost:4222']
  config.env = 'development'
  config.app_name = 'my_app'
end

# Setup topology
NatsPubsub.ensure_topology!

# Publish
NatsPubsub.publish(
  topic: 'user.created',
  message: {
    user_id: '123',
    name: 'John Doe',
    email: 'john@example.com'
  }
)

# Subscribe
class UserCreatedSubscriber
  include NatsPubsub::Subscribers::Subscriber

  subscribe_to_topic 'user.created'

  def handle(message, context)
    puts "User created: #{message['name']}"
  end
end

# Register and start
NatsPubsub::Subscribers::Registry.register(UserCreatedSubscriber.new)
NatsPubsub::Subscribers::Pool.start
```

## Running Examples Locally

### Prerequisites

- Ruby 3.2+
- NATS Server with JetStream enabled
- PostgreSQL (for outbox/inbox examples)

### Setup

1. **Install dependencies:**

```bash
bundle install
```

2. **Start NATS Server:**

```bash
# Using Docker
docker run -d --name nats -p 4222:4222 nats:latest -js

# Or using NATS CLI
nats-server -js
```

3. **Run examples:**

```bash
# Basic publisher
ruby examples/basic_publisher.rb

# Basic subscriber
ruby examples/basic_subscriber.rb

# Topic-based patterns
ruby examples/topic_patterns.rb

# Error handling
ruby examples/error_handling.rb

# Batch publishing
ruby examples/batch_publishing.rb
```

## Example Patterns

### 1. Topic-Based Subscription

Subscribe to hierarchical topics with wildcards:

```ruby
# Subscribe to all user events
class AllUserEventsSubscriber
  include NatsPubsub::Subscribers::Subscriber

  subscribe_to_topic 'user.*'

  def handle(message, context)
    puts "User event: #{context.topic}"
  end
end

# Subscribe to specific event
class UserCreatedSubscriber
  include NatsPubsub::Subscribers::Subscriber

  subscribe_to_topic 'user.created'

  def handle(message, context)
    # Handle user creation
  end
end
```

### 2. Error Handling

```ruby
class OrderProcessorSubscriber
  include NatsPubsub::Subscribers::Subscriber

  subscribe_to_topic 'order.process', max_deliver: 5, ack_wait: 30_000

  def handle(message, context)
    # Process order
  end

  def on_error(error_context)
    error = error_context.error
    attempt = error_context.attempt_number
    max = error_context.max_attempts

    # Retry on transient errors
    return NatsPubsub::Core::ErrorAction::RETRY if error.message.include?('connection')

    # Send to DLQ on validation errors
    return NatsPubsub::Core::ErrorAction::DLQ if error.is_a?(ArgumentError)

    # Retry with backoff
    return NatsPubsub::Core::ErrorAction::RETRY if attempt < max

    NatsPubsub::Core::ErrorAction::DLQ
  end
end
```

### 3. Batch Publishing

```ruby
# Publish multiple messages efficiently
result = NatsPubsub.batch do |b|
  b.add 'user.created', { id: 1, name: 'Alice' }
  b.add 'user.created', { id: 2, name: 'Bob' }
  b.add 'notification.sent', { user_id: 1 }
  b.with_options trace_id: 'batch-123'
end.publish

puts "Published #{result.success_count} messages"
```

### 4. Outbox Pattern

Reliable message publishing with database transactions:

```ruby
NatsPubsub.configure do |config|
  # ...
  config.use_outbox = true
end

# Messages are stored in database first, then published
NatsPubsub.publish(topic: 'order.created', message: order_data)
```

### 5. Inbox Pattern

Idempotent message processing:

```ruby
NatsPubsub.configure do |config|
  # ...
  config.use_inbox = true
end

# Duplicate messages are automatically deduplicated
```

### 6. ActiveRecord Integration

```ruby
class Order < ApplicationRecord
  include NatsPubsub::ActiveRecord::Publishable

  after_create :publish_created_event

  private

  def publish_created_event
    publish_event(
      topic: 'order.created',
      message: {
        order_id: id,
        user_id: user_id,
        total: total_amount
      }
    )
  end
end
```

### 7. Rails Integration

```ruby
# config/initializers/nats_pubsub.rb
NatsPubsub.configure do |config|
  config.env = Rails.env
  config.app_name = 'my_app'
  config.nats_urls = [ENV['NATS_URL'] || 'nats://localhost:4222']
  config.use_outbox = true
  config.use_inbox = true
  config.use_dlq = true
end

# config/application.rb
config.after_initialize do
  NatsPubsub.ensure_topology!
  NatsPubsub::Subscribers::Pool.start if Rails.env.production?
end
```

## Health Checks

```ruby
# Comprehensive health check
health = NatsPubsub.health_check
puts health.inspect
# {
#   status: 'healthy',
#   healthy: true,
#   components: {
#     nats: { status: 'healthy' },
#     jetstream: { status: 'healthy' }
#   }
# }

# Quick health check (connection only)
quick = NatsPubsub.quick_health_check

# In Sinatra/Rack app
get '/health' do
  status, headers, body = NatsPubsub.health_check_middleware.call(env)
  [status, headers, body]
end

# In Rails
get '/health', to: NatsPubsub.health_check_middleware
```

## Testing

```ruby
require 'nats_pubsub/testing'

RSpec.describe UserService do
  include NatsPubsub::Testing::Helpers

  before do
    setup_nats_pubsub_testing
  end

  after do
    teardown_nats_pubsub_testing
  end

  it 'publishes user.created event' do
    user_service.create_user(name: 'Alice')

    expect(NatsPubsub).to have_published('user.created')
      .with_message(hash_including(name: 'Alice'))
  end

  it 'processes events' do
    expect {
      trigger_event('user.created', { name: 'Bob' })
    }.to change { User.count }.by(1)
  end
end
```

## Configuration Presets

```ruby
# Development preset
NatsPubsub.setup_with_preset!(:development) do |config|
  config.app_name = 'my_app'
end

# Production preset
NatsPubsub.setup_with_preset!(:production) do |config|
  config.app_name = 'my_app'
  config.nats_urls = ENV['NATS_URLS'].split(',')
end

# Testing preset
NatsPubsub.setup_with_preset!(:testing) do |config|
  config.app_name = 'my_app'
end
```

## Generators

NatsPubsub provides Rails generators for quick setup:

```bash
# Install NatsPubsub
rails generate nats_pubsub:install

# Generate configuration
rails generate nats_pubsub:config

# Generate migrations
rails generate nats_pubsub:migrations

# Generate subscriber
rails generate nats_pubsub:subscriber UserCreated
```

## Complete Examples

See the [microservices example](../microservices) for a complete, production-ready implementation featuring:

- Multiple services (Node.js and Ruby)
- Event-driven workflows
- Saga pattern
- Docker Compose setup
- Health checks
- Error handling
- And more!

## API Reference

For complete API documentation, see:

- [Main Documentation](../../README.md)
- [Ruby API Docs](../../packages/ruby/README.md)

## Common Patterns

### Publisher-Subscriber

```ruby
# Publisher
NatsPubsub.publish(topic: 'event.happened', message: { data: 'value' })

# Subscriber
class EventSubscriber
  include NatsPubsub::Subscribers::Subscriber

  subscribe_to_topic 'event.happened'

  def handle(message, context)
    puts "Event received: #{message.inspect}"
  end
end
```

### Request-Reply (via topics)

```ruby
# Requester
correlation_id = SecureRandom.uuid
NatsPubsub.publish(
  topic: 'query.user',
  message: { user_id: '123', correlation_id: correlation_id }
)

# Responder
class UserQuerySubscriber
  include NatsPubsub::Subscribers::Subscriber

  subscribe_to_topic 'query.user'

  def handle(message, context)
    user = User.find(message['user_id'])
    NatsPubsub.publish(
      topic: 'query.user.response',
      message: {
        correlation_id: message['correlation_id'],
        user: user.as_json
      }
    )
  end
end
```

### Fan-Out

```ruby
# Publish to multiple topics
NatsPubsub::Publisher.new.publish_to_topics(
  ['analytics.event', 'audit.log', 'notifications.alert'],
  { action: 'user_login', user_id: '123' }
)
```

## Best Practices

1. **Use Strong Parameters**: Validate message payloads
2. **Handle Errors**: Implement `on_error` for fine-grained control
3. **Enable DLQ**: Always use dead letter queues in production
4. **Add Tracing**: Include trace_id for distributed tracing
5. **Health Checks**: Expose health check endpoints
6. **Graceful Shutdown**: Handle SIGTERM properly
7. **Test Thoroughly**: Use testing helpers
8. **Monitor**: Track message rates and errors
9. **Document Events**: Maintain an event catalog
10. **Use Transactions**: Combine with outbox pattern

## Troubleshooting

### Connection Issues

```ruby
# Check NATS connection
health = NatsPubsub.quick_health_check
puts health.inspect

# Enable debug logging
NatsPubsub.configure do |config|
  config.logger = Logger.new($stdout, level: Logger::DEBUG)
end
```

### Message Not Received

1. Check subscriber is registered before starting pool
2. Verify topic pattern matches
3. Check for errors in subscriber
4. Verify JetStream is enabled
5. Check stream configuration

### Performance Issues

1. Increase concurrency
2. Use batch publishing
3. Scale horizontally
4. Optimize message size
5. Use connection pooling

## Web UI

NatsPubsub includes a web UI for monitoring (requires Sinatra):

```ruby
# In config.ru or Rails routes
require 'nats_pubsub/web'

# Mount the web UI
mount NatsPubsub::Web, at: '/nats_pubsub'
```

Access at: http://localhost:3000/nats_pubsub

Features:

- View published events
- Monitor subscribers
- Inspect DLQ messages
- Health checks
- Real-time statistics

## Next Steps

- Explore the [Microservices Example](../microservices)
- Read the [Main Documentation](../../README.md)
- Check out [JavaScript Examples](../javascript)
- Learn about [NATS JetStream](https://docs.nats.io/nats-concepts/jetstream)
- Read the [Rails Quick Start](../../packages/ruby/RAILS_QUICK_START.md)
