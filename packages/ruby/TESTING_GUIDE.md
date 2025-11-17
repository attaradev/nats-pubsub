# NatsPubsub Testing Guide

This guide shows you how to test your NatsPubsub event publishing and subscription code in Ruby/Rails applications.

## Quick Start

### 1. Setup RSpec Configuration

Add this to your `spec/spec_helper.rb` or `spec/rails_helper.rb`:

```ruby
require 'nats_pubsub/testing/helpers'

RSpec.configure do |config|
  # Automatic setup (recommended)
  NatsPubsub::Testing::RSpecConfiguration.configure(config)
end
```

This automatically:

- Includes all testing helper methods
- Enables fake mode for tests tagged with `nats_fake: true`
- Enables inline mode for tests tagged with `nats_inline: true`
- Cleans up events after each test

### 2. Write Your First Test

```ruby
RSpec.describe User, nats_fake: true do
  it 'publishes created event when saved' do
    expect { User.create!(email: 'test@example.com') }
      .to have_published_event('users', 'user', 'created')
  end
end
```

## Testing Modes

### Fake Mode (Recommended for Unit Tests)

Records published events without actually processing them. Fast and isolated.

```ruby
RSpec.describe User, nats_fake: true do
  it 'publishes event' do
    user = User.create!(email: 'test@example.com')
    expect(nats_event_published?('users', 'user', 'created')).to be true
  end
end
```

### Inline Mode (For Integration Tests)

Executes subscribers immediately and synchronously.

```ruby
RSpec.describe 'User registration', nats_inline: true do
  it 'sends welcome email' do
    expect {
      User.create!(email: 'test@example.com')
    }.to change { ActionMailer::Base.deliveries.count }.by(1)
  end
end
```

### Manual Mode Setup

```ruby
RSpec.describe User do
  before { setup_nats_fake }
  after { clear_nats_events }

  it 'publishes event' do
    # Your test here
  end
end
```

## Available Matchers

### `have_published_event`

Tests that an event was published.

```ruby
# Basic usage
expect { user.save }
  .to have_published_event('users', 'user', 'created')

# Works with any block that publishes
expect { order.update!(status: 'shipped') }
  .to have_published_event('orders', 'order', 'updated')
```

### `have_published_event_with_payload`

Tests event publishing with payload verification.

```ruby
expect { user.save }
  .to have_published_event_with_payload(
    'users', 'user', 'created',
    id: user.id,
    email: user.email
  )
```

### `enqueue_outbox_event`

Tests that events are enqueued to the outbox table (when using outbox pattern).

```ruby
# Basic usage
expect { publisher.publish('users', 'user', 'created', id: 1) }
  .to enqueue_outbox_event

# With subject matching
expect { publisher.publish('users', 'user', 'created', id: 1) }
  .to enqueue_outbox_event
  .with_subject_matching(/users\.user\.created/)

# With status verification
expect { publisher.publish('users', 'user', 'created', id: 1) }
  .to enqueue_outbox_event
  .with_status('pending')

# With payload verification
expect { publisher.publish('users', 'user', 'created', id: 1) }
  .to enqueue_outbox_event
  .with_payload_including(id: 1, email: 'test@example.com')

# Chain multiple conditions
expect { publisher.publish('users', 'user', 'created', id: 1) }
  .to enqueue_outbox_event
  .with_subject_matching(/users\.user\.created/)
  .with_status('pending')
  .with_payload_including(id: 1)
```

### `subscribe_to`

Tests that a subscriber class subscribes to the correct subjects.

```ruby
RSpec.describe UserSubscriber do
  it 'subscribes to user events' do
    expect(UserSubscriber).to subscribe_to('development.app.users.user.>')
  end

  it 'subscribes with wildcards' do
    expect(OrderSubscriber).to subscribe_to('*.*.orders.>')
  end
end
```

## Helper Methods

### Event Querying

```ruby
# Check if event was published
nats_event_published?('users', 'user', 'created')
# => true/false

# Get all published events
nats_published_events
# => [{ domain: 'users', resource: 'user', action: 'created', ... }]

# Find specific events
find_nats_events(domain: 'users', action: 'created')
# => [matching events...]

# Get last published event
last_nats_event
# => { domain: 'users', resource: 'user', action: 'created', ... }

# Get event count
nats_event_count
# => 5
```

### Factory Methods

```ruby
# Create outbox event for testing
event = create_outbox_event(
  subject: 'development.app.users.user.created',
  payload: { id: 1, email: 'test@example.com' },
  status: 'pending'
)

# Create inbox event for testing
event = create_inbox_event(
  subject: 'development.app.users.user.created',
  payload: { id: 1, email: 'test@example.com' },
  status: 'received'
)
```

### Connection Stubbing

Avoid real NATS connections in tests:

```ruby
before do
  stub_nats_connection
end
```

## Common Testing Patterns

### Testing ActiveRecord Publishing

```ruby
RSpec.describe User, nats_fake: true do
  describe 'publishes_events' do
    it 'publishes on create' do
      expect { User.create!(email: 'test@example.com') }
        .to have_published_event('users', 'user', 'created')
    end

    it 'publishes on update' do
      user = User.create!(email: 'test@example.com')
      clear_nats_events  # Clear the created event

      expect { user.update!(name: 'Test User') }
        .to have_published_event('users', 'user', 'updated')
    end

    it 'publishes on destroy' do
      user = User.create!(email: 'test@example.com')
      clear_nats_events

      expect { user.destroy! }
        .to have_published_event('users', 'user', 'deleted')
    end

    it 'includes correct payload' do
      user = User.create!(email: 'test@example.com', name: 'Test')

      expect(last_nats_event[:payload]).to include(
        email: 'test@example.com',
        name: 'Test'
      )
    end

    it 'excludes sensitive attributes' do
      user = User.create!(email: 'test@example.com', password: 'secret')

      expect(last_nats_event[:payload]).not_to have_key(:password)
    end
  end
end
```

### Testing Direct Publishing

```ruby
RSpec.describe 'Publishing events', nats_fake: true do
  let(:publisher) { NatsPubsub::Publisher.new }

  it 'publishes to correct subject' do
    publisher.publish('users', 'user', 'created', id: 1, email: 'test@example.com')

    event = last_nats_event
    expect(event[:domain]).to eq('users')
    expect(event[:resource]).to eq('user')
    expect(event[:action]).to eq('created')
    expect(event[:payload]).to include(id: 1)
  end
end
```

### Testing Outbox Pattern

```ruby
RSpec.describe 'Outbox publishing' do
  before do
    NatsPubsub.configure do |config|
      config.use_outbox = true
    end
  end

  it 'enqueues events to outbox table' do
    publisher = NatsPubsub::Publisher.new

    expect {
      publisher.publish('users', 'user', 'created', id: 1)
    }.to enqueue_outbox_event
      .with_subject_matching(/users\.user\.created/)
      .with_status('pending')
  end

  it 'creates outbox record with correct attributes' do
    publisher = NatsPubsub::Publisher.new
    publisher.publish('users', 'user', 'created', id: 1, email: 'test@example.com')

    event = NatsPubsub::OutboxEvent.last
    expect(event.subject).to match(/users\.user\.created/)
    expect(event.status).to eq('pending')

    payload = JSON.parse(event.payload)
    expect(payload['id']).to eq(1)
    expect(payload['email']).to eq('test@example.com')
  end
end
```

### Testing Subscribers

```ruby
RSpec.describe UserSubscriber do
  it 'subscribes to correct subject pattern' do
    expect(UserSubscriber).to subscribe_to('development.app.users.user.>')
  end

  describe '#call', nats_inline: true do
    it 'processes user created events' do
      subscriber = UserSubscriber.new
      payload = { id: 1, email: 'test@example.com' }

      expect {
        subscriber.call(payload, { subject: 'development.app.users.user.created' })
      }.to change { ProcessedEvent.count }.by(1)
    end
  end
end
```

### Testing Conditional Publishing

```ruby
RSpec.describe Order, nats_fake: true do
  describe 'conditional publishing' do
    it 'publishes when status changes' do
      order = Order.create!(status: 'pending')
      clear_nats_events

      expect { order.update!(status: 'shipped') }
        .to have_published_event('orders', 'order', 'updated')
    end

    it 'does not publish when other fields change' do
      order = Order.create!(status: 'pending')
      clear_nats_events

      expect { order.update!(notes: 'Updated notes') }
        .not_to have_published_event('orders', 'order', 'updated')
    end

    it 'respects if condition' do
      order = Order.create!(status: 'pending', imported: true)
      clear_nats_events

      # Assuming publishes_events has if: -> { !imported? }
      expect { order.update!(status: 'shipped') }
        .not_to have_published_event('orders', 'order', 'updated')
    end
  end
end
```

### Testing Integration Flows

```ruby
RSpec.describe 'Order fulfillment flow', nats_inline: true do
  it 'triggers complete workflow' do
    order = Order.create!(status: 'pending', user_id: user.id)

    # Inline mode executes subscribers immediately
    expect(order.reload.status).to eq('processing')
    expect(ActionMailer::Base.deliveries.count).to eq(1)
    expect(InventoryItem.find_by(order_id: order.id)).to be_reserved
  end
end
```

## Best Practices

### 1. Use Fake Mode for Unit Tests

```ruby
# Good - Fast and isolated
RSpec.describe User, nats_fake: true do
  it 'publishes event' do
    expect { user.save }.to have_published_event('users', 'user', 'created')
  end
end

# Avoid - Slower, requires NATS connection
RSpec.describe User do
  it 'publishes event' do
    # Actual NATS connection
  end
end
```

### 2. Clear Events Between Tests

The automatic configuration handles this, but if you're setting up manually:

```ruby
RSpec.describe User do
  after { clear_nats_events }
end
```

### 3. Use Inline Mode Sparingly

Inline mode is great for integration tests but slower than fake mode:

```ruby
# Unit tests - use fake mode (fast)
RSpec.describe User, nats_fake: true do
  # Tests
end

# Integration tests - use inline mode when needed
RSpec.describe 'Full workflow', nats_inline: true do
  # Tests
end
```

### 4. Test Event Payload Structure

```ruby
it 'includes required fields in payload' do
  user = User.create!(email: 'test@example.com')

  payload = last_nats_event[:payload]
  expect(payload).to include(
    id: user.id,
    email: user.email,
    created_at: be_present
  )
end
```

### 5. Stub NATS Connection in Tests

```ruby
RSpec.configure do |config|
  config.before(:suite) do
    stub_nats_connection
  end
end
```

## Troubleshooting

### Events Not Being Recorded

Make sure you've enabled fake or inline mode:

```ruby
# Add to test
before { setup_nats_fake }

# Or use tag
RSpec.describe User, nats_fake: true do
  # ...
end
```

### Matcher Not Found

Ensure you've required the testing helpers:

```ruby
# spec/spec_helper.rb
require 'nats_pubsub/testing/helpers'

RSpec.configure do |config|
  NatsPubsub::Testing::RSpecConfiguration.configure(config)
end
```

### Outbox Model Not Found

Configure the outbox model in your initializer:

```ruby
# config/initializers/nats_pubsub.rb
NatsPubsub.configure do |config|
  config.outbox_model = 'NatsPubsub::OutboxEvent'
end
```

## Additional Resources

- [Main README](../../../README.md)
- [Rails Integration Guide](../../../RAILS_INTEGRATION_IMPROVEMENTS.md)
- [Testing Improvements Documentation](../../../TESTING_IMPROVEMENTS_APPLIED.md)
- [RSpec Documentation](https://rspec.info/)

---

**Version:** 0.2.1+
**Last Updated:** November 17, 2025
