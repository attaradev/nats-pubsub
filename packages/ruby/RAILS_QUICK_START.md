# NatsPubsub Rails Quick Start Guide

Get started with NatsPubsub in your Rails application in 5 minutes.

## Prerequisites

- Rails 6.0+ or Rails 7.0+
- Ruby 2.7+
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

    render json: @user, status: :created, location: api_v1_user_url(@user)
  end

  # GET /api/v1/users/:id
  def show
    @user = User.find(params[:id])
    render json: @user
  end

  # PATCH/PUT /api/v1/users/:id
  def update
    @user = User.find(params[:id])

    if @user.update(user_params)
      render json: @user
    else
      render json: { errors: @user.errors }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/users/:id
  def destroy
    @user = User.find(params[:id])
    @user.destroy!
    head :no_content
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

Now events are automatically published when you:

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

# For multiple topics, use wildcard
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

  private

  def handle_user_created(message)
    UserMailer.welcome_email(message['email']).deliver_later
  end

  def handle_user_updated(message)
    # Handle update
  end

  def handle_user_deleted(message)
    # Handle deletion
  end
end
```

## Common Patterns

### 1. Event Publishing with Conditions

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

### 2. Filtering Sensitive Data

```ruby
class User < ApplicationRecord
  include NatsPubsub::ActiveRecord::Publishable

  publishes_events domain: 'user',
                   resource: 'user',
                   except: [:password_digest, :api_token]
end
```

### 3. Wildcard Subscriptions

```ruby
# Subscribe to all order events
rails generate nats_pubsub:subscriber OrderProcessor order --wildcard
```

```ruby
class OrderProcessorSubscriber
  include NatsPubsub::Subscriber

  subscribe_to_wildcard 'order'  # Subscribes to order.>

  def handle(message, context)
    # Receives order.order.created, order.payment.received, etc.
  end
end
```

### 4. Multiple Topics

```ruby
class NotificationSubscriber
  include NatsPubsub::Subscriber

  subscribe_to 'user.user.created'
  subscribe_to 'order.order.placed'
  subscribe_to 'payment.payment.received'

  def handle(message, context)
    case context.topic
    when 'user.user.created'
      handle_user_created(message)
    when 'order.order.placed'
      handle_order_placed(message)
    when 'payment.payment.received'
      handle_payment_received(message)
    end
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

Or use generator:

```bash
rails generate nats_pubsub:config --outbox
```

Events are now stored in the database before publishing, ensuring no message loss even if NATS is temporarily unavailable.

### Inbox Pattern (Idempotency)

Enable in config:

```ruby
NatsPubsub.configure do |config|
  config.use_inbox = true
end
```

Or use generator:

```bash
rails generate nats_pubsub:config --inbox
```

Received events are deduplicated, ensuring your handlers are idempotent.

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
      .to have_published_event('user', 'user', 'created')
  end

  it 'excludes password from payload' do
    user = User.create!(email: 'test@example.com', password: 'secret')

    expect(last_nats_event[:payload]).not_to have_key(:password)
  end
end
```

### Test Subscribers

```ruby
# spec/subscribers/user_notification_subscriber_spec.rb
RSpec.describe UserNotificationSubscriber, nats_fake: true do
  subject(:subscriber) { described_class.new }

  it 'sends welcome email on user created' do
    message = {
      'action' => 'created',
      'data' => { 'email' => 'test@example.com' }
    }

    context = NatsPubsub::Core::MessageContext.new(
      event_id: SecureRandom.uuid,
      topic: 'user.user'
    )

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

### Custom Health Check

```ruby
# app/controllers/health_controller.rb
class HealthController < ApplicationController
  include NatsPubsub::Rails::HealthEndpoint::ControllerHelper

  def nats
    render_nats_health
  end
end
```

## Monitoring

### Enable Instrumentation

```ruby
# config/initializers/nats_pubsub_monitoring.rb
ActiveSupport::Notifications.subscribe(/nats_pubsub/) do |name, start, finish, id, payload|
  duration = (finish - start) * 1000
  Rails.logger.info "#{name}: #{duration}ms"
end

# Subscribe to errors only
ActiveSupport::Notifications.subscribe('nats_pubsub.error') do |*args|
  event = ActiveSupport::Notifications::Event.new(*args)
  Rails.logger.error "NatsPubsub Error: #{event.payload[:error_message]}"
end
```

### Collect Metrics

```ruby
# config/initializers/nats_pubsub_monitoring.rb
collector = NatsPubsub::Instrumentation::MetricsCollector.new
collector.start

# Expose metrics endpoint
Rails.application.routes.draw do
  get '/metrics/nats', to: proc { |_env|
    [200, {'Content-Type' => 'application/json'}, [collector.summary.to_json]]
  }
end
```

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

### 2. Enable Reliability Patterns

```bash
rails generate nats_pubsub:config --outbox --inbox --concurrency=20
```

### 3. Tune Performance

```ruby
# config/initializers/nats_pubsub.rb
NatsPubsub.configure do |config|
  config.connection_pool_size = 20
  config.connection_pool_timeout = 10
  config.concurrency = 20
  config.max_deliver = 10
  config.ack_wait = '60s'
end
```

### 4. Add Background Worker

Create a background job to publish outbox events:

```ruby
# app/jobs/nats_pubsub_outbox_job.rb
class NatsPubsubOutboxJob < ApplicationJob
  queue_as :default

  def perform
    NatsPubsub::OutboxPublisher.publish_pending(limit: 100)
  end
end
```

Schedule it with a cron job or Sidekiq scheduler:

```ruby
# config/schedule.rb (whenever gem)
every 1.minute do
  runner "NatsPubsubOutboxJob.perform_later"
end
```

### 5. Setup Kubernetes Health Probes

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

### 1. User Registration Flow

```ruby
# app/models/user.rb
class User < ApplicationRecord
  include NatsPubsub::ActiveRecord::Publishable
  publishes_events domain: 'user', resource: 'user'
end

# app/subscribers/user_registration_subscriber.rb
class UserRegistrationSubscriber
  include NatsPubsub::Subscriber
  subscribe_to 'user.user.created'

  def handle(message, context)
    user_id = message['data']['id']

    # Send welcome email
    UserMailer.welcome_email(user_id).deliver_later

    # Create default preferences
    UserPreference.create!(user_id: user_id)

    # Track in analytics
    Analytics.track('User Registered', user_id: user_id)
  end
end
```

### 2. Order Processing

```ruby
# app/models/order.rb
class Order < ApplicationRecord
  include NatsPubsub::ActiveRecord::Publishable

  publishes_events domain: 'order',
                   resource: 'order',
                   on_update: -> { status_changed? }
end

# app/subscribers/order_fulfillment_subscriber.rb
class OrderFulfillmentSubscriber
  include NatsPubsub::Subscriber
  subscribe_to 'order.order'

  def handle(message, context)
    case message['action']
    when 'created'
      reserve_inventory(message['data'])
      charge_payment(message['data'])
    when 'updated'
      if message['data']['status'] == 'paid'
        ship_order(message['data'])
      end
    end
  end
end
```

### 3. Cross-Service Communication

Service A (Users):

```ruby
# users_service/app/models/user.rb
class User < ApplicationRecord
  include NatsPubsub::ActiveRecord::Publishable
  publishes_events domain: 'user', resource: 'user'
end
```

Service B (Orders):

```ruby
# orders_service/app/subscribers/user_subscriber.rb
class UserSubscriber
  include NatsPubsub::Subscriber
  subscribe_to 'user.user'

  def handle(message, context)
    case message['action']
    when 'created'
      sync_user(message['data'])
    when 'updated'
      update_user(message['data'])
    end
  end

  private

  def sync_user(data)
    User.create!(
      external_id: data['id'],
      email: data['email'],
      name: data['name']
    )
  end
end
```

## Next Steps

1. **Read Documentation:**
   - [Testing Guide](./TESTING_GUIDE.md)
   - [Generators Guide](./GENERATORS_GUIDE.md)
   - [Health & Instrumentation](../../HEALTH_AND_INSTRUMENTATION_APPLIED.md)

2. **Explore Examples:**
   - Check `examples/` directory for complete examples

3. **Join Community:**
   - GitHub Issues: <https://github.com/anthropics/nats-pubsub/issues>
   - Discussions: <https://github.com/anthropics/nats-pubsub/discussions>

4. **Production Checklist:**
   - [ ] Enable outbox pattern
   - [ ] Configure multiple NATS servers
   - [ ] Add health check endpoints
   - [ ] Setup monitoring and alerting
   - [ ] Configure background workers
   - [ ] Test failover scenarios
   - [ ] Document your event schema

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and solutions.

## Performance Tips

See [PERFORMANCE_BENCHMARKS.md](../../PERFORMANCE_BENCHMARKS.md) for optimization guides.

---

**Version:** 0.2.1+
**Last Updated:** November 17, 2025
