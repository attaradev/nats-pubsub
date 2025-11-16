# Ruby Overview

NatsPubsub for Ruby provides a production-ready, declarative pub/sub messaging library with deep Rails integration and reliability patterns.

## Why NatsPubsub for Ruby?

- **Rails Native**: Deep ActiveRecord integration with automatic event publishing
- **Declarative API**: Clean, class-based subscribers inspired by Rails conventions
- **Reliability**: Built-in Inbox/Outbox patterns and Dead Letter Queue
- **Testing**: Comprehensive RSpec matchers and test helpers
- **Production-Ready**: Battle-tested in production Ruby applications

## Installation

### Standalone Ruby

```bash
gem install nats_pubsub
```

### Rails Application

Add to your Gemfile:

```ruby
gem 'nats_pubsub'
```

Then run:

```bash
bundle install
rails generate nats_pubsub:install
rails db:migrate
```

## Quick Start

### 1. Configure

```ruby
# config/initializers/nats_pubsub.rb (Rails)
# or at the top of your script
NatsPubsub.configure do |config|
  config.nats_urls = ENV.fetch('NATS_URLS', 'nats://localhost:4222')
  config.env = ENV.fetch('RAILS_ENV', 'development')
  config.app_name = 'my-app'
  config.concurrency = 10
end
```

### 2. Publish Events

#### Direct Publishing

```ruby
NatsPubsub.publish('user.created', {
  user_id: '123',
  email: 'user@example.com',
  name: 'John Doe'
})
```

#### ActiveRecord Integration

```ruby
class User < ApplicationRecord
  include NatsPubsub::ActiveRecord::Publishable

  publishes_events topic_prefix: 'user'
end

# Automatically publishes events:
User.create!(email: 'test@example.com')  # => user.created
user.update!(name: 'New Name')           # => user.updated
user.destroy!                            # => user.deleted
```

### 3. Subscribe to Events

```ruby
class UserCreatedSubscriber < NatsPubsub::Subscriber
  subscribe_to 'user.created'

  def handle(message, context)
    logger.info "User created: #{message['email']}"

    # Send welcome email
    UserMailer.welcome_email(message['email']).deliver_later
  end
end

# Start subscribers
NatsPubsub::Manager.start
```

## Key Features

### 1. Wildcard Subscriptions

```ruby
class UserEventSubscriber < NatsPubsub::Subscriber
  subscribe_to 'user.*'  # Matches user.created, user.updated, user.deleted

  def handle(message, context)
    case context.topic
    when 'user.created'
      handle_created(message)
    when 'user.updated'
      handle_updated(message)
    when 'user.deleted'
      handle_deleted(message)
    end
  end
end
```

### 2. Conditional Publishing

```ruby
class Order < ApplicationRecord
  include NatsPubsub::ActiveRecord::Publishable

  publishes_events topic_prefix: 'order',
                   on_update: -> { status_changed? },
                   if: :should_publish?

  def should_publish?
    !imported? # Don't publish imported records
  end
end
```

### 3. Filtering Sensitive Data

```ruby
class User < ApplicationRecord
  include NatsPubsub::ActiveRecord::Publishable

  publishes_events topic_prefix: 'user',
                   except: [:password_digest, :api_token, :ssn]
end
```

### 4. Error Handling

```ruby
class PaymentSubscriber < NatsPubsub::Subscriber
  subscribe_to 'payment.received'

  # Configure retry behavior
  max_retries 5
  retry_backoff :exponential

  def handle(message, context)
    process_payment(message)
  rescue PaymentGatewayError => e
    # Retry
    raise
  rescue InvalidPaymentError => e
    # Don't retry, send to DLQ
    context.terminate!
  end
end
```

## Rails Integration

### Generators

#### Install

```bash
rails generate nats_pubsub:install
```

Creates:

- Configuration file
- Outbox/Inbox migrations
- Initializer

#### Create Subscriber

```bash
rails generate nats_pubsub:subscriber UserNotification user.created
```

Creates:

- `app/subscribers/user_notification_subscriber.rb`
- `spec/subscribers/user_notification_subscriber_spec.rb`

### ActiveRecord Integration

#### Basic Usage

```ruby
class Article < ApplicationRecord
  include NatsPubsub::ActiveRecord::Publishable

  publishes_events topic_prefix: 'article'
end
```

#### Advanced Options

```ruby
class Product < ApplicationRecord
  include NatsPubsub::ActiveRecord::Publishable

  publishes_events topic_prefix: 'product',
                   only: [:name, :price, :sku],        # Include only these fields
                   except: [:internal_notes],          # Exclude these fields
                   on_create: true,                    # Publish on create (default)
                   on_update: -> { price_changed? },   # Conditional update publishing
                   on_destroy: true,                   # Publish on destroy (default)
                   if: :published?                     # Global condition

  def published?
    status == 'published'
  end
end
```

### Background Jobs

```ruby
class ProcessOrderJob < ApplicationJob
  queue_as :default

  def perform(order_id)
    order = Order.find(order_id)

    # Publish event
    NatsPubsub.publish('order.processed', {
      order_id: order.id,
      status: order.status,
      total: order.total
    })
  end
end
```

## Reliability Patterns

### Outbox Pattern

Guarantees message delivery by storing events in the database before publishing:

```ruby
# Enable in config
NatsPubsub.configure do |config|
  config.use_outbox = true
end

# Now all publishes go through the outbox
User.create!(email: 'test@example.com')
# => Stores in nats_pubsub_outbox table
# => Background worker publishes to NATS
```

### Inbox Pattern

Ensures exactly-once processing through deduplication:

```ruby
# Enable in config
NatsPubsub.configure do |config|
  config.use_inbox = true
end

# Messages are deduplicated by event_id
class OrderSubscriber < NatsPubsub::Subscriber
  subscribe_to 'order.created'

  def handle(message, context)
    # This will only process once per unique event_id
    process_order(message)
  end
end
```

### Dead Letter Queue

Failed messages automatically go to DLQ after max retries:

```ruby
# View DLQ messages
NatsPubsub::DLQConsumer.messages.each do |msg|
  puts "Failed: #{msg.subject}"
  puts "Error: #{msg.error}"
  puts "Attempts: #{msg.deliveries}"
end

# Retry a DLQ message
msg = NatsPubsub::DLQConsumer.messages.first
NatsPubsub::DLQConsumer.retry(msg)

# Discard a DLQ message
NatsPubsub::DLQConsumer.discard(msg)
```

## Testing

### RSpec Integration

```ruby
# spec/rails_helper.rb
require 'nats_pubsub/testing/helpers'

RSpec.configure do |config|
  NatsPubsub::Testing::RSpecConfiguration.configure(config)
end
```

### Test Publishing

```ruby
RSpec.describe User, nats_fake: true do
  it 'publishes user.created event' do
    expect { User.create!(email: 'test@example.com') }
      .to have_published_event('user.created')
  end

  it 'includes user data in event' do
    user = User.create!(email: 'test@example.com', name: 'John')

    event = last_nats_event
    expect(event[:message]['email']).to eq('test@example.com')
    expect(event[:message]['name']).to eq('John')
  end

  it 'excludes password from event' do
    user = User.create!(email: 'test@example.com', password: 'secret')

    expect(last_nats_event[:message]).not_to have_key('password')
  end
end
```

### Test Subscribers

```ruby
RSpec.describe UserNotificationSubscriber, nats_fake: true do
  subject(:subscriber) { described_class.new }

  let(:message) do
    { 'email' => 'test@example.com', 'name' => 'John' }
  end

  let(:context) do
    double(
      event_id: '123',
      topic: 'user.created',
      timestamp: Time.now
    )
  end

  it 'sends welcome email' do
    expect {
      subscriber.handle(message, context)
    }.to change { ActionMailer::Base.deliveries.count }.by(1)
  end
end
```

## Monitoring & Health Checks

### Health Endpoint

```ruby
# config/routes.rb
mount NatsPubsub::Rails::HealthEndpoint => '/nats-health'
```

Available endpoints:

- `GET /nats-health` - Full health check
- `GET /nats-health/liveness` - Kubernetes liveness
- `GET /nats-health/readiness` - Kubernetes readiness

### Instrumentation

```ruby
# config/initializers/nats_pubsub_monitoring.rb
ActiveSupport::Notifications.subscribe(/nats_pubsub/) do |name, start, finish, id, payload|
  duration = (finish - start) * 1000
  Rails.logger.info "#{name}: #{duration}ms"

  # Send to metrics service
  Metrics.timing(name, duration)
end

# Subscribe to errors only
ActiveSupport::Notifications.subscribe('nats_pubsub.error') do |*args|
  event = ActiveSupport::Notifications::Event.new(*args)
  ErrorTracker.notify(event.payload[:error])
end
```

## Production Configuration

```ruby
# config/initializers/nats_pubsub.rb
NatsPubsub.configure do |config|
  # Multiple NATS servers for failover
  config.nats_urls = ENV.fetch('NATS_URLS',
    'nats://nats1.prod:4222,nats://nats2.prod:4222,nats://nats3.prod:4222'
  )

  # Environment and app identification
  config.env = Rails.env
  config.app_name = 'my-app'

  # Performance tuning
  config.connection_pool_size = 20
  config.connection_pool_timeout = 10
  config.concurrency = 20

  # Reliability
  config.use_outbox = true
  config.use_inbox = true
  config.max_deliver = 10
  config.ack_wait = '60s'

  # Logging
  config.log_level = :info
  config.logger = Rails.logger
end
```

## Next Steps

- **Quick Start**: [Ruby Quick Start Guide](./quick-start-ruby.md)
- **Rails Integration**: [Rails Quick Start](./rails-quick-start.md)
- **Reliability**: [Inbox/Outbox Patterns](../patterns/inbox-outbox.md)
- **Testing**: [Testing Guide](../guides/testing.md)
- **Production**: [Deployment Guide](../guides/deployment.md)
- **API Reference**: [Ruby API Documentation](../reference/ruby-api.md)

## Examples

Check out complete Ruby examples:

- [Basic Usage Examples](https://github.com/attaradev/nats-pubsub/tree/main/packages/ruby/examples)
- [Rails Integration Example](https://github.com/attaradev/nats-pubsub/tree/main/examples/rails-app)

---

[← Installation](./installation.md) | [Back to Home](../index.md) | [Quick Start →](./quick-start-ruby.md)
