import { OutboxPublisher } from '../../outbox/outbox-publisher';
import { MemoryOutboxRepository } from '../../outbox/memory-outbox-repository';
import { OutboxStatus } from '../../outbox/types';

describe('OutboxPublisher', () => {
  let repository: MemoryOutboxRepository;
  let publisher: OutboxPublisher;

  beforeEach(() => {
    repository = new MemoryOutboxRepository();
    publisher = new OutboxPublisher(repository);
  });

  describe('publish', () => {
    it('should publish a new event successfully', async () => {
      let publishCalled = false;

      const result = await publisher.publish(
        {
          eventId: 'event-123',
          subject: 'test.subject',
          payload: JSON.stringify({ test: 'data' }),
          headers: JSON.stringify({ 'nats-msg-id': 'event-123' }),
        },
        async () => {
          publishCalled = true;
        }
      );

      expect(result.success).toBe(true);
      expect(result.eventId).toBe('event-123');
      expect(result.subject).toBe('test.subject');
      expect(publishCalled).toBe(true);

      // Verify event was marked as sent
      const event = await repository.findByEventId('event-123');
      expect(event?.status).toBe(OutboxStatus.SENT);
      expect(event?.sentAt).toBeDefined();
      expect(event?.attempts).toBe(1);
    });

    it('should be idempotent - skip if already sent', async () => {
      let publishCount = 0;

      const params = {
        eventId: 'event-456',
        subject: 'test.subject',
        payload: JSON.stringify({ test: 'data' }),
        headers: JSON.stringify({ 'nats-msg-id': 'event-456' }),
      };

      // First publish
      await publisher.publish(params, async () => {
        publishCount++;
      });

      // Second publish (should skip)
      const result = await publisher.publish(params, async () => {
        publishCount++;
      });

      expect(result.success).toBe(true);
      expect(result.details).toContain('Already sent');
      expect(publishCount).toBe(1); // Should only publish once
    });

    it('should mark event as failed on publish error', async () => {
      const result = await publisher.publish(
        {
          eventId: 'event-789',
          subject: 'test.subject',
          payload: JSON.stringify({ test: 'data' }),
          headers: JSON.stringify({ 'nats-msg-id': 'event-789' }),
        },
        async () => {
          throw new Error('NATS connection failed');
        }
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('publish_failed');
      expect(result.error?.message).toContain('NATS connection failed');

      // Verify event was marked as failed
      const event = await repository.findByEventId('event-789');
      expect(event?.status).toBe(OutboxStatus.FAILED);
      expect(event?.lastError).toContain('NATS connection failed');
      expect(event?.attempts).toBe(1);
    });

    it('should increment attempts on each publish attempt', async () => {
      const params = {
        eventId: 'event-retry',
        subject: 'test.subject',
        payload: JSON.stringify({ test: 'data' }),
        headers: JSON.stringify({ 'nats-msg-id': 'event-retry' }),
      };

      // First attempt - fail
      await publisher.publish(params, async () => {
        throw new Error('Temporary failure');
      });

      let event = await repository.findByEventId('event-retry');
      expect(event?.attempts).toBe(1);

      // Reset to pending for retry
      await repository.findOrCreate(params);
      event = await repository.findByEventId('event-retry');
      if (event) {
        event.status = OutboxStatus.PENDING;
      }

      // Second attempt - succeed
      await publisher.publish(params, async () => {
        // Success
      });

      event = await repository.findByEventId('event-retry');
      expect(event?.attempts).toBe(2);
      expect(event?.status).toBe(OutboxStatus.SENT);
    });
  });

  describe('publishPending', () => {
    it('should publish multiple pending events', async () => {
      // Create pending events
      await repository.findOrCreate({
        eventId: 'event-1',
        subject: 'test.subject',
        payload: JSON.stringify({ id: 1 }),
        headers: JSON.stringify({}),
      });

      await repository.findOrCreate({
        eventId: 'event-2',
        subject: 'test.subject',
        payload: JSON.stringify({ id: 2 }),
        headers: JSON.stringify({}),
      });

      await repository.findOrCreate({
        eventId: 'event-3',
        subject: 'test.subject',
        payload: JSON.stringify({ id: 3 }),
        headers: JSON.stringify({}),
      });

      const publishedEvents: string[] = [];

      const results = await publisher.publishPending(100, async (eventId) => {
        publishedEvents.push(eventId);
      });

      expect(results.length).toBe(3);
      expect(results.filter((r) => r.success).length).toBe(3);
      expect(publishedEvents).toEqual(['event-1', 'event-2', 'event-3']);
    });

    it('should handle mixed success and failure', async () => {
      await repository.findOrCreate({
        eventId: 'event-success',
        subject: 'test.subject',
        payload: JSON.stringify({ id: 1 }),
        headers: JSON.stringify({}),
      });

      await repository.findOrCreate({
        eventId: 'event-fail',
        subject: 'test.subject',
        payload: JSON.stringify({ id: 2 }),
        headers: JSON.stringify({}),
      });

      const results = await publisher.publishPending(100, async (eventId) => {
        if (eventId === 'event-fail') {
          throw new Error('Publish failed');
        }
      });

      expect(results.length).toBe(2);
      expect(results.filter((r) => r.success).length).toBe(1);
      expect(results.filter((r) => !r.success).length).toBe(1);
    });

    it('should respect limit parameter', async () => {
      // Create 5 pending events
      for (let i = 1; i <= 5; i++) {
        await repository.findOrCreate({
          eventId: `event-${i}`,
          subject: 'test.subject',
          payload: JSON.stringify({ id: i }),
          headers: JSON.stringify({}),
        });
      }

      const results = await publisher.publishPending(2, async () => {
        // Success
      });

      expect(results.length).toBe(2);
    });
  });

  describe('cleanup', () => {
    it('should delete old sent events', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10); // 10 days ago

      // Create old sent event
      await repository.findOrCreate({
        eventId: 'old-event',
        subject: 'test.subject',
        payload: JSON.stringify({ test: 'data' }),
        headers: JSON.stringify({}),
        enqueuedAt: oldDate,
      });

      // Mark as sent with old date
      await repository.markAsSent('old-event');
      const updatedEvent = await repository.findByEventId('old-event');
      if (updatedEvent) {
        updatedEvent.sentAt = oldDate;
      }

      // Create recent sent event
      await repository.findOrCreate({
        eventId: 'recent-event',
        subject: 'test.subject',
        payload: JSON.stringify({ test: 'data' }),
        headers: JSON.stringify({}),
      });
      await repository.markAsSent('recent-event');

      const deletedCount = await publisher.cleanup(7);

      expect(deletedCount).toBe(1);

      const oldEvent = await repository.findByEventId('old-event');
      const recentEvent = await repository.findByEventId('recent-event');

      expect(oldEvent).toBeNull();
      expect(recentEvent).not.toBeNull();
    });
  });

  describe('resetStale', () => {
    it('should reset stale publishing events to pending', async () => {
      const staleDate = new Date();
      staleDate.setMinutes(staleDate.getMinutes() - 10); // 10 minutes ago

      // Create stale publishing event
      await repository.findOrCreate({
        eventId: 'stale-event',
        subject: 'test.subject',
        payload: JSON.stringify({ test: 'data' }),
        headers: JSON.stringify({}),
      });

      await repository.markAsPublishing('stale-event');
      const staleEvent = await repository.findByEventId('stale-event');
      if (staleEvent) {
        staleEvent.updatedAt = staleDate;
      }

      const resetCount = await publisher.resetStale(5);

      expect(resetCount).toBe(1);

      const resetEvent = await repository.findByEventId('stale-event');
      expect(resetEvent?.status).toBe(OutboxStatus.PENDING);
      expect(resetEvent?.lastError).toContain('stale');
    });
  });
});
