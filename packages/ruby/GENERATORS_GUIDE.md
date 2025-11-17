# NatsPubsub Rails Generators Guide

Quick reference for NatsPubsub Rails generators.

## Available Generators

### 1. Install Generator

Install NatsPubsub with initializer and migrations.

```bash
rails generate nats_pubsub:install
```

**Options:**

- `--skip-initializer` - Skip initializer generation
- `--skip-migrations` - Skip migration generation

**Example:**

```bash
rails generate nats_pubsub:install --skip-migrations
```

---

### 2. Subscriber Generator

Generate a new event subscriber class with tests.

```bash
rails generate nats_pubsub:subscriber NAME [topics...] [options]
```

**Options:**

- `--topics=topic1 topic2` - Specify topics to subscribe to
- `--wildcard` - Use wildcard subscription (topic.>)
- `--skip-test` - Skip test file generation

**Examples:**

```bash
# Basic subscriber
rails g nats_pubsub:subscriber UserNotification

# With specific topics
rails g nats_pubsub:subscriber OrderProcessor orders.order

# Multiple topics
rails g nats_pubsub:subscriber EmailHandler \
  notifications.email \
  notifications.sms

# Wildcard subscription
rails g nats_pubsub:subscriber NotificationHandler notifications --wildcard

# Skip tests
rails g nats_pubsub:subscriber DataSync --skip-test
```

**Generated Files:**

- `app/subscribers/{name}_subscriber.rb` - Subscriber class
- `spec/subscribers/{name}_subscriber_spec.rb` - RSpec tests (if RSpec detected)
- `test/subscribers/{name}_subscriber_test.rb` - Test::Unit tests (if Test::Unit detected)

---

### 3. Config Generator

Update NatsPubsub configuration.

```bash
rails generate nats_pubsub:config [options]
```

**Options:**

- `--outbox` - Enable outbox pattern
- `--inbox` - Enable inbox pattern
- `--concurrency=N` - Set concurrency level
- `--max-deliver=N` - Set max delivery attempts
- `--ack-wait=DURATION` - Set ack wait timeout (e.g., 30s, 1m)
- `--env-file` - Generate .env.example
- `--force` - Overwrite existing configuration

**Examples:**

```bash
# Enable outbox pattern
rails g nats_pubsub:config --outbox

# Enable both outbox and inbox
rails g nats_pubsub:config --outbox --inbox

# Tune performance
rails g nats_pubsub:config --concurrency=10 --max-deliver=10

# Generate environment file
rails g nats_pubsub:config --env-file

# Production setup
rails g nats_pubsub:config \
  --outbox \
  --inbox \
  --concurrency=20 \
  --env-file
```

**Updated Files:**

- `config/initializers/nats_pubsub.rb` - Configuration file
- `.env.example` - Environment variables template (if --env-file)

---

## Quick Start

### New Project Setup

```bash
# 1. Install NatsPubsub
rails generate nats_pubsub:install

# 2. Run migrations
rails db:migrate

# 3. Create first subscriber
rails generate nats_pubsub:subscriber UserEventHandler users.user

# 4. Implement business logic in generated subscriber
# Edit: app/subscribers/user_event_handler_subscriber.rb

# 5. Run tests
rspec spec/subscribers/user_event_handler_subscriber_spec.rb
```

### Production Setup

```bash
# 1. Install with production config
rails generate nats_pubsub:install

# 2. Configure for production
rails generate nats_pubsub:config \
  --outbox \
  --inbox \
  --concurrency=20 \
  --max-deliver=10 \
  --env-file

# 3. Run migrations
rails db:migrate

# 4. Configure .env from .env.example
cp .env.example .env
# Edit .env with production values
```

---

## Common Patterns

### Domain-Specific Subscribers

```bash
rails g nats_pubsub:subscriber UserSubscriber users.user
rails g nats_pubsub:subscriber OrderSubscriber orders.order
rails g nats_pubsub:subscriber PaymentSubscriber payments.payment
```

### Wildcard Subscribers

```bash
# Subscribe to all events in a domain
rails g nats_pubsub:subscriber AuditLogger audit --wildcard

# Subscribe to all notification types
rails g nats_pubsub:subscriber NotificationHandler notifications --wildcard
```

### Multi-Topic Subscribers

```bash
# Handle related events together
rails g nats_pubsub:subscriber CheckoutProcessor \
  orders.order.created \
  payments.payment.received \
  inventory.item.reserved
```

---

## Tips

### Naming

- Generator automatically adds "Subscriber" suffix if not present
- Use descriptive names that indicate purpose
- Follow your team's naming conventions

```bash
# These are equivalent:
rails g nats_pubsub:subscriber UserEvent
rails g nats_pubsub:subscriber UserEventSubscriber
# Both create: UserEventSubscriber
```

### Testing

- Tests are automatically generated (RSpec or Test::Unit)
- Use `--skip-test` only if you have a custom test setup
- Generated tests include helpful TODOs for your business logic

### Configuration

- Config generator safely updates existing initializer
- Use `--force` to completely regenerate configuration
- Review changes before committing

---

## Troubleshooting

### Subscriber Not Processing Messages

1. Check subscription pattern matches your subject:

   ```ruby
   # In subscriber
   subscribe_to 'users.user'  # Matches: *.*.users.user.*
   ```

2. Verify NATS connection in console:
   ```ruby
   NatsPubsub::Connection.instance.connect!
   ```

### Generator Not Found

1. Ensure NatsPubsub is in your Gemfile:

   ```ruby
   gem 'nats_pubsub'
   ```

2. Run bundle install:

   ```bash
   bundle install
   ```

3. Restart Rails:
   ```bash
   spring stop  # If using Spring
   rails restart
   ```

### Config Changes Not Taking Effect

1. Restart Rails server after config changes
2. Check environment variables are loaded
3. Verify config file syntax

---

## Examples from Generated Code

### Generated Subscriber

```ruby
class OrderProcessorSubscriber
  include NatsPubsub::Subscriber

  subscribe_to 'orders.order'

  def handle(message, context)
    logger.info "Processing message: event_id=#{context.event_id}"

    data = message['data'] || message
    action = message['action']

    case action
    when 'created'
      handle_created(data, context)
    when 'updated'
      handle_updated(data, context)
    end
  end
end
```

### Generated Test

```ruby
RSpec.describe OrderProcessorSubscriber, nats_fake: true do
  subject(:subscriber) { described_class.new }

  describe '#handle' do
    let(:context) do
      NatsPubsub::Core::MessageContext.new(
        event_id: SecureRandom.uuid,
        topic: 'orders.order'
      )
    end

    it 'processes the message successfully' do
      message = { 'action' => 'created', 'data' => { 'id' => 1 } }
      expect { subscriber.handle(message, context) }.not_to raise_error
    end
  end
end
```

### Generated Configuration

```ruby
NatsPubsub.configure do |config|
  config.nats_urls = ENV.fetch('NATS_URLS', 'nats://localhost:4222')
  config.env = ENV.fetch('NATS_ENV', 'development')
  config.app_name = ENV.fetch('APP_NAME', 'my_app')

  config.connection_pool_size = ENV.fetch('NATS_POOL_SIZE', 5).to_i
  config.connection_pool_timeout = ENV.fetch('NATS_POOL_TIMEOUT', 5).to_i

  config.max_deliver = 5
  config.ack_wait = '30s'
  config.concurrency = 5

  config.use_outbox = true  # If --outbox used
  config.use_inbox = true   # If --inbox used
  config.use_dlq = true

  config.logger = Rails.logger
end
```

---

## Additional Resources

- [Main README](../../README.md) - Full documentation
- [Testing Guide](./TESTING_GUIDE.md) - How to test subscribers
- [Generator Documentation](../../GENERATOR_IMPROVEMENTS_APPLIED.md) - Detailed guide
- [Rails Integration](../../RAILS_IMPROVEMENTS_APPLIED.md) - ActiveRecord integration

---

**Quick Command Reference:**

```bash
# Install
rails g nats_pubsub:install

# Create subscriber
rails g nats_pubsub:subscriber NAME [topics...]

# Configure
rails g nats_pubsub:config [options]
```

**Version:** 0.2.1+
**Last Updated:** November 17, 2025
