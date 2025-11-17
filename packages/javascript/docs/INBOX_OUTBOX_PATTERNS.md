# Inbox & Outbox Patterns

This guide explains the **Inbox** and **Outbox** patterns implemented in the NatsPubsub JavaScript package, providing transactional guarantees for message publishing and processing.

## Table of Contents

- [Overview](#overview)
- [Outbox Pattern (Reliable Send)](#outbox-pattern-reliable-send)
- [Inbox Pattern (Idempotent Receive)](#inbox-pattern-idempotent-receive)
- [Database Setup](#database-setup)
- [Implementation Examples](#implementation-examples)
- [Testing](#testing)
- [Maintenance & Cleanup](#maintenance--cleanup)
- [Best Practices](#best-practices)

---

## Overview

The Inbox and Outbox patterns solve critical distributed systems problems:

| Problem                                                               | Solution                          | Pattern    |
| --------------------------------------------------------------------- | --------------------------------- | ---------- |
| **Message Loss**: App crashes after DB commit but before NATS publish | Persist message before publishing | **Outbox** |
| **Duplicate Processing**: Same message processed multiple times       | Track processed messages          | **Inbox**  |

### When to Use

**Outbox Pattern** - Use when:

- ✅ Message delivery must be guaranteed (financial transactions, orders)
- ✅ Message publishing must be transactional with database operations
- ✅ You can tolerate at-least-once delivery semantics

**Inbox Pattern** - Use when:

- ✅ Duplicate processing would cause problems (double charges, duplicate orders)
- ✅ You need exactly-once processing semantics
- ✅ Messages have unique identifiers (event_id or stream sequence)

---

## Outbox Pattern (Reliable Send)

The Outbox pattern ensures messages are reliably published by storing them in a database before publishing to NATS.

### How It Works

```
┌─────────────────────────────────────────────────────────┐
│                  Outbox Publish Flow                    │
└─────────────────────────────────────────────────────────┘

1. Store event in database (status: pending)
     │
     ├─ If crash here → Event persisted, will retry
     │
2. Publish to NATS
     │
     ├─ If crash here → Event persisted, will retry
     │
3. Mark as sent in database (status: sent)
     │
     └─ Success! Message delivered with guarantee
```

### Basic Usage

```typescript
import { OutboxPublisher, MemoryOutboxRepository } from 'nats-pubsub';

// 1. Create repository (in-memory for development)
const repository = new MemoryOutboxRepository();

// 2. Create publisher
const outboxPublisher = new OutboxPublisher(repository);

// 3. Publish with Outbox pattern
const result = await outboxPublisher.publish(
  {
    eventId: 'order-123',
    subject: 'production.myapp.order.created',
    payload: JSON.stringify({
      event_id: 'order-123',
      message: { orderId: '123', total: 99.99 },
    }),
    headers: JSON.stringify({ 'nats-msg-id': 'order-123' }),
  },
  async () => {
    // Your NATS publish logic
    await js.publish(subject, payload);
  }
);

if (result.success) {
  console.log('Order event published successfully!');
}
```

### With Database Transactions

```typescript
import { OutboxPublisher } from 'nats-pubsub';
import { DatabaseOutboxRepository } from './my-database-repository';

// Custom repository backed by your database
const repository = new DatabaseOutboxRepository(db);
const publisher = new OutboxPublisher(repository);

// Transactional publish
await db.transaction(async (trx) => {
  // 1. Create order in database
  const order = await trx('orders')
    .insert({
      id: 'order-123',
      customer_id: 'customer-456',
      total: 99.99,
    })
    .returning('*');

  // 2. Store event in outbox (same transaction!)
  await publisher.publish(
    {
      eventId: `order-${order.id}`,
      subject: 'production.myapp.order.created',
      payload: JSON.stringify({
        event_id: `order-${order.id}`,
        message: order,
      }),
      headers: JSON.stringify({ 'nats-msg-id': `order-${order.id}` }),
    },
    async () => {
      await js.publish(subject, payload);
    }
  );
});

// If transaction rolls back, neither order nor event is committed
// If transaction commits, event is guaranteed to be published (eventually)
```

### Background Worker

Process pending outbox events in the background:

```typescript
import { OutboxPublisher } from 'nats-pubsub';

async function outboxWorker() {
  const publisher = new OutboxPublisher(repository);

  setInterval(async () => {
    try {
      // Process up to 100 pending events
      const results = await publisher.publishPending(
        100,
        async (eventId, subject, payload, headers) => {
          await js.publish(subject, payload, {
            msgID: eventId,
            headers: JSON.parse(headers),
          });
        }
      );

      console.log(`Processed ${results.length} outbox events`);
    } catch (error) {
      console.error('Outbox worker error:', error);
    }
  }, 5000); // Every 5 seconds
}

outboxWorker();
```

---

## Inbox Pattern (Idempotent Receive)

The Inbox pattern ensures messages are processed exactly once by tracking processed message IDs.

### How It Works

```
┌─────────────────────────────────────────────────────────┐
│                  Inbox Process Flow                     │
└─────────────────────────────────────────────────────────┘

1. Check if event_id already processed
     │
     ├─ If yes → Skip processing (idempotent)
     │
2. Store event in database (status: processing)
     │
3. Process the message
     │
     ├─ If crash here → Event in "processing", will be reset
     │
4. Mark as processed in database (status: processed)
     │
     └─ Success! Message processed exactly once
```

### Basic Usage

```typescript
import { InboxProcessor, MemoryInboxRepository } from 'nats-pubsub';

// 1. Create repository (in-memory for development)
const repository = new MemoryInboxRepository();

// 2. Create processor
const inboxProcessor = new InboxProcessor(repository);

// 3. Process with Inbox pattern
const processed = await inboxProcessor.process(
  {
    eventId: 'order-123',
    subject: 'production.myapp.order.created',
    payload: JSON.stringify({ orderId: '123', total: 99.99 }),
    headers: JSON.stringify({ 'nats-msg-id': 'order-123' }),
    deliveries: 1,
  },
  async (message, context) => {
    // Your processing logic
    await createOrder(message);
  },
  context
);

if (processed) {
  console.log('Order processed successfully!');
} else {
  console.log('Order already processed (idempotent)');
}
```

### With Subscriber

Integrate Inbox pattern into your subscribers:

```typescript
import { Subscriber, InboxProcessor, MessageContext } from 'nats-pubsub';

class OrderSubscriber extends Subscriber {
  private inboxProcessor: InboxProcessor;

  constructor(inboxProcessor: InboxProcessor) {
    super('production.myapp.order.*');
    this.inboxProcessor = inboxProcessor;
  }

  async handle(message: Record<string, unknown>, metadata: MessageContext): Promise<void> {
    // Use Inbox pattern for idempotent processing
    const processed = await this.inboxProcessor.process(
      {
        eventId: metadata.eventId,
        subject: metadata.subject,
        payload: JSON.stringify(message),
        headers: JSON.stringify({}),
        stream: metadata.stream,
        streamSeq: metadata.streamSeq,
        deliveries: metadata.deliveries,
      },
      async (msg, ctx) => {
        // This logic will only run once per unique event_id
        await this.processOrder(msg);
      },
      metadata
    );

    if (!processed) {
      console.log(`Order ${metadata.eventId} already processed, skipping`);
    }
  }

  private async processOrder(message: Record<string, unknown>): Promise<void> {
    // Your idempotent processing logic
    console.log('Processing order:', message);
  }
}
```

### Deduplication Strategies

The Inbox pattern supports two deduplication strategies:

**1. By Event ID (Primary)**

```typescript
const processed = await inboxProcessor.process(
  {
    eventId: 'unique-event-123', // Primary deduplication key
    subject: 'test.subject',
    payload: JSON.stringify({ data: 'test' }),
    headers: JSON.stringify({}),
    deliveries: 1,
  },
  processFn,
  context
);
```

**2. By JetStream Sequence (Secondary)**

```typescript
const processed = await inboxProcessor.process(
  {
    eventId: 'event-123',
    subject: 'test.subject',
    payload: JSON.stringify({ data: 'test' }),
    headers: JSON.stringify({}),
    stream: 'EVENTS', // Stream name
    streamSeq: 12345, // Sequence number
    deliveries: 1,
  },
  processFn,
  context
);
```

---

## Database Setup

### SQL Schemas

The package provides ready-to-use SQL schemas for popular databases:

#### PostgreSQL

```typescript
import { POSTGRES_OUTBOX_SCHEMA, POSTGRES_INBOX_SCHEMA } from 'nats-pubsub';

// Run migrations
await db.query(POSTGRES_OUTBOX_SCHEMA);
await db.query(POSTGRES_INBOX_SCHEMA);
```

#### MySQL

```typescript
import { MYSQL_OUTBOX_SCHEMA, MYSQL_INBOX_SCHEMA } from 'nats-pubsub';

await connection.query(MYSQL_OUTBOX_SCHEMA);
await connection.query(MYSQL_INBOX_SCHEMA);
```

#### SQLite

```typescript
import { SQLITE_OUTBOX_SCHEMA, SQLITE_INBOX_SCHEMA } from 'nats-pubsub';

await db.exec(SQLITE_OUTBOX_SCHEMA);
await db.exec(SQLITE_INBOX_SCHEMA);
```

### ORM Examples

#### TypeORM

See [TYPEORM_OUTBOX_ENTITY](../src/outbox/sql-schemas.ts) and [TYPEORM_INBOX_ENTITY](../src/inbox/sql-schemas.ts) for entity definitions.

#### Prisma

See [PRISMA_OUTBOX_SCHEMA](../src/outbox/sql-schemas.ts) and [PRISMA_INBOX_SCHEMA](../src/inbox/sql-schemas.ts) for schema definitions.

#### Knex.js

See [KNEX_OUTBOX_MIGRATION](../src/outbox/sql-schemas.ts) and [KNEX_INBOX_MIGRATION](../src/inbox/sql-schemas.ts) for migration files.

---

## Implementation Examples

### Custom PostgreSQL Repository

```typescript
import { OutboxRepository, OutboxEvent, OutboxStatus } from 'nats-pubsub';
import { Pool } from 'pg';

export class PostgresOutboxRepository implements OutboxRepository {
  constructor(private pool: Pool) {}

  async findOrCreate(params): Promise<OutboxEvent> {
    const result = await this.pool.query(
      `
      INSERT INTO nats_outbox_events (event_id, subject, payload, headers, enqueued_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (event_id) DO UPDATE SET updated_at = NOW()
      RETURNING *
    `,
      [
        params.eventId,
        params.subject,
        params.payload,
        params.headers,
        params.enqueuedAt || new Date(),
      ]
    );

    return this.mapRow(result.rows[0]);
  }

  async markAsSent(eventId: string): Promise<void> {
    await this.pool.query(
      `
      UPDATE nats_outbox_events
      SET status = 'sent', sent_at = NOW(), updated_at = NOW()
      WHERE event_id = $1
    `,
      [eventId]
    );
  }

  // Implement remaining methods...
}
```

### With Knex.js

```typescript
import { OutboxRepository, OutboxEvent, OutboxStatus } from 'nats-pubsub';
import { Knex } from 'knex';

export class KnexOutboxRepository implements OutboxRepository {
  constructor(private knex: Knex) {}

  async findOrCreate(params): Promise<OutboxEvent> {
    const [event] = await this.knex('nats_outbox_events')
      .insert({
        event_id: params.eventId,
        subject: params.subject,
        payload: params.payload,
        headers: params.headers,
        enqueued_at: params.enqueuedAt || new Date(),
      })
      .onConflict('event_id')
      .merge({ updated_at: this.knex.fn.now() })
      .returning('*');

    return event;
  }

  async findPending(options = {}): Promise<OutboxEvent[]> {
    let query = this.knex('nats_outbox_events')
      .where('status', OutboxStatus.PENDING)
      .orderBy('enqueued_at', 'asc');

    if (options.limit) {
      query = query.limit(options.limit);
    }

    return await query;
  }

  // Implement remaining methods...
}
```

---

## Testing

### Testing with In-Memory Repositories

```typescript
import { OutboxPublisher, MemoryOutboxRepository } from 'nats-pubsub';

describe('OrderService', () => {
  let repository: MemoryOutboxRepository;
  let publisher: OutboxPublisher;

  beforeEach(() => {
    repository = new MemoryOutboxRepository();
    publisher = new OutboxPublisher(repository);
  });

  afterEach(() => {
    repository.clear(); // Clean up between tests
  });

  it('should publish order event via outbox', async () => {
    const result = await publisher.publish(
      {
        eventId: 'test-order-123',
        subject: 'test.order.created',
        payload: JSON.stringify({ orderId: '123' }),
        headers: JSON.stringify({}),
      },
      async () => {
        // Mock NATS publish
      }
    );

    expect(result.success).toBe(true);

    // Verify event in repository
    const event = await repository.findByEventId('test-order-123');
    expect(event?.status).toBe('sent');
  });

  it('should be idempotent', async () => {
    let publishCount = 0;

    const params = {
      eventId: 'test-order-456',
      subject: 'test.order.created',
      payload: JSON.stringify({ orderId: '456' }),
      headers: JSON.stringify({}),
    };

    // First publish
    await publisher.publish(params, async () => {
      publishCount++;
    });

    // Second publish (should skip)
    await publisher.publish(params, async () => {
      publishCount++;
    });

    expect(publishCount).toBe(1); // Only published once!
  });
});
```

### Integration Tests

```typescript
import { OutboxPublisher, InboxProcessor } from 'nats-pubsub';
import { connect } from 'nats';

describe('End-to-End Outbox/Inbox', () => {
  it('should publish and process with transactional guarantees', async () => {
    const nc = await connect({ servers: 'nats://localhost:4222' });
    const js = nc.jetstream();

    const outboxRepo = new MemoryOutboxRepository();
    const inboxRepo = new MemoryInboxRepository();

    const publisher = new OutboxPublisher(outboxRepo);
    const processor = new InboxProcessor(inboxRepo);

    // Publish with Outbox
    await publisher.publish(
      {
        eventId: 'integration-test-1',
        subject: 'test.integration',
        payload: JSON.stringify({ test: 'data' }),
        headers: JSON.stringify({}),
      },
      async () => {
        await js.publish('test.integration', JSON.stringify({ test: 'data' }));
      }
    );

    // Simulate message reception and process with Inbox
    const processed = await processor.process(
      {
        eventId: 'integration-test-1',
        subject: 'test.integration',
        payload: JSON.stringify({ test: 'data' }),
        headers: JSON.stringify({}),
        deliveries: 1,
      },
      async (message, context) => {
        console.log('Processed:', message);
      },
      createContext('integration-test-1')
    );

    expect(processed).toBe(true);

    await nc.close();
  });
});
```

---

## Maintenance & Cleanup

### Cleanup Old Events

Both Outbox and Inbox tables can grow unbounded. Run periodic cleanup:

```typescript
import { OutboxPublisher, InboxProcessor } from 'nats-pubsub';

// Cleanup worker
async function maintenanceWorker() {
  const outboxPublisher = new OutboxPublisher(outboxRepository);
  const inboxProcessor = new InboxProcessor(inboxRepository);

  setInterval(async () => {
    try {
      // Clean up outbox events older than 7 days
      const deletedOutbox = await outboxPublisher.cleanup(7);
      console.log(`Deleted ${deletedOutbox} old outbox events`);

      // Clean up inbox events older than 30 days
      const deletedInbox = await inboxProcessor.cleanup(30);
      console.log(`Deleted ${deletedInbox} old inbox events`);

      // Reset stale events
      await outboxPublisher.resetStale(5); // 5 minutes
      await inboxProcessor.resetStale(5);
    } catch (error) {
      console.error('Maintenance error:', error);
    }
  }, 3600000); // Every hour
}
```

### Monitoring

Monitor the health of your Inbox/Outbox tables:

```typescript
// Get statistics
const outboxStats = repository.getCountByStatus();
console.log('Outbox Stats:', {
  pending: outboxStats.pending,
  publishing: outboxStats.publishing,
  sent: outboxStats.sent,
  failed: outboxStats.failed,
});

// Alert if too many failed events
if (outboxStats.failed > 100) {
  console.error('HIGH NUMBER OF FAILED OUTBOX EVENTS!');
  // Send alert to monitoring system
}
```

---

## Best Practices

### Outbox Pattern

✅ **Do:**

- Use database transactions when creating outbox events
- Run background workers to process pending events
- Set up monitoring for failed events
- Clean up old sent events regularly
- Use unique, deterministic event IDs

❌ **Don't:**

- Publish directly to NATS without outbox if transactional guarantees are needed
- Forget to run cleanup jobs (tables will grow unbounded)
- Ignore failed events (they indicate problems)
- Use outbox for high-frequency, non-critical events (adds overhead)

### Inbox Pattern

✅ **Do:**

- Use event_id as the primary deduplication key
- Use stream sequence as a secondary deduplication key
- Clean up old processed events regularly
- Make your processing logic idempotent (defense in depth)
- Handle the "already processed" case gracefully

❌ **Don't:**

- Rely solely on Inbox for idempotency (also make processing logic idempotent)
- Store sensitive data in payload (it's persisted in database)
- Use Inbox for every message (only when duplicate processing is problematic)
- Forget to handle message redeliveries

### Performance

- **Outbox**: Background workers should process events in batches
- **Inbox**: Use database indexes on event_id and stream+sequence
- **Cleanup**: Run during off-peak hours
- **Monitoring**: Track table sizes and processing latency

---

## Summary

| Pattern    | Purpose               | When to Use                     | Guarantees              |
| ---------- | --------------------- | ------------------------------- | ----------------------- |
| **Outbox** | Reliable publishing   | Transactional guarantees needed | At-least-once delivery  |
| **Inbox**  | Idempotent processing | Duplicate processing is harmful | Exactly-once processing |

Both patterns can be used together for end-to-end exactly-once semantics:

```
[Service A] ---(Outbox)---> [NATS] ---(Inbox)---> [Service B]
```

This provides the strongest guarantees in distributed systems! 🎉
