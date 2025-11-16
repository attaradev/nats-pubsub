# JavaScript/TypeScript API Reference

Complete API reference for the NatsPubsub JavaScript/TypeScript library.

## Table of Contents

- [Core API](#core-api)
- [Publisher API](#publisher-api)
- [Batch Publisher API](#batch-publisher-api)
- [Subscriber API](#subscriber-api)
- [Consumer API](#consumer-api)
- [Outbox Pattern API](#outbox-pattern-api)
- [Inbox Pattern API](#inbox-pattern-api)
- [Middleware API](#middleware-api)
- [Configuration API](#configuration-api)
- [Utilities](#utilities)
- [Type Definitions](#type-definitions)

---

## Core API

### NatsPubsub

The main entry point for all NatsPubsub functionality.

#### Methods

##### `configure(options: Partial<NatsPubsubConfig>): void`

Configure the library with custom settings.

**Parameters:**

- `options` - Configuration options (see [Configuration API](#configuration-api))

**Example:**

```typescript
import NatsPubsub from "nats-pubsub";

NatsPubsub.configure({
  env: "production",
  appName: "my-service",
  natsUrls: "nats://nats.example.com:4222",
  concurrency: 10,
  maxDeliver: 5,
  useDlq: true,
  useOutbox: true,
  useInbox: true,
});
```

##### `getConfig(): NatsPubsubConfig`

Get the current configuration.

**Returns:** `NatsPubsubConfig` - Current configuration object

**Example:**

```typescript
const config = NatsPubsub.getConfig();
console.log(`Environment: ${config.env}`);
console.log(`App Name: ${config.appName}`);
```

##### `validate(): void`

Validate the current configuration. Throws `ConfigurationError` if invalid.

**Throws:** `ConfigurationError` - If configuration is invalid

**Example:**

```typescript
try {
  NatsPubsub.validate();
  console.log("Configuration is valid");
} catch (error) {
  console.error("Invalid configuration:", error.message);
}
```

##### `connect(): Promise<void>`

Connect to NATS server.

**Returns:** `Promise<void>`

**Example:**

```typescript
await NatsPubsub.connect();
console.log("Connected to NATS");
```

##### `disconnect(): Promise<void>`

Disconnect from NATS server.

**Returns:** `Promise<void>`

**Example:**

```typescript
await NatsPubsub.disconnect();
console.log("Disconnected from NATS");
```

##### `ensureTopology(): Promise<void>`

Ensure JetStream topology (streams and consumers) is set up.

**Returns:** `Promise<void>`

**Example:**

```typescript
await NatsPubsub.ensureTopology();
console.log("Topology ensured");
```

##### `setup(options?: Partial<NatsPubsubConfig>): Promise<void>`

Configure, validate, and connect in one call.

**Parameters:**

- `options` - Optional configuration options

**Returns:** `Promise<void>`

**Example:**

```typescript
await NatsPubsub.setup({
  env: "production",
  appName: "my-service",
  natsUrls: "nats://nats.example.com:4222",
});
// Ready to publish/subscribe!
```

##### `publish(topic: string, message: Record<string, unknown>, options?: TopicPublishOptions): Promise<void>`

Publish a message to a topic.

**Parameters:**

- `topic` - Topic name (e.g., 'orders.created', 'notifications.email')
- `message` - Message payload
- `options` - Optional publish options

**Returns:** `Promise<void>`

**Example:**

```typescript
await NatsPubsub.publish(
  "orders.created",
  {
    orderId: "123",
    amount: 99.99,
    userId: "user-456",
  },
  {
    trace_id: "trace-123",
    correlation_id: "corr-456",
  },
);
```

##### `batch(): FluentBatchPublisher`

Create a fluent batch publisher for efficient multi-message publishing.

**Returns:** `FluentBatchPublisher` - Batch publisher instance

**Example:**

```typescript
const result = await NatsPubsub.batch()
  .add("user.created", { id: 1, name: "Alice" })
  .add("user.created", { id: 2, name: "Bob" })
  .add("notification.sent", { userId: 1 })
  .withOptions({ traceId: "batch-123" })
  .publish();

console.log(`Published ${result.successCount} messages`);
```

##### `registerSubscriber(subscriber: Subscriber): void`

Register a subscriber to handle messages.

**Parameters:**

- `subscriber` - Subscriber instance

**Example:**

```typescript
import { Subscriber } from "nats-pubsub";

class MySubscriber extends Subscriber {
  constructor() {
    super("production.myapp.orders.created");
  }

  async handle(message, context) {
    console.log("Order:", message);
  }
}

NatsPubsub.registerSubscriber(new MySubscriber());
```

##### `use(middleware: Middleware): void`

Add middleware to the processing chain.

**Parameters:**

- `middleware` - Middleware instance

**Example:**

```typescript
import { loggingMiddleware } from "nats-pubsub";

NatsPubsub.use(loggingMiddleware);
```

##### `start(): Promise<void>`

Start consuming messages.

**Returns:** `Promise<void>`

**Example:**

```typescript
await NatsPubsub.start();
console.log("Consumer started");
```

##### `stop(): Promise<void>`

Stop consuming messages.

**Returns:** `Promise<void>`

**Example:**

```typescript
await NatsPubsub.stop();
console.log("Consumer stopped");
```

##### `healthCheck(): Promise<HealthCheckResult>`

Perform comprehensive health check.

**Returns:** `Promise<HealthCheckResult>` - Health check result

**Example:**

```typescript
const health = await NatsPubsub.healthCheck();
console.log(`Status: ${health.status}`); // 'healthy', 'degraded', or 'unhealthy'
console.log(`Healthy: ${health.healthy}`);
console.log(`Components:`, health.components);
```

##### `quickHealthCheck(): Promise<HealthCheckResult>`

Perform quick health check (connection only).

**Returns:** `Promise<HealthCheckResult>` - Health check result

**Example:**

```typescript
const health = await NatsPubsub.quickHealthCheck();
console.log(`Healthy: ${health.healthy}`);
```

---

## Publisher API

### Publisher Class

Handles message publishing to NATS JetStream.

#### Constructor

```typescript
new Publisher(
  connectionManager?: ConnectionManager,
  logger?: Logger,
  envelopeBuilder?: EnvelopeBuilder,
  subjectBuilder?: SubjectBuilder,
  validator?: PublishValidator
)
```

**Parameters:**

- `connectionManager` - Connection manager (defaults to global connection)
- `logger` - Logger instance (defaults to config.logger)
- `envelopeBuilder` - Envelope builder (created from config if not provided)
- `subjectBuilder` - Subject builder (created from config if not provided)
- `validator` - Validator instance (created if not provided)

**Example:**

```typescript
import { Publisher } from "nats-pubsub";

const publisher = new Publisher();
```

#### Methods

##### `publishToTopic(topic: string, message: Record<string, unknown>, options?: TopicPublishOptions): Promise<void>`

Publish a message to a specific topic.

**Parameters:**

- `topic` - Topic name (e.g., 'notifications', 'users.user.created')
- `message` - Message payload
- `options` - Additional publish options

**Returns:** `Promise<void>`

**Example:**

```typescript
// Simple topic
await publisher.publishToTopic("notifications", { type: "email" });

// Hierarchical topic
await publisher.publishToTopic("notifications.email", {
  to: "user@example.com",
});

// With options
await publisher.publishToTopic(
  "analytics",
  { event: "page_view" },
  {
    trace_id: "trace-123",
    message_type: "urgent",
  },
);
```

##### `publishToTopics(topics: string[], message: Record<string, unknown>, options?: TopicPublishOptions): Promise<MultiTopicPublishResult>`

Publish to multiple topics at once.

**Parameters:**

- `topics` - Array of topic names
- `message` - Message payload
- `options` - Additional publish options

**Returns:** `Promise<MultiTopicPublishResult>` - Results object with statistics

**Example:**

```typescript
const result = await publisher.publishToTopics(
  ["notifications.email", "audit.user_events"],
  { action: "user_login", user_id: 123 },
);
console.log(`Published to ${result.successCount} topics`);
console.log(`Failed: ${result.failureCount}`);
```

##### `publish(topicOrParams, messageOrOptions?, options?): Promise<void | MultiTopicPublishResult>`

Polymorphic publish method supporting multiple patterns.

**Signatures:**

1. Single topic: `publish(topic: string, message: Record<string, unknown>, options?: TopicPublishOptions)`
2. Multiple topics: `publish(params: { topics: string[], message: Record<string, unknown> }, options?: TopicPublishOptions)`
3. Topic with params: `publish(params: { topic: string, message: Record<string, unknown> }, options?: TopicPublishOptions)`

**Examples:**

```typescript
// Single topic
await publisher.publish("notifications.email", { to: "user@example.com" });

// Multiple topics
await publisher.publish({
  topics: ["notifications.email", "audit.user_events"],
  message: { action: "login", userId: 123 },
});

// Topic with params
await publisher.publish({
  topic: "user.created",
  message: { id: 123, name: "John", email: "john@example.com" },
});
```

---

## Batch Publisher API

### BatchPublisher Class

Handles batch publishing operations.

#### Constructor

```typescript
new BatchPublisher(publisher?: Publisher, logger?: Logger)
```

**Parameters:**

- `publisher` - Publisher instance (defaults to global publisher)
- `logger` - Logger instance (defaults to config.logger)

#### Methods

##### `publishBatch(items: BatchPublishItem[]): Promise<BatchPublishResult>`

Publish multiple events in a batch.

**Parameters:**

- `items` - Array of items to publish

**Returns:** `Promise<BatchPublishResult>` - Result with statistics and error details

**Example:**

```typescript
import { BatchPublisher } from "nats-pubsub";

const batchPublisher = new BatchPublisher();

const items = [
  { topic: "user.created", message: { id: 1, name: "Alice" } },
  { topic: "user.updated", message: { id: 2, name: "Bob" } },
];

const result = await batchPublisher.publishBatch(items);
console.log(`Success: ${result.successful}, Failed: ${result.failed}`);
console.log(`Duration: ${result.duration}ms`);

// Check for errors
if (result.errors.length > 0) {
  result.errors.forEach((err) => {
    console.error(`Item ${err.index} failed: ${err.error}`);
  });
}
```

### FluentBatchPublisher Class

Fluent interface for batch publishing.

#### Methods

##### `add(topic: string, message: Record<string, unknown>): this`

Add a message to the batch.

**Parameters:**

- `topic` - Topic name
- `message` - Message payload

**Returns:** `this` - For chaining

##### `withOptions(options: TopicPublishOptions): this`

Set options for all messages in the batch.

**Parameters:**

- `options` - Publish options

**Returns:** `this` - For chaining

##### `publish(): Promise<FluentBatchPublishResult>`

Publish all messages in the batch.

**Returns:** `Promise<FluentBatchPublishResult>` - Result with statistics

**Example:**

```typescript
const result = await NatsPubsub.batch()
  .add("user.created", { id: 1, name: "Alice" })
  .add("user.created", { id: 2, name: "Bob" })
  .add("notification.sent", { userId: 1 })
  .withOptions({ trace_id: "batch-123" })
  .publish();

console.log(`Success: ${result.successCount}, Failed: ${result.failureCount}`);
```

---

## Subscriber API

### Subscriber Decorators

#### `@subscriber<TMessage>(subjects: string | string[], options?: SubscriberOptions)`

Decorator for creating subscriber classes.

**Parameters:**

- `subjects` - NATS subject(s) to subscribe to
- `options` - Optional subscriber options

**Example:**

```typescript
import { subscriber, EventMetadata } from "nats-pubsub";

interface UserCreatedMessage {
  id: string;
  name: string;
  email: string;
}

@subscriber<UserCreatedMessage>("production.app.user.created")
class UserSubscriber {
  async handle(message: UserCreatedMessage, metadata: EventMetadata) {
    console.log(`User created: ${message.name}`);
  }
}
```

#### `@topicSubscriber<TMessage>(topics: string | string[], options?: SubscriberOptions)`

Decorator for subscribing to topics.

**Parameters:**

- `topics` - Topic name(s) to subscribe to
- `options` - Optional subscriber options

**Example:**

```typescript
import { topicSubscriber, TopicMetadata } from "nats-pubsub";

interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

@topicSubscriber<EmailMessage>("notification.email")
class EmailNotificationSubscriber {
  async handle(message: EmailMessage, metadata: TopicMetadata) {
    console.log("Sending email to:", message.to);
  }
}

// With wildcards
@topicSubscriber("user.*")
class AllUserEventsSubscriber {
  async handle(message: Record<string, unknown>, metadata: TopicMetadata) {
    console.log("User event on topic:", metadata.topic);
  }
}
```

#### `@topicSubscriberWildcard<TMessage>(topic: string, options?: SubscriberOptions)`

Decorator for subscribing to all subtopics.

**Parameters:**

- `topic` - Topic name to subscribe to with wildcard
- `options` - Optional subscriber options

**Example:**

```typescript
import { topicSubscriberWildcard, TopicMetadata } from "nats-pubsub";

@topicSubscriberWildcard("notification")
class AllNotificationSubscriber {
  async handle(message: Record<string, unknown>, metadata: TopicMetadata) {
    // Receives: notification.email, notification.sms, notification.push, etc.
    console.log("Notification on:", metadata.topic);
  }
}
```

**Note:** The decorators are optional. You can also extend the `Subscriber` base class directly for more control.

### Subscriber Base Class

Abstract base class for subscribers.

```typescript
abstract class Subscriber<TMessage, TMetadata> implements SubscriberInterface
```

#### Constructor

```typescript
constructor(subjects: string | string[], options?: SubscriberOptions)
```

**Parameters:**

- `subjects` - NATS subject(s) to subscribe to
- `options` - Optional subscriber options

#### Properties

- `subjects: string[]` - Array of NATS subjects
- `options?: SubscriberOptions` - Subscriber options

#### Methods

##### `abstract handle(message: TMessage, metadata: TMetadata): Promise<void>`

Process a message. Must be implemented by subclasses.

**Parameters:**

- `message` - Typed message payload
- `metadata` - Typed metadata

**Returns:** `Promise<void>`

##### `fromTopic(metadata: TopicMetadata, topicName: string): boolean`

Check if message is from a specific topic.

**Parameters:**

- `metadata` - Topic metadata
- `topicName` - Topic name to check

**Returns:** `boolean`

##### `fromEvent(metadata: EventMetadata, domain: string, resource: string, action: string): boolean`

Check if message is from a specific domain/resource/action.

**Parameters:**

- `metadata` - Event metadata
- `domain` - Domain to check
- `resource` - Resource to check
- `action` - Action to check

**Returns:** `boolean`

##### `extractTopic(subject: string): string`

Extract topic from NATS subject.

**Parameters:**

- `subject` - NATS subject

**Returns:** `string` - Topic name

**Example:**

```typescript
import { Subscriber, TopicMetadata } from "nats-pubsub";

interface OrderPlacedMessage {
  orderId: string;
  userId: string;
  total: number;
}

class OrderSubscriber extends Subscriber<OrderPlacedMessage> {
  constructor() {
    super("production.shop.order.placed");
  }

  async handle(message: OrderPlacedMessage, metadata: TopicMetadata) {
    console.log(`Order ${message.orderId} total: $${message.total}`);
  }
}
```

---

## Consumer API

### Consumer Class

Orchestrates message consumption from NATS JetStream.

#### Methods

##### `registerSubscriber(subscriber: Subscriber): void`

Register a subscriber to handle messages.

**Parameters:**

- `subscriber` - Subscriber instance

##### `use(middleware: Middleware): void`

Add middleware to the processing chain.

**Parameters:**

- `middleware` - Middleware instance

##### `start(): Promise<void>`

Start consuming messages.

**Returns:** `Promise<void>`

##### `stop(): Promise<void>`

Stop consuming messages.

**Returns:** `Promise<void>`

**Example:**

```typescript
import { consumer, Subscriber } from "nats-pubsub";

class MySubscriber extends Subscriber {
  constructor() {
    super("production.app.orders.created");
  }

  async handle(message, metadata) {
    console.log("Order:", message);
  }
}

consumer.registerSubscriber(new MySubscriber());
await consumer.start();

// Later, gracefully stop
process.on("SIGTERM", async () => {
  await consumer.stop();
});
```

---

## Outbox Pattern API

### OutboxPublisher Class

Handles publishing messages using the Outbox pattern for reliable delivery.

#### Constructor

```typescript
new OutboxPublisher(repository: OutboxRepository, logger?: Logger)
```

**Parameters:**

- `repository` - Outbox repository instance
- `logger` - Logger instance (defaults to config.logger)

#### Methods

##### `publish(params: CreateOutboxEventParams, publishFn: () => Promise<void>): Promise<PublishResult>`

Publish a message using the Outbox pattern.

**Parameters:**

- `params` - Outbox event parameters
- `publishFn` - Function that performs the actual NATS publish

**Returns:** `Promise<PublishResult>` - Publish result

**Example:**

```typescript
import { OutboxPublisher, MemoryOutboxRepository } from "nats-pubsub";

const repository = new MemoryOutboxRepository();
const publisher = new OutboxPublisher(repository);

const result = await publisher.publish(
  {
    eventId: "event-123",
    subject: "production.app.order.created",
    payload: JSON.stringify(envelope),
    headers: JSON.stringify({ "nats-msg-id": "event-123" }),
  },
  async () => {
    // Actual NATS publish logic
    await js.publish(subject, payload);
  },
);

if (result.success) {
  console.log("Published successfully");
}
```

##### `publishPending(limit: number, publishFn: (eventId, subject, payload, headers) => Promise<void>): Promise<PublishResult[]>`

Publish a batch of pending events.

**Parameters:**

- `limit` - Maximum number of events to process (default: 100)
- `publishFn` - Function to publish each event

**Returns:** `Promise<PublishResult[]>` - Array of publish results

**Example:**

```typescript
const results = await publisher.publishPending(
  100,
  async (eventId, subject, payload, headers) => {
    await js.publish(subject, payload, { headers: JSON.parse(headers) });
  },
);

console.log(`Processed ${results.length} events`);
```

##### `cleanup(retentionDays: number): Promise<number>`

Cleanup old sent events.

**Parameters:**

- `retentionDays` - Number of days to retain sent events (default: 7)

**Returns:** `Promise<number>` - Number of events deleted

**Example:**

```typescript
const deletedCount = await publisher.cleanup(7);
console.log(`Cleaned up ${deletedCount} events`);
```

##### `resetStale(staleDurationMinutes: number): Promise<number>`

Reset stale publishing events.

**Parameters:**

- `staleDurationMinutes` - Duration in minutes to consider an event stale (default: 5)

**Returns:** `Promise<number>` - Number of events reset

**Example:**

```typescript
const resetCount = await publisher.resetStale(5);
console.log(`Reset ${resetCount} stale events`);
```

### OutboxRepository Interface

Interface for outbox persistence.

```typescript
interface OutboxRepository {
  findOrCreate(params: CreateOutboxEventParams): Promise<OutboxEvent>;
  findPending(options: { limit?: number }): Promise<OutboxEvent[]>;
  markAsPublishing(eventId: string): Promise<void>;
  markAsSent(eventId: string): Promise<void>;
  markAsFailed(eventId: string, error: string): Promise<void>;
  incrementAttempts(eventId: string): Promise<void>;
  cleanup(olderThan: Date): Promise<number>;
  resetStalePublishing(olderThan: Date): Promise<number>;
}
```

---

## Inbox Pattern API

### InboxProcessor Class

Handles idempotent message processing using the Inbox pattern.

#### Constructor

```typescript
new InboxProcessor(repository: InboxRepository, logger?: Logger)
```

**Parameters:**

- `repository` - Inbox repository instance
- `logger` - Logger instance (defaults to config.logger)

#### Methods

##### `process(params: CreateInboxEventParams, processFn: (message, context) => Promise<void>, context: MessageContext): Promise<boolean>`

Process a message using the Inbox pattern.

**Parameters:**

- `params` - Inbox event parameters
- `processFn` - Function that processes the message
- `context` - Message context

**Returns:** `Promise<boolean>` - True if processed, false if already processed

**Example:**

```typescript
import { InboxProcessor, MemoryInboxRepository } from "nats-pubsub";

const repository = new MemoryInboxRepository();
const processor = new InboxProcessor(repository);

const result = await processor.process(
  {
    eventId: "event-123",
    subject: "production.app.order.created",
    payload: JSON.stringify(message),
    headers: JSON.stringify(natsHeaders),
    deliveries: 1,
  },
  async (message, context) => {
    // Your message processing logic
    await orderService.createOrder(message);
  },
  context,
);

if (result) {
  console.log("Message processed");
} else {
  console.log("Message already processed (idempotent)");
}
```

##### `isProcessed(eventId: string): Promise<boolean>`

Check if a message was already processed.

**Parameters:**

- `eventId` - Event identifier

**Returns:** `Promise<boolean>` - True if already processed

**Example:**

```typescript
const alreadyProcessed = await processor.isProcessed("event-123");
if (alreadyProcessed) {
  console.log("Skip processing - already done");
}
```

##### `cleanup(retentionDays: number): Promise<number>`

Cleanup old processed events.

**Parameters:**

- `retentionDays` - Number of days to retain processed events (default: 30)

**Returns:** `Promise<number>` - Number of events deleted

##### `resetStale(staleDurationMinutes: number): Promise<number>`

Reset stale processing events.

**Parameters:**

- `staleDurationMinutes` - Duration in minutes to consider an event stale (default: 5)

**Returns:** `Promise<number>` - Number of events reset

##### `getFailedEvents(limit: number): Promise<InboxEvent[]>`

Get failed events for retry or manual intervention.

**Parameters:**

- `limit` - Maximum number of events to return (default: 100)

**Returns:** `Promise<InboxEvent[]>` - Array of failed inbox events

### InboxRepository Interface

Interface for inbox persistence.

```typescript
interface InboxRepository {
  findOrCreate(
    params: CreateInboxEventParams,
  ): Promise<{ event: InboxEvent; alreadyExists: boolean }>;
  findByStatus(
    status: InboxStatus,
    options: { limit?: number },
  ): Promise<InboxEvent[]>;
  markAsProcessed(eventId: string): Promise<void>;
  markAsFailed(eventId: string, error: string): Promise<void>;
  isProcessed(eventId: string): Promise<boolean>;
  cleanup(olderThan: Date): Promise<number>;
  resetStaleProcessing(olderThan: Date): Promise<number>;
}
```

---

## Middleware API

### Middleware Interface

```typescript
interface Middleware {
  call(
    event: Record<string, unknown>,
    metadata: EventMetadata,
    next: () => Promise<void>,
  ): Promise<void>;
}
```

### MiddlewareChain Class

Manages the middleware execution chain.

#### Methods

##### `add(middleware: Middleware): void`

Add middleware to the chain.

**Parameters:**

- `middleware` - Middleware instance

##### `execute(event: Record<string, unknown>, metadata: EventMetadata, handler: (event, metadata) => Promise<void>): Promise<void>`

Execute the middleware chain.

**Parameters:**

- `event` - Event payload
- `metadata` - Event metadata
- `handler` - Final handler function

**Returns:** `Promise<void>`

### Built-in Middleware

#### LoggingMiddleware

Logs message processing.

**Example:**

```typescript
import { loggingMiddleware } from "nats-pubsub";

consumer.use(loggingMiddleware);
```

#### RetryLoggerMiddleware

Logs retry attempts.

**Example:**

```typescript
import { retryLoggerMiddleware } from "nats-pubsub";

consumer.use(retryLoggerMiddleware);
```

### Custom Middleware

**Example:**

```typescript
import { Middleware, EventMetadata } from "nats-pubsub";

class TimingMiddleware implements Middleware {
  async call(
    event: Record<string, unknown>,
    metadata: EventMetadata,
    next: () => Promise<void>,
  ): Promise<void> {
    const start = Date.now();
    try {
      await next();
    } finally {
      const duration = Date.now() - start;
      console.log(`Processing took ${duration}ms`);
    }
  }
}

consumer.use(new TimingMiddleware());
```

---

## Configuration API

### config

Configuration singleton.

#### Methods

##### `configure(options: Partial<NatsPubsubConfig>): void`

Configure with custom settings.

**Parameters:**

- `options` - Configuration options

##### `configureWithPreset(preset: PresetName, overrides?: Partial<NatsPubsubConfig>): void`

Configure with a preset.

**Parameters:**

- `preset` - Preset name ('development', 'production', 'testing')
- `overrides` - Optional overrides to apply after preset

**Example:**

```typescript
import { config } from "nats-pubsub";

config.configureWithPreset("production", {
  natsUrls: "nats://nats.prod.example.com:4222",
  concurrency: 20,
});
```

##### `get(): NatsPubsubConfig`

Get the current configuration.

**Returns:** `NatsPubsubConfig`

##### `validate(): void`

Validate configuration. Throws `ConfigurationError` if invalid.

##### `getPreset(): PresetName | undefined`

Get the current preset name.

**Returns:** `PresetName | undefined`

---

## Utilities

### Subject

Subject parsing and building utilities.

#### Static Methods

##### `forTopic(env: string, appName: string, topic: string): string`

Build NATS subject for a topic.

**Parameters:**

- `env` - Environment name
- `appName` - Application name
- `topic` - Topic name

**Returns:** `string` - NATS subject

**Example:**

```typescript
import { Subject } from "nats-pubsub";

const subject = Subject.forTopic("production", "myapp", "orders.created");
// Returns: 'production.myapp.orders.created'
```

##### `parseTopic(subject: string): { env: string, appName: string, topic: string } | null`

Parse topic from NATS subject.

**Parameters:**

- `subject` - NATS subject

**Returns:** `{ env, appName, topic }` or `null`

**Example:**

```typescript
const parsed = Subject.parseTopic("production.myapp.orders.created");
// Returns: { env: 'production', appName: 'myapp', topic: 'orders.created' }
```

### Duration Utilities

#### `parseDuration(str: string): number`

Parse duration string to milliseconds.

**Parameters:**

- `str` - Duration string (e.g., '30s', '5m', '1h')

**Returns:** `number` - Duration in milliseconds

**Example:**

```typescript
import { parseDuration } from "nats-pubsub";

const ms = parseDuration("30s"); // 30000
const ms2 = parseDuration("5m"); // 300000
```

#### `toNanos(ms: number): number`

Convert milliseconds to nanoseconds.

**Parameters:**

- `ms` - Milliseconds

**Returns:** `number` - Nanoseconds

#### `fromNanos(nanos: number): number`

Convert nanoseconds to milliseconds.

**Parameters:**

- `nanos` - Nanoseconds

**Returns:** `number` - Milliseconds

### Error Classes

- `NatsPubsubError` - Base error class
- `ConnectionError` - Connection-related errors
- `PublishError` - Publishing errors
- `SubscriptionError` - Subscription errors
- `TopologyError` - Topology management errors
- `DlqError` - Dead letter queue errors
- `ConfigurationError` - Configuration errors
- `TimeoutError` - Timeout errors

**Example:**

```typescript
import { PublishError } from "nats-pubsub";

try {
  await publisher.publish("topic", message);
} catch (error) {
  if (error instanceof PublishError) {
    console.error("Publish failed:", error.message);
  }
}
```

---

## Type Definitions

### NatsPubsubConfig

```typescript
interface NatsPubsubConfig {
  natsUrls: string | string[];
  env: string;
  appName: string;
  concurrency?: number;
  maxDeliver?: number;
  ackWait?: number;
  backoff?: number[];
  useOutbox?: boolean;
  useInbox?: boolean;
  useDlq?: boolean;
  streamName?: string;
  dlqSubject?: string;
  metrics?: {
    recordDlqMessage(subject: string, reason: string): void;
  };
  perMessageConcurrency?: number;
  subscriberTimeoutMs?: number;
  dlqMaxAttempts?: number;
  logger?: Logger;
}
```

### MessageContext

```typescript
interface MessageContext {
  eventId: string;
  subject: string;
  topic: string;
  traceId?: string;
  correlationId?: string;
  occurredAt: Date;
  deliveries: number;
  stream?: string;
  streamSeq?: number;
  producer?: string;
  domain?: string;
  resource?: string;
  action?: string;
}
```

### PublishOptions

```typescript
interface PublishOptions {
  event_id?: string;
  trace_id?: string;
  occurred_at?: Date;
  correlation_id?: string;
  ttl?: number;
  priority?: number;
}
```

### TopicPublishOptions

```typescript
interface TopicPublishOptions extends PublishOptions {
  message_type?: string;
  domain?: string;
  resource?: string;
  action?: string;
  resource_id?: string;
}
```

### SubscriberOptions

```typescript
interface SubscriberOptions {
  retry?: number;
  ackWait?: number;
  maxDeliver?: number;
  retryStrategy?: RetryStrategy | number;
  circuitBreaker?: CircuitBreakerConfig;
  deadLetter?: DlqConfig | boolean;
  schema?: unknown;
}
```

### ErrorAction

```typescript
enum ErrorAction {
  RETRY = "retry",
  DISCARD = "discard",
  DLQ = "dlq",
}
```

### ErrorContext

```typescript
interface ErrorContext {
  error: Error;
  message: Record<string, unknown>;
  context: MessageContext;
  attemptNumber: number;
  maxAttempts: number;
}
```

### RetryStrategy

```typescript
interface RetryStrategy {
  maxAttempts: number;
  backoff: "exponential" | "linear" | "fixed";
  initialDelay?: number;
  maxDelay?: number;
  multiplier?: number;
}
```

### CircuitBreakerConfig

```typescript
interface CircuitBreakerConfig {
  enabled: boolean;
  threshold: number;
  timeout: number;
  halfOpenMaxCalls: number;
}
```

### DlqConfig

```typescript
interface DlqConfig {
  enabled: boolean;
  maxAttempts: number;
  subject?: string;
}
```

### BatchPublishItem

```typescript
interface BatchPublishItem {
  topic: string;
  message: Record<string, unknown>;
  options?: TopicPublishOptions;
}
```

### BatchPublishResult

```typescript
interface BatchPublishResult {
  successful: number;
  failed: number;
  errors: Array<{
    index: number;
    item: BatchPublishItem;
    error: string;
  }>;
  duration: number;
}
```

---

## See Also

- [Ruby API Reference](./ruby-api.md)
- [Configuration Reference](./configuration.md)
- [CLI Reference](./cli.md)
- [Getting Started Guide](../getting-started/quickstart.md)
- [Topic-Based PubSub Guide](../guides/topics.md)
