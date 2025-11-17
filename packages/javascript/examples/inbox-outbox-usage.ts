/**
 * Example: Using Inbox and Outbox Patterns
 *
 * This example demonstrates how to use the Inbox and Outbox patterns
 * for reliable message publishing and idempotent processing.
 */

import { connect } from 'nats';
import {
  OutboxPublisher,
  InboxProcessor,
  MemoryOutboxRepository,
  MemoryInboxRepository,
  MessageContext,
} from '../src/index';

/**
 * Example 1: Outbox Pattern - Reliable Publishing
 */
async function outboxExample() {
  console.log('\n=== Outbox Pattern Example ===\n');

  // 1. Create repository (use database-backed in production)
  const repository = new MemoryOutboxRepository();
  const publisher = new OutboxPublisher(repository);

  // 2. Connect to NATS
  const nc = await connect({ servers: 'nats://localhost:4222' });
  const js = nc.jetstream();

  try {
    // 3. Publish with Outbox pattern
    const result = await publisher.publish(
      {
        eventId: 'order-123',
        subject: 'dev.example.order.created',
        payload: JSON.stringify({
          event_id: 'order-123',
          message: {
            orderId: '123',
            customerId: 'customer-456',
            total: 99.99,
            items: [{ productId: 'prod-1', quantity: 2 }],
          },
        }),
        headers: JSON.stringify({ 'nats-msg-id': 'order-123' }),
      },
      async () => {
        // Actual NATS publish
        await js.publish(
          'dev.example.order.created',
          JSON.stringify({
            event_id: 'order-123',
            message: {
              orderId: '123',
              customerId: 'customer-456',
              total: 99.99,
            },
          })
        );
      }
    );

    if (result.success) {
      console.log('✅ Order published successfully via Outbox!');
      console.log('Event ID:', result.eventId);
      console.log('Subject:', result.subject);
    }

    // 4. Try publishing again (idempotency)
    console.log('\nAttempting to publish the same event again...');
    const duplicateResult = await publisher.publish(
      {
        eventId: 'order-123',
        subject: 'dev.example.order.created',
        payload: JSON.stringify({
          event_id: 'order-123',
          message: { orderId: '123' },
        }),
        headers: JSON.stringify({ 'nats-msg-id': 'order-123' }),
      },
      async () => {
        throw new Error('Should not be called!');
      }
    );

    if (duplicateResult.success && duplicateResult.details?.includes('Already sent')) {
      console.log('✅ Idempotency check passed - duplicate publish skipped!');
    }

    // 5. Check repository status
    const stats = repository.getCountByStatus();
    console.log('\nOutbox Statistics:');
    console.log('- Pending:', stats.pending);
    console.log('- Publishing:', stats.publishing);
    console.log('- Sent:', stats.sent);
    console.log('- Failed:', stats.failed);
  } finally {
    await nc.close();
  }
}

/**
 * Example 2: Inbox Pattern - Idempotent Processing
 */
async function inboxExample() {
  console.log('\n=== Inbox Pattern Example ===\n');

  // 1. Create repository (use database-backed in production)
  const repository = new MemoryInboxRepository();
  const processor = new InboxProcessor(repository);

  const context: MessageContext = {
    eventId: 'payment-789',
    subject: 'dev.example.payment.completed',
    topic: 'payment.completed',
    occurredAt: new Date(),
    deliveries: 1,
  };

  try {
    // 2. Process message with Inbox pattern
    console.log('Processing payment event...');
    const processed = await processor.process(
      {
        eventId: 'payment-789',
        subject: 'dev.example.payment.completed',
        payload: JSON.stringify({
          paymentId: '789',
          orderId: '123',
          amount: 99.99,
          status: 'completed',
        }),
        headers: JSON.stringify({ 'nats-msg-id': 'payment-789' }),
        deliveries: 1,
      },
      async (message, ctx) => {
        // Your processing logic (will only run once!)
        console.log('✅ Processing payment:', message);
        console.log('  Payment ID:', message.paymentId);
        console.log('  Amount:', message.amount);

        // Simulate processing
        await new Promise((resolve) => setTimeout(resolve, 100));

        console.log('  Payment processed successfully!');
      },
      context
    );

    if (processed) {
      console.log('\n✅ Message processed successfully!');
    }

    // 3. Try processing again (idempotency)
    console.log('\nAttempting to process the same message again...');
    const duplicateProcessed = await processor.process(
      {
        eventId: 'payment-789',
        subject: 'dev.example.payment.completed',
        payload: JSON.stringify({
          paymentId: '789',
          orderId: '123',
          amount: 99.99,
        }),
        headers: JSON.stringify({ 'nats-msg-id': 'payment-789' }),
        deliveries: 2, // Redelivery
      },
      async (message, ctx) => {
        throw new Error('Should not be called!');
      },
      context
    );

    if (!duplicateProcessed) {
      console.log('✅ Idempotency check passed - duplicate processing skipped!');
    }

    // 4. Check processing status
    const isProcessed = await processor.isProcessed('payment-789');
    console.log('\nIs payment-789 processed?', isProcessed);

    // 5. Check repository status
    const stats = repository.getCountByStatus();
    console.log('\nInbox Statistics:');
    console.log('- Processing:', stats.processing);
    console.log('- Processed:', stats.processed);
    console.log('- Failed:', stats.failed);
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Example 3: Background Worker for Outbox
 */
async function outboxWorkerExample() {
  console.log('\n=== Outbox Worker Example ===\n');

  const repository = new MemoryOutboxRepository();
  const publisher = new OutboxPublisher(repository);

  const nc = await connect({ servers: 'nats://localhost:4222' });
  const js = nc.jetstream();

  try {
    // Create some pending events
    console.log('Creating pending events...');
    for (let i = 1; i <= 5; i++) {
      await repository.findOrCreate({
        eventId: `event-${i}`,
        subject: `dev.example.test.${i}`,
        payload: JSON.stringify({ id: i, message: `Test event ${i}` }),
        headers: JSON.stringify({ 'nats-msg-id': `event-${i}` }),
      });
    }

    console.log('Created 5 pending events');

    // Process pending events
    console.log('\nProcessing pending events...');
    const results = await publisher.publishPending(
      100,
      async (eventId, subject, payload, headers) => {
        // Simulate NATS publish
        await js.publish(subject, payload, {
          msgID: eventId,
          headers: JSON.parse(headers),
        });
        console.log(`  ✅ Published event: ${eventId}`);
      }
    );

    console.log(`\nProcessing complete!`);
    console.log(`- Total: ${results.length}`);
    console.log(`- Success: ${results.filter((r) => r.success).length}`);
    console.log(`- Failed: ${results.filter((r) => !r.success).length}`);

    const stats = repository.getCountByStatus();
    console.log('\nFinal Outbox Statistics:');
    console.log('- Pending:', stats.pending);
    console.log('- Sent:', stats.sent);
  } finally {
    await nc.close();
  }
}

/**
 * Example 4: Cleanup Old Events
 */
async function cleanupExample() {
  console.log('\n=== Cleanup Example ===\n');

  const outboxRepo = new MemoryOutboxRepository();
  const inboxRepo = new MemoryInboxRepository();

  const outboxPublisher = new OutboxPublisher(outboxRepo);
  const inboxProcessor = new InboxProcessor(inboxRepo);

  // Create some old events
  console.log('Creating old events...');
  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - 10); // 10 days ago

  // Create and mark as sent (old)
  for (let i = 1; i <= 3; i++) {
    const event = await outboxRepo.findOrCreate({
      eventId: `old-${i}`,
      subject: `test.${i}`,
      payload: JSON.stringify({ id: i }),
      headers: JSON.stringify({}),
      enqueuedAt: oldDate,
    });
    await outboxRepo.markAsSent(`old-${i}`);
    // Manually set sentAt to old date
    const updated = await outboxRepo.findByEventId(`old-${i}`);
    if (updated) {
      updated.sentAt = oldDate;
    }
  }

  console.log('Created 3 old sent events');

  // Create recent events
  for (let i = 1; i <= 2; i++) {
    await outboxRepo.findOrCreate({
      eventId: `recent-${i}`,
      subject: `test.${i}`,
      payload: JSON.stringify({ id: i }),
      headers: JSON.stringify({}),
    });
    await outboxRepo.markAsSent(`recent-${i}`);
  }

  console.log('Created 2 recent sent events');

  console.log('\nBefore cleanup:');
  console.log('- Total events:', outboxRepo.getAll().length);

  // Cleanup events older than 7 days
  const deletedCount = await outboxPublisher.cleanup(7);

  console.log('\nAfter cleanup:');
  console.log('- Deleted:', deletedCount);
  console.log('- Remaining:', outboxRepo.getAll().length);
}

/**
 * Run all examples
 */
async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Inbox & Outbox Patterns Examples     ║');
  console.log('╚════════════════════════════════════════╝');

  try {
    await outboxExample();
    await inboxExample();
    await outboxWorkerExample();
    await cleanupExample();

    console.log('\n✅ All examples completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Error running examples:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { outboxExample, inboxExample, outboxWorkerExample, cleanupExample };
