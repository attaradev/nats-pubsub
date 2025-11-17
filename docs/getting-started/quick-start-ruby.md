# Ruby Quick Start

Get up and running with NatsPubsub in 5 minutes.

## Prerequisites

- Ruby >= 2.7
- NATS server with JetStream running
- Basic Ruby knowledge

Need to install? See [Installation Guide](./installation.md).

## Step 1: Install NatsPubsub

```bash
gem install nats_pubsub
# or add to Gemfile: gem 'nats_pubsub'
```

## Step 2: Create a Publisher

Create `publisher.rb`:

```ruby
require 'nats_pubsub'

# Configure NatsPubsub
NatsPubsub.configure do |config|
  config.servers = 'nats://localhost:4222'
  config.env = 'development'
  config.app_name = 'quick-start'
end

# Connect to NATS
NatsPubsub::Connection.connect
puts '✓ Connected to NATS'

# Publish a message
NatsPubsub.publish('user.created', {
  user_id: '123',
  email: 'user@example.com',
  name: 'John Doe'
})
puts '✓ Published user.created event'

# Close connection
NatsPubsub::Connection.close
```

Run it:

```bash
ruby publisher.rb
```

## Step 3: Create a Subscriber

Create `subscriber.rb`:

```ruby
require 'nats_pubsub'

# Configure NatsPubsub
NatsPubsub.configure do |config|
  config.servers = 'nats://localhost:4222'
  config.env = 'development'
  config.app_name = 'quick-start'
end

# Define a subscriber
class UserCreatedSubscriber < NatsPubsub::Subscriber
  subscribe_to 'user.created'

  def handle(message, context)
    puts '📨 Received user.created event:'
    puts "   User ID: #{message['user_id']}"
    puts "   Email: #{message['email']}"

    # Process the message
    # send_welcome_email(message['email'])
    # create_user_profile(message)
  end
end

# Start subscribers
puts '✓ Starting subscribers, waiting for messages...'
NatsPubsub::Manager.start

# Graceful shutdown
Signal.trap('INT') do
  puts "\nShutting down..."
  NatsPubsub::Manager.stop
  exit
end

# Keep process running
sleep
```

Run it in a separate terminal:

```bash
ruby subscriber.rb
```

## Step 4: Test It

1. Keep the subscriber running in one terminal
2. Run the publisher in another terminal:

```bash
ruby publisher.rb
```

You should see:

- **Publisher**: `✓ Published user.created event`
- **Subscriber**: `📨 Received user.created event: ...`

Congratulations! 🎉 You've successfully published and consumed your first message.

## Next Steps

### Add Error Handling

```ruby
class UserCreatedSubscriber < NatsPubsub::Subscriber
  subscribe_to 'user.created'

  def handle(message, context)
    process_user(message)
  rescue StandardError => e
    handle_error(e, message, context)
    raise # Will trigger retry
  end

  def on_error(error, message, context)
    puts "Error processing message: #{error.message}"
    # Send to monitoring service
  end
end
```

### Add Middleware

```ruby
# Logging middleware
class LoggingMiddleware
  def call(message, context, subscriber)
    puts "[#{Time.now}] Processing #{context[:topic]}"
    subscriber.call
    puts "[#{Time.now}] Completed #{context[:topic]}"
  end
end

# Apply middleware
class UserCreatedSubscriber < NatsPubsub::Subscriber
  use LoggingMiddleware

  subscribe_to 'user.created'

  def handle(message, context)
    # Your logic
  end
end
```

### Batch Publishing

```ruby
# Publish multiple messages efficiently
batch = NatsPubsub::Publisher.batch do |b|
  b.publish('user.created', { user_id: '1', email: 'user1@example.com' })
  b.publish('user.created', { user_id: '2', email: 'user2@example.com' })
  b.publish('user.created', { user_id: '3', email: 'user3@example.com' })
end

batch.execute
puts '✓ Published 3 messages'
```

### Wildcard Subscriptions

```ruby
# Subscribe to all user events
class AllUserEventsSubscriber < NatsPubsub::Subscriber
  subscribe_to 'user.*' # Matches user.created, user.updated, user.deleted

  def handle(message, context)
    puts "Received #{context[:topic]}: #{message}"
  end
end
```

### Configuration Options

```ruby
NatsPubsub.configure do |config|
  config.servers = 'nats://localhost:4222'
  config.env = 'development'
  config.app_name = 'quick-start'

  # Connection options
  config.max_reconnect_attempts = 10
  config.reconnect_time_wait = 2
  config.connect_timeout = 5

  # Auth
  config.token = 'secret-token'
  # or: config.user = 'user'
  #     config.password = 'password'

  # Logging
  config.logger = Rails.logger # or Logger.new(STDOUT)
  config.log_level = :info
end
```

## Complete Example

Here's a more complete example with error handling and configuration:

```ruby
require 'nats_pubsub'

# Configuration
NatsPubsub.configure do |config|
  config.servers = ENV['NATS_URL'] || 'nats://localhost:4222'
  config.env = ENV['RACK_ENV'] || 'development'
  config.app_name = 'quick-start'
  config.log_level = :info
end

# Subscriber
class UserCreatedSubscriber < NatsPubsub::Subscriber
  subscribe_to 'user.created',
               max_deliver: 3,    # Retry up to 3 times
               ack_wait: 30_000   # 30 seconds to process

  def handle(message, context)
    puts "Processing new user: #{message}"

    # Simulate async work
    send_welcome_email(message['email'])
    create_user_profile(message)

    puts '✓ User processed successfully'
  end

  def on_error(error, message, context)
    puts "Error processing user: #{error.message}"
    # Log to monitoring service
  end

  private

  def send_welcome_email(email)
    # Implementation
    puts "  Sending welcome email to #{email}"
  end

  def create_user_profile(user)
    # Implementation
    puts "  Creating profile for user #{user['user_id']}"
  end
end

# Publisher function
def publish_user_created(user)
  NatsPubsub::Connection.connect
  NatsPubsub.publish('user.created', user)
  puts '✓ Published user.created event'
ensure
  NatsPubsub::Connection.close
end

# Subscriber function
def start_subscribers
  NatsPubsub::Manager.start
  puts '✓ Subscribers started'

  # Graceful shutdown
  Signal.trap('INT') do
    puts "\nShutting down gracefully..."
    NatsPubsub::Manager.stop
    exit
  end

  sleep
end

# Main
if __FILE__ == $0
  command = ARGV[0]

  case command
  when 'publish'
    publish_user_created(
      user_id: '123',
      email: 'user@example.com',
      name: 'John Doe'
    )
  when 'subscribe'
    start_subscribers
  else
    puts 'Usage:'
    puts '  ruby example.rb subscribe  # Start subscriber'
    puts '  ruby example.rb publish    # Publish message'
  end
end
```

Run it:

```bash
# Terminal 1: Start subscriber
ruby example.rb subscribe

# Terminal 2: Publish message
ruby example.rb publish
```

## Rails Integration

### Quick Setup

```bash
# Add to Gemfile
gem 'nats_pubsub'

# Install
bundle install

# Generate files
rails generate nats_pubsub:install

# Run migrations
rails db:migrate
```

### Publishing from Controllers

```ruby
# app/controllers/users_controller.rb
class UsersController < ApplicationController
  def create
    @user = User.create!(user_params)

    # Publish event
    NatsPubsub.publish('user.created', {
      user_id: @user.id,
      email: @user.email,
      name: @user.name
    })

    render json: @user, status: :created
  end
end
```

### Creating Subscribers

```bash
rails generate nats_pubsub:subscriber UserCreated
```

This creates:

```ruby
# app/subscribers/user_created_subscriber.rb
class UserCreatedSubscriber < NatsPubsub::Subscriber
  subscribe_to 'user.created'

  def handle(message, context)
    # Your logic here
  end
end
```

### Auto-start in Rails

```ruby
# config/initializers/nats_pubsub.rb
NatsPubsub.configure do |config|
  config.auto_start = true # Auto-start subscribers with Rails
end
```

See [Rails Integration Guide](../integrations/rails.md) for complete details.

## Testing Your Code

### Fake Mode

```ruby
# spec/spec_helper.rb
RSpec.configure do |config|
  config.before(:each) do
    NatsPubsub.fake!
  end

  config.after(:each) do
    NatsPubsub.unfake!
  end
end

# spec/models/user_spec.rb
RSpec.describe User do
  it 'publishes user.created event' do
    user = User.create!(email: 'test@example.com')

    expect(NatsPubsub).to have_published_event('user.created')
      .with(hash_including(user_id: user.id))
  end
end
```

### Inline Mode

```ruby
# Process messages synchronously in tests
NatsPubsub.inline!

user = User.create!(email: 'test@example.com')
# Subscribers are called immediately

expect(WelcomeEmailService).to have_received(:send)
```

## Common Patterns

### Request-Reply Pattern

```ruby
# Publisher
response = NatsPubsub.request('user.get', { user_id: '123' }, timeout: 5)
puts "User data: #{response}"

# Subscriber
class UserGetSubscriber < NatsPubsub::Subscriber
  subscribe_to 'user.get'

  def handle(message, context)
    user = User.find(message['user_id'])
    context.reply(user.to_h)
  end
end
```

### Fan-out Pattern

```ruby
# One publisher, multiple subscribers
NatsPubsub.publish('order.created', order_data)

# Each subscriber processes independently
class EmailSubscriber < NatsPubsub::Subscriber
  subscribe_to 'order.created'
  # ...
end

class InventorySubscriber < NatsPubsub::Subscriber
  subscribe_to 'order.created'
  # ...
end
```

### ActiveRecord Integration

```ruby
# app/models/order.rb
class Order < ApplicationRecord
  include NatsPubsub::Publishable

  after_create :publish_created_event

  private

  def publish_created_event
    publish_event('order.created', {
      order_id: id,
      amount: amount,
      status: status
    })
  end
end
```

## Troubleshooting

### Connection Issues

```ruby
NatsPubsub.configure do |config|
  config.max_reconnect_attempts = 10
  config.reconnect_time_wait = 2

  config.on_connect = -> { puts 'Connected' }
  config.on_disconnect = -> { puts 'Disconnected' }
  config.on_reconnect = -> { puts 'Reconnected' }
end
```

### Message Not Received

1. Check subscriber is running
2. Verify topic name matches
3. Check NATS JetStream is enabled: `docker logs nats`
4. Enable debug logging:

```ruby
NatsPubsub.configure do |config|
  config.log_level = :debug
end
```

### LoadError

```bash
# Make sure gem is installed
bundle install

# Or install globally
gem install nats_pubsub
```

## Next Steps

Now that you have the basics working:

1. **Add Reliability**: Learn about [Inbox/Outbox patterns](../patterns/inbox-outbox.md)
2. **Test Your Code**: Read the [Testing Guide](../guides/testing.md)
3. **Rails Integration**: See [Rails Guide](../integrations/rails.md)
4. **Go to Production**: Follow the [Deployment Guide](../guides/deployment.md)
5. **Explore Examples**: Check out [example projects](https://github.com/attaradev/nats-pubsub/tree/main/packages/ruby/examples)

## Additional Resources

- [Publishing Guide](../guides/publishing.md) - Advanced publishing techniques
- [Subscribing Guide](../guides/subscribing.md) - Advanced subscriber patterns
- [Configuration Reference](../reference/configuration.md) - All config options
- [API Reference](../reference/ruby-api.md) - Complete API documentation
- [Rails Quick Start](./rails-quick-start.md) - Detailed Rails guide

---

[← JavaScript Quick Start](./quick-start-js.md) | [Back to Home](../index.md) | [Core Concepts →](./concepts.md)
