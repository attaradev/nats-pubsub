import { MetricsMiddleware } from '../../metrics/middleware';
import { PrometheusMetrics } from '../../metrics/prometheus';
import { EventMetadata } from '../../types';

jest.mock('../../metrics/prometheus');

describe('MetricsMiddleware', () => {
  let middleware: MetricsMiddleware;
  let mockMetrics: jest.Mocked<PrometheusMetrics>;
  let mockMetadata: EventMetadata;

  beforeEach(() => {
    mockMetrics = {
      recordMessageReceived: jest.fn(),
      recordProcessingDuration: jest.fn(),
      recordMessageProcessed: jest.fn(),
      recordMessageFailed: jest.fn(),
    } as any;

    middleware = new MetricsMiddleware(mockMetrics);

    mockMetadata = {
      event_id: 'test-event-123',
      subject: 'test.events.users.user.created',
      domain: 'users',
      resource: 'user',
      action: 'created',
      stream: 'test-stream',
      stream_seq: 1,
      deliveries: 1,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('call', () => {
    it('should record message received before processing', async () => {
      const next = jest.fn().mockResolvedValue(undefined);

      await middleware.call({}, mockMetadata, next);

      expect(mockMetrics.recordMessageReceived).toHaveBeenCalledWith(
        'test.events.users.user.created',
        'users',
        'user',
        'created'
      );
    });

    it('should call next function', async () => {
      const next = jest.fn().mockResolvedValue(undefined);

      await middleware.call({}, mockMetadata, next);

      expect(next).toHaveBeenCalled();
    });

    it('should record processing duration on success', async () => {
      const next = jest.fn().mockResolvedValue(undefined);

      await middleware.call({}, mockMetadata, next);

      expect(mockMetrics.recordProcessingDuration).toHaveBeenCalledWith(
        'test.events.users.user.created',
        'users',
        'user',
        'created',
        'unknown',
        expect.any(Number)
      );
    });

    it('should record message processed on success', async () => {
      const next = jest.fn().mockResolvedValue(undefined);

      await middleware.call({}, mockMetadata, next);

      expect(mockMetrics.recordMessageProcessed).toHaveBeenCalledWith(
        'test.events.users.user.created',
        'users',
        'user',
        'created',
        'unknown'
      );
    });

    it('should record processing duration as seconds', async () => {
      const next = jest
        .fn()
        .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

      await middleware.call({}, mockMetadata, next);

      const durationSeconds = (mockMetrics.recordProcessingDuration as jest.Mock).mock.calls[0][5];
      expect(durationSeconds).toBeGreaterThan(0);
      expect(durationSeconds).toBeLessThan(1); // Should be less than 1 second
    });

    describe('error handling', () => {
      it('should record message failed on error', async () => {
        const error = new Error('Processing failed');
        const next = jest.fn().mockRejectedValue(error);

        await expect(middleware.call({}, mockMetadata, next)).rejects.toThrow('Processing failed');

        expect(mockMetrics.recordMessageFailed).toHaveBeenCalledWith(
          'test.events.users.user.created',
          'users',
          'user',
          'created',
          'unknown',
          'Error'
        );
      });

      it('should record error type for custom errors', async () => {
        class CustomError extends Error {
          constructor(message: string) {
            super(message);
            this.name = 'CustomError';
          }
        }

        const error = new CustomError('Custom error occurred');
        const next = jest.fn().mockRejectedValue(error);

        await expect(middleware.call({}, mockMetadata, next)).rejects.toThrow(
          'Custom error occurred'
        );

        expect(mockMetrics.recordMessageFailed).toHaveBeenCalledWith(
          'test.events.users.user.created',
          'users',
          'user',
          'created',
          'unknown',
          'CustomError'
        );
      });

      it('should handle non-Error objects', async () => {
        const next = jest.fn().mockRejectedValue('string error');

        await expect(middleware.call({}, mockMetadata, next)).rejects.toBe('string error');

        expect(mockMetrics.recordMessageFailed).toHaveBeenCalledWith(
          'test.events.users.user.created',
          'users',
          'user',
          'created',
          'unknown',
          'UnknownError'
        );
      });

      it('should re-throw the error after recording', async () => {
        const error = new Error('Processing failed');
        const next = jest.fn().mockRejectedValue(error);

        await expect(middleware.call({}, mockMetadata, next)).rejects.toThrow(error);
      });

      it('should not record success metrics on error', async () => {
        const error = new Error('Processing failed');
        const next = jest.fn().mockRejectedValue(error);

        await expect(middleware.call({}, mockMetadata, next)).rejects.toThrow();

        expect(mockMetrics.recordProcessingDuration).not.toHaveBeenCalled();
        expect(mockMetrics.recordMessageProcessed).not.toHaveBeenCalled();
      });
    });

    describe('with different metadata', () => {
      it('should handle different subjects', async () => {
        const next = jest.fn().mockResolvedValue(undefined);
        const differentMetadata: EventMetadata = {
          ...mockMetadata,
          subject: 'test.events.orders.order.placed',
          domain: 'orders',
          resource: 'order',
          action: 'placed',
        };

        await middleware.call({}, differentMetadata, next);

        expect(mockMetrics.recordMessageReceived).toHaveBeenCalledWith(
          'test.events.orders.order.placed',
          'orders',
          'order',
          'placed'
        );
      });

      it('should handle minimal metadata', async () => {
        const next = jest.fn().mockResolvedValue(undefined);
        const minimalMetadata: EventMetadata = {
          event_id: 'test-123',
          subject: 'test.subject',
          domain: 'test',
          resource: 'resource',
          action: 'action',
        };

        await middleware.call({}, minimalMetadata, next);

        expect(mockMetrics.recordMessageReceived).toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
      });
    });

    describe('timing accuracy', () => {
      it('should record accurate processing time', async () => {
        const delay = 50; // ms
        const next = jest
          .fn()
          .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, delay)));

        await middleware.call({}, mockMetadata, next);

        const durationSeconds = (mockMetrics.recordProcessingDuration as jest.Mock).mock
          .calls[0][5];
        const durationMs = durationSeconds * 1000;

        // Allow some tolerance for timing
        expect(durationMs).toBeGreaterThanOrEqual(delay - 10);
        expect(durationMs).toBeLessThan(delay + 50);
      });
    });
  });
});
