# NatsPubsub Rails Quick Start Guide

Get started with NatsPubsub in your Rails application in 5 minutes.

## Prerequisites

- Rails 7.0+
- Ruby 3.2+
- NATS Server with JetStream enabled
- PostgreSQL, MySQL, or SQLite (for outbox/inbox patterns)

## Installation

### 1. Add to Gemfile

```ruby
gem 'nats_pubsub'
```

```bash
bundle install
```

### 2. Run the Installer

```bash
rails generate nats_pubsub:install
```

This creates:

- `config/initializers/nats_pubsub.rb` - Configuration file
- `db/migrate/xxx_create_nats_pubsub_outbox.rb` - Outbox pattern migration
- `db/migrate/xxx_create_nats_pubsub_inbox.rb` - Inbox pattern migration

### 3. Run Migrations

```bash
rails db:migrate
```

### 4. Configure Environment

```bash
# .env or config/credentials
NATS_URLS=nats://localhost:4222
NATS_ENV=development
APP_NAME=my_app
```

## Basic Usage

### Publishing Events

#### Option 1: Direct Publishing

```ruby
# app/controllers/api/v1/users_controller.rb
class Api::V1::UsersController < ApplicationController
  # POST /api/v1/users
  def create
    @user = User.create!(user_params)

    # Publish event
    NatsPubsub.publish(topic: 'user.created', message: {
      id: @user.id,
      email: @user.email,
      name: @user.name
    })

    render json: @user, status: :created
  end

  private

  def user_params
    params.require(:user).permit(:name, :email)
  end
end
```

#### Option 2: ActiveRecord Integration (Recommended)

```ruby
# app/models/user.rb
class User < ApplicationRecord
  include NatsPubsub::ActiveRecord::Publishable

  publishes_events topic_prefix: 'user'
end
```

Now events are automatically published:

```ruby
User.create!(email: 'test@example.com')  # Publishes 'user.created'
user.update!(name: 'New Name')           # Publishes 'user.updated'
user.destroy!                            # Publishes 'user.deleted'
```

### Subscribing to Events

#### 1. Generate a Subscriber

```bash
rails generate nats_pubsub:subscriber UserNotification user.created
```

This creates:

- `app/subscribers/user_notification_subscriber.rb`
- `spec/subscribers/user_notification_subscriber_spec.rb`

#### 2. Implement Message Handling

```ruby
# app/subscribers/user_notification_subscriber.rb
class UserNotificationSubscriber < NatsPubsub::Subscriber
  subscribe_to 'user.created'

  def handle(message, context)
    logger.info "Processing: #{context.event_id}"
    logger.info "User created: #{message['email']}"

    # Send welcome email
    UserMailer.welcome_email(message['email']).deliver_later
  end
end
```

## Common Patterns

### Wildcard Subscriptions

```ruby
class UserEventSubscriber < NatsPubsub::Subscriber
  subscribe_to 'user.*'  # Matches user.created, user.updated, user.deleted

  def handle(message, context)
    case context.topic
    when 'user.created'
      handle_user_created(message)
    when 'user.updated'
      handle_user_updated(message)
    when 'user.deleted'
      handle_user_deleted(message)
    end
  end
end
```

### Filtering Sensitive Data

```ruby
class User < ApplicationRecord
  include NatsPubsub::ActiveRecord::Publishable

  publishes_events topic_prefix: 'user',
                   except: [:password_digest, :api_token]
end
```

### Conditional Publishing

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

## Reliability Patterns

### Outbox Pattern (Guaranteed Delivery)

Enable in config:

```ruby
# config/initializers/nats_pubsub.rb
NatsPubsub.configure do |config|
  config.use_outbox = true
end
```

Events are stored in the database before publishing, ensuring no message loss.

### Inbox Pattern (Idempotency)

Enable in config:

```ruby
NatsPubsub.configure do |config|
  config.use_inbox = true
end
```

Received events are deduplicated, ensuring handlers are idempotent.

### Dead Letter Queue (DLQ)

Enabled by default. Failed messages after max retries go to DLQ:

```ruby
# View DLQ messages
NatsPubsub::DLQConsumer.messages.each do |msg|
  puts "Failed: #{msg.subject}"
  puts "Error: #{msg.error}"
  puts "Attempts: #{msg.deliveries}"
end
```

## Testing

### Setup Test Helper

```ruby
# spec/rails_helper.rb
require 'nats_pubsub/testing/helpers'

RSpec.configure do |config|
  NatsPubsub::Testing::RSpecConfiguration.configure(config)
end
```

### Test Publishing

```ruby
# spec/models/user_spec.rb
RSpec.describe User, nats_fake: true do
  it 'publishes created event' do
    expect { User.create!(email: 'test@example.com') }
      .to have_published_event('user.created')
  end

  it 'excludes password from payload' do
    user = User.create!(email: 'test@example.com', password: 'secret')
    expect(last_nats_event[:message]).not_to have_key(:password)
  end
end
```

### Test Subscribers

```ruby
# spec/subscribers/user_notification_subscriber_spec.rb
RSpec.describe UserNotificationSubscriber, nats_fake: true do
  subject(:subscriber) { described_class.new }

  it 'sends welcome email' do
    message = { 'email' => 'test@example.com' }
    context = double(event_id: '123', topic: 'user.created')

    expect {
      subscriber.handle(message, context)
    }.to change { ActionMailer::Base.deliveries.count }.by(1)
  end
end
```

## Health Checks

### Add Health Endpoint

```ruby
# config/routes.rb
mount NatsPubsub::Rails::HealthEndpoint => '/nats-health'
```

Available endpoints:

- `GET /nats-health` - Full health check
- `GET /nats-health/quick` - Quick connection check
- `GET /nats-health/liveness` - Kubernetes liveness probe
- `GET /nats-health/readiness` - Kubernetes readiness probe

## Production Setup

### 1. Configure Multiple NATS Servers

```ruby
# config/initializers/nats_pubsub.rb
NatsPubsub.configure do |config|
  config.nats_urls = ENV.fetch('NATS_URLS',
    'nats://nats1.example.com:4222,nats://nats2.example.com:4222,nats://nats3.example.com:4222'
  )
end
```

### 2. Tune Performance

```ruby
NatsPubsub.configure do |config|
  config.connection_pool_size = 20
  config.connection_pool_timeout = 10
  config.concurrency = 20
  config.max_deliver = 10
  config.ack_wait = '60s'
end
```

### 3. Setup Kubernetes Health Probes

```yaml
# kubernetes/deployment.yaml
livenessProbe:
  httpGet:
    path: /nats-health/liveness
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /nats-health/readiness
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 5
```

## Common Use Cases

### User Registration Flow

```ruby
# app/models/user.rb
class User < ApplicationRecord
  include NatsPubsub::ActiveRecord::Publishable
  publishes_events topic_prefix: 'user'
end

# app/subscribers/user_registration_subscriber.rb
class UserRegistrationSubscriber < NatsPubsub::Subscriber
  subscribe_to 'user.created'

  def handle(message, context)
    # Send welcome email
    UserMailer.welcome_email(message['id']).deliver_later

    # Create default preferences
    UserPreference.create!(user_id: message['id'])

    # Track in analytics
    Analytics.track('User Registered', user_id: message['id'])
  end
end
```

### Order Processing

```ruby
# app/models/order.rb
class Order < ApplicationRecord
  include NatsPubsub::ActiveRecord::Publishable
  publishes_events topic_prefix: 'order', on_update: -> { status_changed? }
end

# app/subscribers/order_fulfillment_subscriber.rb
class OrderFulfillmentSubscriber < NatsPubsub::Subscriber
  subscribe_to 'order.*'

  def handle(message, context)
    case context.topic
    when 'order.created'
      reserve_inventory(message)
      charge_payment(message)
    when 'order.updated'
      ship_order(message) if message['status'] == 'paid'
    end
  end
end
```

## Next Steps

1. **Add Reliability**: Learn about [Inbox/Outbox patterns](../patterns/inbox-outbox.md)
2. **Test Your Code**: Read the [Testing Guide](../guides/testing.md)
3. **Rails Integration**: See [Rails Guide](../integrations/rails.md)
4. **Go to Production**: Follow the [Deployment Guide](../guides/deployment.md)
5. **Explore Examples**: Check out [Ruby examples](https://github.com/attaradev/nats-pubsub/tree/main/packages/ruby/examples)

## Additional Resources

- [Ruby API Reference](../reference/ruby-api.md) - Complete API documentation
- [Configuration Reference](../reference/configuration.md) - All config options
- [Troubleshooting](../troubleshooting/common-issues.md) - Common issues and solutions

---

[← Ruby Quick Start](./quick-start-ruby.md) | [Back to Home](../index.md) | [Core Concepts →](./concepts.md)
