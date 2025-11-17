import { describe, it, expect, beforeEach } from '@jest/globals';
import { InboxProcessor } from '../../inbox/inbox-processor';
import { MemoryInboxRepository } from '../../inbox/memory-inbox-repository';
import { InboxStatus } from '../../inbox/types';
import { MessageContext } from '../../types';

describe('InboxProcessor', () => {
  let repository: MemoryInboxRepository;
  let processor: InboxProcessor;

  const createContext = (eventId: string): MessageContext => ({
    eventId,
    subject: 'test.subject',
    topic: 'test.subject',
    occurredAt: new Date(),
    deliveries: 1,
  });

  beforeEach(() => {
    repository = new MemoryInboxRepository();
    processor = new InboxProcessor(repository);
  });

  describe('process', () => {
    it('should process a new message successfully', async () => {
      let processedMessage: any = null;

      const processed = await processor.process(
        {
          eventId: 'event-123',
          subject: 'test.subject',
          payload: JSON.stringify({ test: 'data', id: 123 }),
          headers: JSON.stringify({ 'nats-msg-id': 'event-123' }),
          deliveries: 1,
        },
        async (message) => {
          processedMessage = message;
        },
        createContext('event-123')
      );

      expect(processed).toBe(true);
      expect(processedMessage).toEqual({ test: 'data', id: 123 });

      // Verify event was marked as processed
      const event = await repository.findByEventId('event-123');
      expect(event?.status).toBe(InboxStatus.PROCESSED);
      expect(event?.processedAt).toBeDefined();
    });

    it('should be idempotent - skip if already processed', async () => {
      let processCount = 0;

      const params = {
        eventId: 'event-456',
        subject: 'test.subject',
        payload: JSON.stringify({ test: 'data' }),
        headers: JSON.stringify({ 'nats-msg-id': 'event-456' }),
        deliveries: 1,
      };

      const context = createContext('event-456');

      // First processing
      await processor.process(
        params,
        async () => {
          processCount++;
        },
        context
      );

      // Second processing (should skip)
      const duplicateProcessed = await processor.process(
        params,
        async () => {
          processCount++;
        },
        context
      );

      expect(duplicateProcessed).toBe(false); // Not processed (already done)
      expect(processCount).toBe(1); // Should only process once
    });

    it('should mark event as failed on processing error', async () => {
      const params = {
        eventId: 'event-789',
        subject: 'test.subject',
        payload: JSON.stringify({ test: 'data' }),
        headers: JSON.stringify({ 'nats-msg-id': 'event-789' }),
        deliveries: 1,
      };

      await expect(
        processor.process(
          params,
          async () => {
            throw new Error('Processing failed');
          },
          createContext('event-789')
        )
      ).rejects.toThrow('Processing failed');

      // Verify event was marked as failed
      const event = await repository.findByEventId('event-789');
      expect(event?.status).toBe(InboxStatus.FAILED);
      expect(event?.lastError).toContain('Processing failed');
    });

    it('should deduplicate by stream sequence', async () => {
      let processCount = 0;

      // First message with stream sequence
      await processor.process(
        {
          eventId: 'event-1',
          subject: 'test.subject',
          payload: JSON.stringify({ test: 'data' }),
          headers: JSON.stringify({}),
          stream: 'test-stream',
          streamSeq: 100,
          deliveries: 1,
        },
        async () => {
          processCount++;
        },
        createContext('event-1')
      );

      // Same stream sequence, different event ID (duplicate)
      const processed = await processor.process(
        {
          eventId: 'event-2',
          subject: 'test.subject',
          payload: JSON.stringify({ test: 'data' }),
          headers: JSON.stringify({}),
          stream: 'test-stream',
          streamSeq: 100,
          deliveries: 2,
        },
        async () => {
          processCount++;
        },
        createContext('event-2')
      );

      expect(processed).toBe(false); // Should skip
      expect(processCount).toBe(1); // Should only process once
    });
  });

  describe('isProcessed', () => {
    it('should return true for processed events', async () => {
      await processor.process(
        {
          eventId: 'processed-event',
          subject: 'test.subject',
          payload: JSON.stringify({ test: 'data' }),
          headers: JSON.stringify({}),
          deliveries: 1,
        },
        async () => {},
        createContext('processed-event')
      );

      const isProcessed = await processor.isProcessed('processed-event');
      expect(isProcessed).toBe(true);
    });

    it('should return false for unprocessed events', async () => {
      const isProcessed = await processor.isProcessed('non-existent');
      expect(isProcessed).toBe(false);
    });

    it('should return false for failed events', async () => {
      try {
        await processor.process(
          {
            eventId: 'failed-event',
            subject: 'test.subject',
            payload: JSON.stringify({ test: 'data' }),
            headers: JSON.stringify({}),
            deliveries: 1,
          },
          async () => {
            throw new Error('Fail');
          },
          createContext('failed-event')
        );
      } catch {
        // Expected
      }

      const isProcessed = await processor.isProcessed('failed-event');
      expect(isProcessed).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should delete old processed events', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40); // 40 days ago

      // Create old processed event
      await repository.create({
        eventId: 'old-event',
        subject: 'test.subject',
        payload: JSON.stringify({ test: 'data' }),
        headers: JSON.stringify({}),
        deliveries: 1,
        receivedAt: oldDate,
      });

      await repository.markAsProcessed('old-event');
      const processedEvent = await repository.findByEventId('old-event');
      if (processedEvent) {
        processedEvent.processedAt = oldDate;
      }

      // Create recent processed event
      await processor.process(
        {
          eventId: 'recent-event',
          subject: 'test.subject',
          payload: JSON.stringify({ test: 'data' }),
          headers: JSON.stringify({}),
          deliveries: 1,
        },
        async () => {},
        createContext('recent-event')
      );

      const deletedCount = await processor.cleanup(30);

      expect(deletedCount).toBe(1);

      const oldEventCheck = await repository.findByEventId('old-event');
      const recentEventCheck = await repository.findByEventId('recent-event');

      expect(oldEventCheck).toBeNull();
      expect(recentEventCheck).not.toBeNull();
    });
  });

  describe('resetStale', () => {
    it('should reset stale processing events to failed', async () => {
      const staleDate = new Date();
      staleDate.setMinutes(staleDate.getMinutes() - 10); // 10 minutes ago

      // Create stale processing event
      await repository.create({
        eventId: 'stale-event',
        subject: 'test.subject',
        payload: JSON.stringify({ test: 'data' }),
        headers: JSON.stringify({}),
        deliveries: 1,
      });

      const staleEvent = await repository.findByEventId('stale-event');
      if (staleEvent) {
        staleEvent.updatedAt = staleDate;
      }

      const resetCount = await processor.resetStale(5);

      expect(resetCount).toBe(1);

      const resetEvent = await repository.findByEventId('stale-event');
      expect(resetEvent?.status).toBe(InboxStatus.FAILED);
      expect(resetEvent?.lastError).toContain('stale');
    });
  });

  describe('getFailedEvents', () => {
    it('should return failed events', async () => {
      // Create failed events
      for (let i = 1; i <= 3; i++) {
        try {
          await processor.process(
            {
              eventId: `failed-${i}`,
              subject: 'test.subject',
              payload: JSON.stringify({ id: i }),
              headers: JSON.stringify({}),
              deliveries: 1,
            },
            async () => {
              throw new Error(`Error ${i}`);
            },
            createContext(`failed-${i}`)
          );
        } catch {
          // Expected
        }
      }

      const failedEvents = await processor.getFailedEvents(10);

      expect(failedEvents.length).toBe(3);
      expect(failedEvents.every((e) => e.status === InboxStatus.FAILED)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      // Create 5 failed events
      for (let i = 1; i <= 5; i++) {
        try {
          await processor.process(
            {
              eventId: `failed-${i}`,
              subject: 'test.subject',
              payload: JSON.stringify({ id: i }),
              headers: JSON.stringify({}),
              deliveries: 1,
            },
            async () => {
              throw new Error(`Error ${i}`);
            },
            createContext(`failed-${i}`)
          );
        } catch {
          // Expected
        }
      }

      const failedEvents = await processor.getFailedEvents(2);

      expect(failedEvents.length).toBe(2);
    });
  });
});
