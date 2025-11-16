import { DlqConsumer, DlqHandler, PersistentDlqStore } from '../../dlq/dlq-consumer';
import config from '../../core/config';
import { EventMetadata } from '../../types';

// Mock config
jest.mock('../../core/config');

describe('DlqConsumer', () => {
  let dlqConsumer: DlqConsumer;
  let mockLogger: any;
  let mockStore: jest.Mocked<PersistentDlqStore>;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    (config as any).logger = mockLogger;
    (config as any).dlqSubject = 'test.dlq';

    mockStore = {
      save: jest.fn().mockResolvedValue(undefined),
      list: jest.fn().mockResolvedValue([]),
      get: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
      stats: jest.fn().mockResolvedValue({
        total: 0,
        bySubject: {},
      }),
    };

    dlqConsumer = new DlqConsumer();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with config dlqSubject', () => {
      expect(dlqConsumer.subjects).toContain('test.dlq');
    });

    it('should accept optional persistent store', () => {
      const consumerWithStore = new DlqConsumer(mockStore);
      expect(consumerWithStore).toBeDefined();
    });
  });

  describe('addHandler', () => {
    it('should register DLQ handlers', () => {
      const handler: DlqHandler = {
        handle: jest.fn(),
      };

      dlqConsumer.addHandler(handler);
      // Handler registration doesn't throw
      expect(() => dlqConsumer.addHandler(handler)).not.toThrow();
    });
  });

  describe('call', () => {
    let event: Record<string, unknown>;
    let metadata: EventMetadata;

    beforeEach(() => {
      event = {
        id: '123',
        name: 'Test Event',
      };

      metadata = {
        event_id: 'event-123',
        subject: 'test.events.users.user.created',
        domain: 'users',
        resource: 'user',
        action: 'created',
        deliveries: 5,
      };
    });

    it('should process DLQ message and store it in memory', async () => {
      await dlqConsumer.call(event, metadata);

      const messages = dlqConsumer.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].event_id).toBe('event-123');
      expect(messages[0].original_subject).toBe('test.events.users.user.created');
      expect(messages[0].event).toEqual(event);
      expect(messages[0].deliveries).toBe(5);
    });

    it('should log warning when message received in DLQ', async () => {
      await dlqConsumer.call(event, metadata);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Message received in DLQ',
        expect.objectContaining({
          event_id: 'event-123',
          original_subject: 'test.events.users.user.created',
          deliveries: 5,
        })
      );
    });

    it('should update existing message with new last_seen time', async () => {
      const firstCallTime = new Date();
      await dlqConsumer.call(event, metadata);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      await dlqConsumer.call(event, metadata);

      const messages = dlqConsumer.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].last_seen.getTime()).toBeGreaterThan(firstCallTime.getTime());
    });

    it('should preserve first_seen time when updating existing message', async () => {
      await dlqConsumer.call(event, metadata);
      const firstMessage = dlqConsumer.getMessages()[0];
      const originalFirstSeen = firstMessage.first_seen;

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      await dlqConsumer.call(event, metadata);
      const updatedMessage = dlqConsumer.getMessages()[0];

      expect(updatedMessage.first_seen).toEqual(originalFirstSeen);
    });

    it('should persist message to store if configured', async () => {
      const consumerWithStore = new DlqConsumer(mockStore);
      await consumerWithStore.call(event, metadata);

      expect(mockStore.save).toHaveBeenCalledWith(
        expect.objectContaining({
          event_id: 'event-123',
          original_subject: 'test.events.users.user.created',
          event,
        })
      );
    });

    it('should handle store save errors gracefully', async () => {
      mockStore.save.mockRejectedValueOnce(new Error('Database error'));
      const consumerWithStore = new DlqConsumer(mockStore);

      await consumerWithStore.call(event, metadata);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to persist DLQ message',
        expect.objectContaining({
          event_id: 'event-123',
          error: 'Database error',
        })
      );
    });

    it('should call registered handlers', async () => {
      const handler1: DlqHandler = {
        handle: jest.fn().mockResolvedValue(undefined),
      };
      const handler2: DlqHandler = {
        handle: jest.fn().mockResolvedValue(undefined),
      };

      dlqConsumer.addHandler(handler1);
      dlqConsumer.addHandler(handler2);

      await dlqConsumer.call(event, metadata);

      expect(handler1.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          event_id: 'event-123',
          original_subject: 'test.events.users.user.created',
        })
      );
      expect(handler2.handle).toHaveBeenCalled();
    });

    it('should handle handler errors gracefully', async () => {
      const failingHandler: DlqHandler = {
        handle: jest.fn().mockRejectedValue(new Error('Handler failed')),
      };

      dlqConsumer.addHandler(failingHandler);

      await expect(dlqConsumer.call(event, metadata)).resolves.not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'DLQ handler failed',
        expect.objectContaining({
          event_id: 'event-123',
          error: 'Handler failed',
        })
      );
    });

    it('should continue processing even if one handler fails', async () => {
      const failingHandler: DlqHandler = {
        handle: jest.fn().mockRejectedValue(new Error('Handler 1 failed')),
      };
      const successHandler: DlqHandler = {
        handle: jest.fn().mockResolvedValue(undefined),
      };

      dlqConsumer.addHandler(failingHandler);
      dlqConsumer.addHandler(successHandler);

      await dlqConsumer.call(event, metadata);

      expect(failingHandler.handle).toHaveBeenCalled();
      expect(successHandler.handle).toHaveBeenCalled();
    });
  });

  describe('getMessages', () => {
    it('should return all stored messages', async () => {
      const event1 = { id: '1', name: 'Event 1' };
      const metadata1: EventMetadata = {
        event_id: 'event-1',
        subject: 'test.subject.1',
        domain: 'test',
        resource: 'resource',
        action: 'created',
      };

      const event2 = { id: '2', name: 'Event 2' };
      const metadata2: EventMetadata = {
        event_id: 'event-2',
        subject: 'test.subject.2',
        domain: 'test',
        resource: 'resource',
        action: 'updated',
      };

      await dlqConsumer.call(event1, metadata1);
      await dlqConsumer.call(event2, metadata2);

      const messages = dlqConsumer.getMessages();
      expect(messages).toHaveLength(2);
      expect(messages[0].event_id).toBe('event-1');
      expect(messages[1].event_id).toBe('event-2');
    });

    it('should return empty array when no messages', () => {
      const messages = dlqConsumer.getMessages();
      expect(messages).toEqual([]);
    });
  });

  describe('getMessage', () => {
    it('should return specific message by event_id', async () => {
      const event = { id: '123', name: 'Test' };
      const metadata: EventMetadata = {
        event_id: 'event-123',
        subject: 'test.subject',
        domain: 'test',
        resource: 'resource',
        action: 'created',
      };

      await dlqConsumer.call(event, metadata);

      const message = dlqConsumer.getMessage('event-123');
      expect(message).toBeDefined();
      expect(message?.event_id).toBe('event-123');
    });

    it('should return undefined for non-existent event_id', () => {
      const message = dlqConsumer.getMessage('non-existent');
      expect(message).toBeUndefined();
    });
  });

  describe('clearMessages', () => {
    it('should clear all in-memory messages', async () => {
      const event = { id: '123', name: 'Test' };
      const metadata: EventMetadata = {
        event_id: 'event-123',
        subject: 'test.subject',
        domain: 'test',
        resource: 'resource',
        action: 'created',
      };

      await dlqConsumer.call(event, metadata);
      expect(dlqConsumer.getMessages()).toHaveLength(1);

      dlqConsumer.clearMessages();
      expect(dlqConsumer.getMessages()).toHaveLength(0);
    });
  });

  describe('getStatistics', () => {
    it('should return statistics about DLQ messages', async () => {
      const event1 = { id: '1', name: 'Event 1' };
      const metadata1: EventMetadata = {
        event_id: 'event-1',
        subject: 'test.events.users.user.created',
        domain: 'users',
        resource: 'user',
        action: 'created',
      };

      const event2 = { id: '2', name: 'Event 2' };
      const metadata2: EventMetadata = {
        event_id: 'event-2',
        subject: 'test.events.orders.order.placed',
        domain: 'orders',
        resource: 'order',
        action: 'placed',
      };

      await dlqConsumer.call(event1, metadata1);
      await dlqConsumer.call(event2, metadata2);

      const stats = dlqConsumer.getStatistics();
      expect(stats.total).toBe(2);
      expect(stats.bySubject['test.events.users.user.created']).toBe(1);
      expect(stats.bySubject['test.events.orders.order.placed']).toBe(1);
      expect(stats.oldestMessage).toBeDefined();
      expect(stats.newestMessage).toBeDefined();
    });

    it('should return empty stats when no messages', () => {
      const stats = dlqConsumer.getStatistics();
      expect(stats.total).toBe(0);
      expect(stats.bySubject).toEqual({});
      expect(stats.oldestMessage).toBeUndefined();
      expect(stats.newestMessage).toBeUndefined();
    });
  });
});
