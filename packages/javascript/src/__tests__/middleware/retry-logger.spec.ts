import { RetryLoggerMiddleware } from '../../middleware/retry-logger';
import config from '../../core/config';
import { EventMetadata } from '../../types';

// Mock config
jest.mock('../../core/config');

describe('RetryLoggerMiddleware', () => {
  let middleware: RetryLoggerMiddleware;
  let mockLogger: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    (config as any).logger = mockLogger;

    middleware = new RetryLoggerMiddleware();
    mockNext = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('call', () => {
    it('should log warning when event is being retried (deliveries > 1)', async () => {
      const event = { id: '123', name: 'Test Event' };
      const metadata: EventMetadata = {
        event_id: 'event-123',
        subject: 'test.events.users.user.created',
        domain: 'users',
        resource: 'user',
        action: 'created',
        deliveries: 3,
      };

      await middleware.call(event, metadata, mockNext);

      expect(mockLogger.warn).toHaveBeenCalledWith('Retrying event', {
        event_id: 'event-123',
        subject: 'test.events.users.user.created',
        delivery_count: 3,
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not log when event is first delivery (deliveries = 1)', async () => {
      const event = { id: '123', name: 'Test Event' };
      const metadata: EventMetadata = {
        event_id: 'event-123',
        subject: 'test.events.users.user.created',
        domain: 'users',
        resource: 'user',
        action: 'created',
        deliveries: 1,
      };

      await middleware.call(event, metadata, mockNext);

      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not log when deliveries is undefined', async () => {
      const event = { id: '123', name: 'Test Event' };
      const metadata: EventMetadata = {
        event_id: 'event-123',
        subject: 'test.events.users.user.created',
        domain: 'users',
        resource: 'user',
        action: 'created',
      };

      await middleware.call(event, metadata, mockNext);

      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should log for each retry attempt', async () => {
      const event = { id: '123', name: 'Test Event' };

      // Simulate multiple delivery attempts
      for (let deliveryCount = 2; deliveryCount <= 5; deliveryCount++) {
        const metadata: EventMetadata = {
          event_id: 'event-123',
          subject: 'test.events.users.user.created',
          domain: 'users',
          resource: 'user',
          action: 'created',
          deliveries: deliveryCount,
        };

        await middleware.call(event, metadata, mockNext);

        expect(mockLogger.warn).toHaveBeenCalledWith('Retrying event', {
          event_id: 'event-123',
          subject: 'test.events.users.user.created',
          delivery_count: deliveryCount,
        });
      }

      expect(mockLogger.warn).toHaveBeenCalledTimes(4); // Called for deliveries 2, 3, 4, 5
    });

    it('should call next middleware in chain', async () => {
      const event = { id: '123', name: 'Test Event' };
      const metadata: EventMetadata = {
        event_id: 'event-123',
        subject: 'test.events.users.user.created',
        domain: 'users',
        resource: 'user',
        action: 'created',
        deliveries: 2,
      };

      await middleware.call(event, metadata, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors from next middleware', async () => {
      const event = { id: '123', name: 'Test Event' };
      const metadata: EventMetadata = {
        event_id: 'event-123',
        subject: 'test.events.users.user.created',
        domain: 'users',
        resource: 'user',
        action: 'created',
        deliveries: 2,
      };

      const error = new Error('Next middleware failed');
      mockNext.mockRejectedValueOnce(error);

      await expect(middleware.call(event, metadata, mockNext)).rejects.toThrow(
        'Next middleware failed'
      );

      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should handle very high delivery counts', async () => {
      const event = { id: '123', name: 'Test Event' };
      const metadata: EventMetadata = {
        event_id: 'event-123',
        subject: 'test.events.users.user.created',
        domain: 'users',
        resource: 'user',
        action: 'created',
        deliveries: 100,
      };

      await middleware.call(event, metadata, mockNext);

      expect(mockLogger.warn).toHaveBeenCalledWith('Retrying event', {
        event_id: 'event-123',
        subject: 'test.events.users.user.created',
        delivery_count: 100,
      });
    });

    it('should log with correct metadata for different subjects', async () => {
      const event1 = { id: '1' };
      const metadata1: EventMetadata = {
        event_id: 'event-1',
        subject: 'test.events.users.user.created',
        domain: 'users',
        resource: 'user',
        action: 'created',
        deliveries: 2,
      };

      const event2 = { id: '2' };
      const metadata2: EventMetadata = {
        event_id: 'event-2',
        subject: 'test.events.orders.order.placed',
        domain: 'orders',
        resource: 'order',
        action: 'placed',
        deliveries: 3,
      };

      await middleware.call(event1, metadata1, mockNext);
      await middleware.call(event2, metadata2, mockNext);

      expect(mockLogger.warn).toHaveBeenNthCalledWith(1, 'Retrying event', {
        event_id: 'event-1',
        subject: 'test.events.users.user.created',
        delivery_count: 2,
      });

      expect(mockLogger.warn).toHaveBeenNthCalledWith(2, 'Retrying event', {
        event_id: 'event-2',
        subject: 'test.events.orders.order.placed',
        delivery_count: 3,
      });
    });
  });
});
