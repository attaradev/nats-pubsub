import { LoggingMiddleware } from '../../middleware/logging';
import { EventMetadata } from '../../types';

describe('LoggingMiddleware', () => {
  let middleware: LoggingMiddleware;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    middleware = new LoggingMiddleware();
    // Mock the config logger
    jest.spyOn(require('../../core/config').default, 'logger', 'get').mockReturnValue(mockLogger);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('call', () => {
    it('should log event processing start', async () => {
      const event = { id: '123', name: 'Test' };
      const metadata: EventMetadata = {
        event_id: 'evt-123',
        subject: 'test.events.users.user.created',
        action: 'created',
        domain: 'users',
        resource: 'user',
      };
      const next = jest.fn().mockResolvedValue(undefined);

      await middleware.call(event, metadata, next);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Processing event',
        expect.objectContaining({
          event_id: 'evt-123',
          subject: 'test.events.users.user.created',
          action: 'created',
        })
      );
    });

    it('should log event processing completion', async () => {
      const event = { id: '123' };
      const metadata: EventMetadata = {
        event_id: 'evt-123',
        subject: 'test.events.users.user.created',
        action: 'created',
        domain: 'users',
        resource: 'user',
      };
      const next = jest.fn().mockResolvedValue(undefined);

      await middleware.call(event, metadata, next);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Event processed successfully',
        expect.objectContaining({
          event_id: 'evt-123',
          duration_ms: expect.any(Number),
        })
      );
    });

    it('should call next middleware', async () => {
      const event = { id: '123' };
      const metadata: EventMetadata = {
        event_id: 'evt-123',
        subject: 'test.subject',
        action: 'created',
        domain: 'test',
        resource: 'test',
      };
      const next = jest.fn().mockResolvedValue(undefined);

      await middleware.call(event, metadata, next);

      expect(next).toHaveBeenCalled();
    });

    it('should log error when processing fails', async () => {
      const error = new Error('Processing failed');
      const event = { id: '123' };
      const metadata: EventMetadata = {
        event_id: 'evt-123',
        subject: 'test.events.users.user.created',
        action: 'created',
        domain: 'users',
        resource: 'user',
      };
      const next = jest.fn().mockRejectedValue(error);

      await expect(
        middleware.call(event, metadata, next)
      ).rejects.toThrow('Processing failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Event processing failed',
        expect.objectContaining({
          event_id: 'evt-123',
        })
      );
    });

    it('should propagate errors after logging', async () => {
      const error = new Error('Test error');
      const event = { id: '123' };
      const metadata: EventMetadata = {
        event_id: 'evt-123',
        subject: 'test.subject',
        action: 'created',
        domain: 'test',
        resource: 'test',
      };
      const next = jest.fn().mockRejectedValue(error);

      await expect(
        middleware.call(event, metadata, next)
      ).rejects.toThrow('Test error');
    });
  });
});
