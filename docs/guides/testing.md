# Testing Strategies Guide

This comprehensive guide covers testing strategies for NatsPubsub applications, from unit tests to integration tests, including mocking strategies, test utilities, and best practices for both JavaScript/TypeScript and Ruby implementations.

## Table of Contents

- [Overview](#overview)
- [Testing Philosophy](#testing-philosophy)
- [Unit Testing Publishers](#unit-testing-publishers)
- [Unit Testing Subscribers](#unit-testing-subscribers)
- [Integration Testing](#integration-testing)
- [Test Utilities and Helpers](#test-utilities-and-helpers)
- [Mocking Strategies](#mocking-strategies)
- [Testing Middleware](#testing-middleware)
- [Testing Error Handling](#testing-error-handling)
- [Testing Batch Operations](#testing-batch-operations)
- [End-to-End Testing](#end-to-end-testing)
- [Performance Testing](#performance-testing)
- [Best Practices](#best-practices)
- [CI/CD Integration](#cicd-integration)

---

## Overview

Testing pub/sub systems requires special consideration because of their asynchronous, distributed nature. NatsPubsub provides testing utilities to make this easier.

### Testing Pyramid

```mermaid
graph TD
    A[E2E Tests] -->|Few, High Value| B[5%]
    C[Integration Tests] -->|Some, Verify Interactions| D[15%]
    E[Unit Tests] -->|Many, Fast, Isolated| F[80%]

    style A fill:#ff6b6b
    style C fill:#ffd93d
    style E fill:#6bcf7f
```

---

## Testing Philosophy

### What to Test

1. **Unit Tests**: Publisher and subscriber logic in isolation
2. **Integration Tests**: Message flow through the system
3. **Contract Tests**: Message format compatibility
4. **Performance Tests**: Throughput and latency under load

### What NOT to Test

- NATS server internals (trust the library)
- Network reliability (use mocks)
- JetStream features (already tested by NATS)

---

## Unit Testing Publishers

### JavaScript/TypeScript

#### Basic Publisher Test

```typescript
import NatsPubsub from "nats-pubsub";
import connection from "../core/connection";

// Mock NATS connection
jest.mock("../core/connection");

describe("Publishing", () => {
  let mockJetstream: any;

  beforeEach(() => {
    // Configure NatsPubsub for testing
    NatsPubsub.configure({
      natsUrls: "nats://localhost:4222",
      env: "test",
      appName: "test-app",
    });

    mockJetstream = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    (connection.ensureConnection as jest.Mock) = jest
      .fn()
      .mockResolvedValue(undefined);
    (connection.getJetStream as jest.Mock) = jest
      .fn()
      .mockReturnValue(mockJetstream);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("publishes a message successfully", async () => {
    const message = {
      order_id: "ORD-123",
      customer_id: "CUST-456",
      total: 99.99,
    };

    await NatsPubsub.publish("order.created", message);

    // Verify publish was called
    expect(connection.ensureConnection).toHaveBeenCalled();
    expect(mockJetstream.publish).toHaveBeenCalledWith(
      "test.test-app.order.created",
      expect.any(String), // JSON payload
      expect.objectContaining({
        msgID: expect.any(String),
      }),
    );

    // Verify message content
    const publishCall = mockJetstream.publish.mock.calls[0];
    const payload = JSON.parse(publishCall[1]);
    expect(payload.payload).toEqual(message);
  });

  it("publishes with custom metadata", async () => {
    const message = { order_id: "ORD-123" };
    const options = {
      trace_id: "trace-abc",
      event_id: "evt-123",
    };

    await NatsPubsub.publish("order.created", message, options);

    const publishCall = mockJetstream.publish.mock.calls[0];
    const payload = JSON.parse(publishCall[1]);

    expect(payload.trace_id).toBe("trace-abc");
    expect(payload.event_id).toBe("evt-123");
  });

  it("publishes to multiple topics", async () => {
    const message = { order_id: "ORD-123" };

    await NatsPubsub.publish({
      topics: ["order.created", "notification.email"],
      message,
    });

    expect(mockJetstream.publish).toHaveBeenCalledTimes(2);
    expect(mockJetstream.publish).toHaveBeenCalledWith(
      "test.test-app.order.created",
      expect.any(String),
      expect.any(Object),
    );
    expect(mockJetstream.publish).toHaveBeenCalledWith(
      "test.test-app.notification.email",
      expect.any(String),
      expect.any(Object),
    );
  });
});
```

#### Testing Batch Publishing

```typescript
describe("Batch Publishing", () => {
  it("publishes multiple messages in batch", async () => {
    const batch = NatsPubsub.batch();

    batch
      .add("order.created", { order_id: "ORD-1" })
      .add("order.created", { order_id: "ORD-2" })
      .add("order.created", { order_id: "ORD-3" });

    const result = await batch.publish();

    expect(result.count).toBe(3);
    expect(result.successCount).toBe(3);
    expect(mockJetstream.publish).toHaveBeenCalledTimes(3);
  });

  it("handles partial failures in batch", async () => {
    mockJetstream.publish
      .mockResolvedValueOnce(undefined) // First succeeds
      .mockRejectedValueOnce(new Error("Network error")) // Second fails
      .mockResolvedValueOnce(undefined); // Third succeeds

    const batch = NatsPubsub.batch();

    batch
      .add("order.created", { order_id: "ORD-1" })
      .add("order.created", { order_id: "ORD-2" })
      .add("order.created", { order_id: "ORD-3" });

    const result = await batch.publish();

    expect(result.count).toBe(3);
    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(1);
  });
});
```

### Ruby

#### Basic Publisher Test

```ruby
require 'rails_helper'

RSpec.describe 'Publishing', type: :publisher do
  let(:mock_jetstream) { double('JetStream') }

  before do
    allow(NatsPubsub::Connection).to receive(:connect!).and_return(mock_jetstream)
    allow(mock_jetstream).to receive(:publish)

    NatsPubsub.configure do |config|
      config.servers = 'nats://localhost:4222'
      config.env = 'test'
      config.app_name = 'test-app'
    end
  end

  describe 'basic publishing' do
    it 'publishes a message successfully' do
      message = {
        order_id: 'ORD-123',
        customer_id: 'CUST-456',
        total: 99.99
      }

      NatsPubsub.publish('order.created', message)

      expect(mock_jetstream).to have_received(:publish).with(
        'test.test-app.order.created',
        kind_of(String),
        hash_including(
          headers: hash_including('nats-msg-id' => kind_of(String))
        )
      )
    end

    it 'publishes with custom metadata' do
      message = { order_id: 'ORD-123' }
      options = {
        trace_id: 'trace-abc',
        event_id: 'evt-123'
      }

      NatsPubsub.publish('order.created', message, **options)

      expect(mock_jetstream).to have_received(:publish) do |_subject, payload, _opts|
        parsed = JSON.parse(payload)
        expect(parsed['trace_id']).to eq('trace-abc')
        expect(parsed['event_id']).to eq('evt-123')
      end
    end
  end

  describe 'multi-topic publishing' do
    it 'publishes to multiple topics' do
      message = { order_id: 'ORD-123' }

      NatsPubsub.publish(
        topics: ['order.created', 'notification.email'],
        message: message
      )

      expect(mock_jetstream).to have_received(:publish).twice
    end
  end
end
```

#### Testing with Fake Mode

```ruby
require 'rails_helper'

RSpec.describe 'Publishing with Fake Mode', type: :publisher do
  around do |example|
    NatsPubsub::Testing.fake! do
      example.run
    end
  end

  it 'captures published events' do
    NatsPubsub.publish('order.created', { order_id: 'ORD-123' })

    expect(NatsPubsub::Testing).to have_published_event('order.created')
  end

  it 'captures event payload' do
    NatsPubsub.publish('order.created', { order_id: 'ORD-123', total: 99.99 })

    expect(NatsPubsub::Testing).to have_published_event_with_payload(
      'order.created',
      order_id: 'ORD-123',
      total: 99.99
    )
  end

  it 'tracks multiple events' do
    NatsPubsub.publish('order.created', { order_id: 'ORD-1' })
    NatsPubsub.publish('order.updated', { order_id: 'ORD-1' })
    NatsPubsub.publish('order.cancelled', { order_id: 'ORD-1' })

    expect(NatsPubsub::Testing.published_events.count).to eq(3)
  end
end
```

---

## Unit Testing Subscribers

### JavaScript/TypeScript

#### Basic Subscriber Test

```typescript
import { OrderCreatedSubscriber } from "../subscribers/order-created-subscriber";
import { TopicMetadata } from "nats-pubsub";

describe("OrderCreatedSubscriber", () => {
  let subscriber: OrderCreatedSubscriber;
  let mockOrderService: any;

  beforeEach(() => {
    subscriber = new OrderCreatedSubscriber();

    mockOrderService = {
      processOrder: jest.fn().mockResolvedValue(undefined),
    };

    // Inject mock dependency
    (subscriber as any).orderService = mockOrderService;
  });

  it("processes order created event", async () => {
    const message = {
      order_id: "ORD-123",
      customer_id: "CUST-456",
      total: 99.99,
    };

    const metadata: TopicMetadata = {
      event_id: "evt-123",
      trace_id: "trace-456",
      topic: "order.created",
      subject: "production.order-service.order.created",
      occurred_at: new Date(),
      deliveries: 1,
    };

    await subscriber.handle(message, metadata);

    expect(mockOrderService.processOrder).toHaveBeenCalledWith("ORD-123");
  });

  it("handles errors gracefully", async () => {
    const message = { order_id: "INVALID" };
    const metadata: TopicMetadata = {
      event_id: "evt-123",
      trace_id: "trace-456",
      topic: "order.created",
      subject: "production.order-service.order.created",
      occurred_at: new Date(),
      deliveries: 1,
    };

    mockOrderService.processOrder.mockRejectedValue(new Error("Invalid order"));

    await expect(subscriber.handle(message, metadata)).rejects.toThrow(
      "Invalid order",
    );
  });

  it("is idempotent", async () => {
    const message = { order_id: "ORD-123" };
    const metadata: TopicMetadata = {
      event_id: "evt-123",
      trace_id: "trace-456",
      topic: "order.created",
      subject: "production.order-service.order.created",
      occurred_at: new Date(),
      deliveries: 1,
    };

    // Process twice with same event_id
    await subscriber.handle(message, metadata);
    await subscriber.handle(message, metadata);

    // Should only process once
    expect(mockOrderService.processOrder).toHaveBeenCalledTimes(1);
  });
});
```

#### Testing with Spies

```typescript
describe("NotificationSubscriber", () => {
  let subscriber: NotificationSubscriber;
  let emailSpy: jest.SpyInstance;

  beforeEach(() => {
    subscriber = new NotificationSubscriber();
    emailSpy = jest.spyOn(emailService, "send").mockResolvedValue(undefined);
  });

  afterEach(() => {
    emailSpy.mockRestore();
  });

  it("sends email notification", async () => {
    const message = {
      to: "user@example.com",
      subject: "Welcome",
      body: "Welcome to our service",
    };

    const metadata: TopicMetadata = {
      event_id: "evt-123",
      trace_id: "trace-456",
      topic: "notification.email",
      subject: "production.app.notification.email",
      occurred_at: new Date(),
      deliveries: 1,
    };

    await subscriber.handle(message, metadata);

    expect(emailSpy).toHaveBeenCalledWith({
      to: "user@example.com",
      subject: "Welcome",
      body: "Welcome to our service",
    });
  });
});
```

### Ruby

#### Basic Subscriber Test

```ruby
require 'rails_helper'

RSpec.describe OrderCreatedSubscriber, type: :subscriber do
  let(:subscriber) { described_class.new }
  let(:message) do
    {
      'order_id' => 'ORD-123',
      'customer_id' => 'CUST-456',
      'total' => 99.99
    }
  end

  let(:context) do
    double(
      'MessageContext',
      event_id: 'evt-123',
      trace_id: 'trace-456',
      topic: 'order.created',
      subject: 'production.order-service.order.created',
      occurred_at: Time.now,
      deliveries: 1
    )
  end

  describe '#handle' do
    it 'processes order created event' do
      expect(OrderService).to receive(:process_order).with('ORD-123')

      subscriber.handle(message, context)
    end

    it 'handles errors gracefully' do
      allow(OrderService).to receive(:process_order).and_raise('Invalid order')

      expect { subscriber.handle(message, context) }
        .to raise_error('Invalid order')
    end

    it 'is idempotent' do
      # First call
      subscriber.handle(message, context)

      # Second call with same event_id
      subscriber.handle(message, context)

      # Should only process once
      expect(OrderService).to have_received(:process_order).once
    end
  end
end
```

#### Testing with RSpec Matchers

```ruby
require 'rails_helper'

RSpec.describe NotificationSubscriber, type: :subscriber do
  let(:subscriber) { described_class.new }

  describe '#handle' do
    it 'sends email notification' do
      message = {
        'to' => 'user@example.com',
        'subject' => 'Welcome',
        'body' => 'Welcome to our service'
      }

      context = double(
        'MessageContext',
        event_id: 'evt-123',
        topic: 'notification.email'
      )

      expect(EmailService).to receive(:send_email).with(
        to: 'user@example.com',
        subject: 'Welcome',
        body: 'Welcome to our service'
      )

      subscriber.handle(message, context)
    end
  end
end
```

---

## Integration Testing

### JavaScript/TypeScript

#### End-to-End Message Flow

```typescript
import NatsPubsub from "nats-pubsub";
import { OrderCreatedSubscriber } from "../subscribers/order-created-subscriber";

describe("Order Flow Integration", () => {
  let subscriber: OrderCreatedSubscriber;

  beforeAll(async () => {
    // Use real NATS connection for integration tests
    NatsPubsub.configure({
      natsUrls: process.env.NATS_URL || "nats://localhost:4222",
      env: "test",
      appName: "test-app",
    });

    subscriber = new OrderCreatedSubscriber();
    NatsPubsub.registerSubscriber(subscriber);
    await NatsPubsub.start();
  });

  afterAll(async () => {
    await NatsPubsub.stop();
  });

  it("processes published message", async () => {
    const message = {
      order_id: "ORD-INTEGRATION-123",
      customer_id: "CUST-456",
      total: 99.99,
    };

    // Publish message
    await NatsPubsub.publish("order.created", message);

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify message was processed
    const order = await Order.findOne({ order_id: "ORD-INTEGRATION-123" });
    expect(order).toBeDefined();
    expect(order.customer_id).toBe("CUST-456");
  });
});
```

#### Testing with Test Harness

```typescript
import { TestHarness } from "nats-pubsub/testing";

describe("Order Processing with Test Harness", () => {
  let harness: TestHarness;

  beforeEach(async () => {
    harness = new TestHarness({
      natsUrls: "nats://localhost:4222",
      env: "test",
      appName: "test-app",
    });

    await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("processes messages in test environment", async () => {
    const receivedMessages: any[] = [];

    // Register test subscriber
    harness.subscribe("order.created", async (message, metadata) => {
      receivedMessages.push(message);
    });

    // Publish message
    await harness.publish("order.created", {
      order_id: "ORD-TEST-123",
    });

    // Wait for processing
    await harness.waitForMessages(1);

    expect(receivedMessages).toHaveLength(1);
    expect(receivedMessages[0].order_id).toBe("ORD-TEST-123");
  });
});
```

### Ruby

#### End-to-End Message Flow

```ruby
require 'rails_helper'

RSpec.describe 'Order Flow Integration', type: :integration do
  before(:all) do
    NatsPubsub.configure do |config|
      config.servers = ENV['NATS_URL'] || 'nats://localhost:4222'
      config.env = 'test'
      config.app_name = 'test-app'
    end

    NatsPubsub::Manager.register(OrderCreatedSubscriber)
    NatsPubsub::Manager.start
  end

  after(:all) do
    NatsPubsub::Manager.stop
  end

  it 'processes published message' do
    message = {
      order_id: 'ORD-INTEGRATION-123',
      customer_id: 'CUST-456',
      total: 99.99
    }

    # Publish message
    NatsPubsub.publish('order.created', message)

    # Wait for processing
    sleep 1

    # Verify message was processed
    order = Order.find_by(order_id: 'ORD-INTEGRATION-123')
    expect(order).to be_present
    expect(order.customer_id).to eq('CUST-456')
  end
end
```

#### Testing with Inline Mode

```ruby
require 'rails_helper'

RSpec.describe 'Order Flow with Inline Mode', type: :integration do
  around do |example|
    NatsPubsub::Testing.inline! do
      example.run
    end
  end

  it 'processes messages synchronously' do
    message = {
      order_id: 'ORD-INLINE-123',
      customer_id: 'CUST-456',
      total: 99.99
    }

    # Publish and process immediately (synchronously)
    NatsPubsub.publish('order.created', message)

    # No sleep needed - processed synchronously
    order = Order.find_by(order_id: 'ORD-INLINE-123')
    expect(order).to be_present
  end
end
```

---

## Test Utilities and Helpers

### JavaScript/TypeScript

#### Test Helper Functions

```typescript
// test/helpers/nats-helpers.ts
import NatsPubsub from "nats-pubsub";
import { TopicMetadata } from "nats-pubsub";

export function createMockMetadata(
  overrides?: Partial<TopicMetadata>,
): TopicMetadata {
  return {
    event_id: "evt-test-123",
    trace_id: "trace-test-456",
    topic: "test.topic",
    subject: "test.app.test.topic",
    occurred_at: new Date(),
    deliveries: 1,
    ...overrides,
  };
}

export function createMockMessage(data: Record<string, any>) {
  return {
    ...data,
    _test: true,
  };
}

export async function waitForMessage(timeout: number = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Message timeout"));
    }, timeout);

    // Poll for message processing
    const interval = setInterval(() => {
      // Check if message processed
      if (messageProcessed) {
        clearTimeout(timer);
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });
}
```

#### Custom Matchers

```typescript
// test/matchers/nats-matchers.ts
expect.extend({
  toHavePublished(received: any, topic: string) {
    const published = received.publishedMessages || [];
    const found = published.some((msg: any) => msg.topic === topic);

    return {
      pass: found,
      message: () =>
        found
          ? `Expected not to have published to ${topic}`
          : `Expected to have published to ${topic}, but found: ${published.map((m: any) => m.topic).join(", ")}`,
    };
  },

  toHaveProcessed(received: any, eventId: string) {
    const processed = received.processedEvents || [];
    const found = processed.some((evt: any) => evt.event_id === eventId);

    return {
      pass: found,
      message: () =>
        found
          ? `Expected not to have processed event ${eventId}`
          : `Expected to have processed event ${eventId}`,
    };
  },
});
```

### Ruby

#### Test Helper Module

```ruby
# spec/support/nats_helpers.rb
module NatsHelpers
  def create_mock_context(**overrides)
    double(
      'MessageContext',
      event_id: 'evt-test-123',
      trace_id: 'trace-test-456',
      topic: 'test.topic',
      subject: 'test.app.test.topic',
      occurred_at: Time.now,
      deliveries: 1,
      **overrides
    )
  end

  def create_mock_message(**data)
    data.stringify_keys.merge('_test' => true)
  end

  def wait_for_message(timeout: 5)
    Timeout.timeout(timeout) do
      loop do
        return if message_processed?
        sleep 0.1
      end
    end
  rescue Timeout::Error
    raise 'Message processing timeout'
  end
end

RSpec.configure do |config|
  config.include NatsHelpers, type: :subscriber
end
```

#### Custom RSpec Matchers

```ruby
# spec/support/matchers/nats_matchers.rb
RSpec::Matchers.define :have_published_to do |topic|
  match do |actual|
    NatsPubsub::Testing.published_events.any? do |event|
      event[:topic] == topic
    end
  end

  failure_message do
    published_topics = NatsPubsub::Testing.published_events.map { |e| e[:topic] }
    "expected to have published to #{topic}, but published to: #{published_topics.join(', ')}"
  end
end

RSpec::Matchers.define :have_processed_event do |event_id|
  match do |actual|
    ProcessedEvent.exists?(event_id: event_id)
  end

  failure_message do
    "expected to have processed event #{event_id}"
  end
end
```

---

## Mocking Strategies

### Mock NATS Connection

#### JavaScript/TypeScript

```typescript
// test/mocks/nats-connection.ts
export function createMockConnection() {
  const publishedMessages: any[] = [];

  const mockJetstream = {
    publish: jest.fn((subject, payload, options) => {
      publishedMessages.push({ subject, payload, options });
      return Promise.resolve();
    }),
  };

  const mockConnection = {
    ensureConnection: jest.fn().mockResolvedValue(undefined),
    getJetStream: jest.fn().mockReturnValue(mockJetstream),
    close: jest.fn().mockResolvedValue(undefined),
  };

  return {
    mockConnection,
    mockJetstream,
    publishedMessages,
  };
}

// Usage
const { mockConnection, publishedMessages } = createMockConnection();
jest.mock("../core/connection", () => mockConnection);
```

#### Ruby

```ruby
# spec/support/mocks/nats_connection.rb
module NatsMocks
  def mock_nats_connection
    published_messages = []

    mock_jetstream = instance_double('NATS::JetStream')
    allow(mock_jetstream).to receive(:publish) do |subject, payload, opts|
      published_messages << { subject: subject, payload: payload, options: opts }
    end

    allow(NatsPubsub::Connection).to receive(:connect!).and_return(mock_jetstream)

    { jetstream: mock_jetstream, published_messages: published_messages }
  end
end

RSpec.configure do |config|
  config.include NatsMocks
end
```

---

## Testing Middleware

### JavaScript/TypeScript

```typescript
import { LoggingMiddleware } from "../middleware/logging-middleware";

describe("LoggingMiddleware", () => {
  let middleware: LoggingMiddleware;
  let mockLogger: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    };

    middleware = new LoggingMiddleware(mockLogger);
    mockNext = jest.fn().mockResolvedValue(undefined);
  });

  it("logs before and after processing", async () => {
    const event = { id: "123" };
    const metadata = createMockMetadata({ subject: "test.subject" });

    await middleware.call(event, metadata, mockNext);

    expect(mockLogger.info).toHaveBeenCalledWith(
      "Processing message",
      expect.objectContaining({ subject: "test.subject" }),
    );

    expect(mockNext).toHaveBeenCalled();

    expect(mockLogger.info).toHaveBeenCalledWith(
      "Message processed",
      expect.objectContaining({ subject: "test.subject" }),
    );
  });

  it("logs errors", async () => {
    const event = { id: "123" };
    const metadata = createMockMetadata({ subject: "test.subject" });
    const error = new Error("Processing failed");

    mockNext.mockRejectedValue(error);

    await expect(middleware.call(event, metadata, mockNext)).rejects.toThrow(
      "Processing failed",
    );

    expect(mockLogger.error).toHaveBeenCalledWith(
      "Message processing failed",
      expect.objectContaining({
        subject: "test.subject",
        error: "Processing failed",
      }),
    );
  });
});
```

### Ruby

```ruby
require 'rails_helper'

RSpec.describe LoggingMiddleware do
  let(:middleware) { described_class.new }
  let(:message) { { 'id' => '123' } }
  let(:context) { create_mock_context(subject: 'test.subject') }

  describe '#call' do
    it 'logs before and after processing' do
      expect(Rails.logger).to receive(:info).with('Processing message', hash_including(subject: 'test.subject'))
      expect(Rails.logger).to receive(:info).with('Message processed', hash_including(subject: 'test.subject'))

      middleware.call(message, context) do
        # Handler logic
      end
    end

    it 'logs errors' do
      expect(Rails.logger).to receive(:error).with(
        'Message processing failed',
        hash_including(subject: 'test.subject', error: 'Processing failed')
      )

      expect {
        middleware.call(message, context) do
          raise 'Processing failed'
        end
      }.to raise_error('Processing failed')
    end
  end
end
```

---

## Testing Error Handling

### JavaScript/TypeScript

```typescript
describe("Error Handling", () => {
  it("retries on network errors", async () => {
    let attempts = 0;

    const subscriber = new TestSubscriber();
    const message = { id: "123" };
    const metadata = createMockMetadata();

    // Mock handler to fail twice, then succeed
    jest
      .spyOn(subscriber as any, "processMessage")
      .mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error("ECONNREFUSED");
        }
      });

    await subscriber.handle(message, metadata);

    expect(attempts).toBe(3);
  });

  it("sends to DLQ after max retries", async () => {
    const subscriber = new TestSubscriber();
    const message = { id: "123" };
    const metadata = createMockMetadata({ deliveries: 5 }); // Max retries

    jest
      .spyOn(subscriber as any, "processMessage")
      .mockRejectedValue(new Error("Permanent failure"));

    await expect(subscriber.handle(message, metadata)).rejects.toThrow(
      "Permanent failure",
    );

    // Verify sent to DLQ
    expect(mockJetstream.publish).toHaveBeenCalledWith(
      "test.events.dlq",
      expect.any(String),
      expect.any(Object),
    );
  });
});
```

---

## Best Practices

### 1. Use Descriptive Test Names

```typescript
// Good
it("publishes order.created event with correct payload", async () => {});
it("retries processing on network errors up to max attempts", async () => {});

// Bad
it("works", async () => {});
it("test1", async () => {});
```

### 2. Test One Thing at a Time

```typescript
// Good: Focused test
it("publishes message to correct subject", async () => {
  await NatsPubsub.publish("order.created", { order_id: "ORD-123" });
  expect(mockJetstream.publish).toHaveBeenCalledWith(
    "test.app.order.created",
    expect.any(String),
    expect.any(Object),
  );
});

// Bad: Testing multiple things
it("publishes and processes message", async () => {
  // Publishing logic...
  // Subscribing logic...
  // Validation logic...
});
```

### 3. Use Factories for Test Data

```typescript
// test/factories/message-factory.ts
export class MessageFactory {
  static orderCreated(overrides?: any) {
    return {
      order_id: "ORD-123",
      customer_id: "CUST-456",
      total: 99.99,
      ...overrides,
    };
  }

  static orderUpdated(overrides?: any) {
    return {
      order_id: "ORD-123",
      status: "shipped",
      ...overrides,
    };
  }
}

// Usage
const message = MessageFactory.orderCreated({ total: 199.99 });
```

### 4. Clean Up After Tests

```typescript
afterEach(async () => {
  // Clear mocks
  jest.clearAllMocks();

  // Clear database
  await Order.deleteMany({});

  // Clear cache
  await cache.flushAll();
});
```

---

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      nats:
        image: nats:latest
        ports:
          - 4222:4222
        options: >-
          -js

      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "20"

      - name: Install dependencies
        run: npm install

      - name: Run tests
        env:
          NATS_URL: nats://localhost:4222
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
        run: npm test

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### Docker Compose for Testing

```yaml
# docker-compose.test.yml
version: "3.8"

services:
  nats:
    image: nats:latest
    command: ["-js"]
    ports:
      - "4222:4222"

  postgres:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"

  test:
    build: .
    depends_on:
      - nats
      - postgres
    environment:
      NATS_URL: nats://nats:4222
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/test
    command: npm test
```

---

## Navigation

- **Previous**: [Middleware System](./middleware.md)
- **Next**: [Deployment Guide](./deployment.md)
- **Related**:
  - [API Reference](../reference/javascript-api.md)
