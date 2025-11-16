import { BatchPublisher } from '../../publisher/batch-publisher';
import publisher from '../../publisher/publisher';
import config from '../../core/config';

// Mock dependencies
jest.mock('../../publisher/publisher');
jest.mock('../../core/config');

describe('BatchPublisher', () => {
  let batchPublisher: BatchPublisher;
  let mockPublish: jest.Mock;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    (config as any).logger = mockLogger;

    mockPublish = jest.fn().mockResolvedValue(undefined);
    (publisher.publish as jest.Mock) = mockPublish;

    batchPublisher = new BatchPublisher();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('publishBatch', () => {
    it('should publish multiple events successfully', async () => {
      const items = [
        {
          domain: 'users',
          resource: 'user',
          action: 'created',
          payload: { id: '1', name: 'Alice' },
        },
        {
          domain: 'users',
          resource: 'user',
          action: 'updated',
          payload: { id: '2', name: 'Bob' },
        },
        {
          domain: 'orders',
          resource: 'order',
          action: 'placed',
          payload: { id: '3', total: 100 },
        },
      ];

      const result = await batchPublisher.publishBatch(items);

      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(mockPublish).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures gracefully', async () => {
      mockPublish
        .mockResolvedValueOnce(undefined) // First item succeeds
        .mockRejectedValueOnce(new Error('Publish failed')) // Second item fails
        .mockResolvedValueOnce(undefined); // Third item succeeds

      const items = [
        {
          domain: 'users',
          resource: 'user',
          action: 'created',
          payload: { id: '1', name: 'Alice' },
        },
        {
          domain: 'users',
          resource: 'user',
          action: 'updated',
          payload: { id: '2', name: 'Bob' },
        },
        {
          domain: 'orders',
          resource: 'order',
          action: 'placed',
          payload: { id: '3', total: 100 },
        },
      ];

      const result = await batchPublisher.publishBatch(items);

      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        index: 1,
        item: items[1],
        error: 'Publish failed',
      });
    });

    it('should handle all items failing', async () => {
      mockPublish.mockRejectedValue(new Error('Network error'));

      const items = [
        {
          domain: 'users',
          resource: 'user',
          action: 'created',
          payload: { id: '1', name: 'Alice' },
        },
        {
          domain: 'users',
          resource: 'user',
          action: 'updated',
          payload: { id: '2', name: 'Bob' },
        },
      ];

      const result = await batchPublisher.publishBatch(items);

      expect(result.successful).toBe(0);
      expect(result.failed).toBe(2);
      expect(result.errors).toHaveLength(2);
    });

    it('should pass options to individual publish calls', async () => {
      const items = [
        {
          domain: 'users',
          resource: 'user',
          action: 'created',
          payload: { id: '1', name: 'Alice' },
          options: {
            event_id: 'custom-id-1',
            trace_id: 'trace-123',
          },
        },
      ];

      await batchPublisher.publishBatch(items);

      expect(mockPublish).toHaveBeenCalledWith(
        'users',
        'user',
        'created',
        { id: '1', name: 'Alice' },
        {
          event_id: 'custom-id-1',
          trace_id: 'trace-123',
        }
      );
    });

    it('should handle empty batch', async () => {
      const result = await batchPublisher.publishBatch([]);

      expect(result.successful).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockPublish).not.toHaveBeenCalled();
    });

    it('should log batch start and completion', async () => {
      const items = [
        {
          domain: 'users',
          resource: 'user',
          action: 'created',
          payload: { id: '1', name: 'Alice' },
        },
      ];

      await batchPublisher.publishBatch(items);

      expect(mockLogger.info).toHaveBeenCalledWith('Publishing batch', {
        count: 1,
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Batch publish complete',
        expect.objectContaining({
          successful: 1,
          failed: 0,
        })
      );
    });

    it('should log individual item failures', async () => {
      mockPublish.mockRejectedValueOnce(new Error('Connection timeout'));

      const items = [
        {
          domain: 'users',
          resource: 'user',
          action: 'created',
          payload: { id: '1', name: 'Alice' },
        },
      ];

      await batchPublisher.publishBatch(items);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to publish batch item',
        expect.objectContaining({
          index: 0,
          domain: 'users',
          resource: 'user',
          action: 'created',
          error: 'Connection timeout',
        })
      );
    });

    it('should measure batch duration', async () => {
      const items = [
        {
          domain: 'users',
          resource: 'user',
          action: 'created',
          payload: { id: '1', name: 'Alice' },
        },
      ];

      const result = await batchPublisher.publishBatch(items);

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.duration).toBe('number');
    });

    it('should handle non-Error exceptions', async () => {
      mockPublish.mockRejectedValueOnce('String error');

      const items = [
        {
          domain: 'users',
          resource: 'user',
          action: 'created',
          payload: { id: '1', name: 'Alice' },
        },
      ];

      const result = await batchPublisher.publishBatch(items);

      expect(result.failed).toBe(1);
      expect(result.errors[0].error).toBe('Unknown error');
    });
  });

  describe('publishMany', () => {
    it('should publish multiple events with same domain and resource', async () => {
      const events = [
        { action: 'created', payload: { id: '1', name: 'Alice' } },
        { action: 'updated', payload: { id: '2', name: 'Bob' } },
        { action: 'deleted', payload: { id: '3', name: 'Charlie' } },
      ];

      const result = await batchPublisher.publishMany('users', 'user', events);

      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
      expect(mockPublish).toHaveBeenCalledTimes(3);
      expect(mockPublish).toHaveBeenNthCalledWith(
        1,
        'users',
        'user',
        'created',
        { id: '1', name: 'Alice' },
        undefined
      );
      expect(mockPublish).toHaveBeenNthCalledWith(
        2,
        'users',
        'user',
        'updated',
        { id: '2', name: 'Bob' },
        undefined
      );
      expect(mockPublish).toHaveBeenNthCalledWith(
        3,
        'users',
        'user',
        'deleted',
        { id: '3', name: 'Charlie' },
        undefined
      );
    });

    it('should pass options to publishMany', async () => {
      const events = [
        {
          action: 'created',
          payload: { id: '1', name: 'Alice' },
          options: { trace_id: 'trace-123' },
        },
      ];

      await batchPublisher.publishMany('users', 'user', events);

      expect(mockPublish).toHaveBeenCalledWith(
        'users',
        'user',
        'created',
        { id: '1', name: 'Alice' },
        { trace_id: 'trace-123' }
      );
    });

    it('should handle failures in publishMany', async () => {
      mockPublish.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Failed'));

      const events = [
        { action: 'created', payload: { id: '1', name: 'Alice' } },
        { action: 'updated', payload: { id: '2', name: 'Bob' } },
      ];

      const result = await batchPublisher.publishMany('users', 'user', events);

      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('should handle empty events array', async () => {
      const result = await batchPublisher.publishMany('users', 'user', []);

      expect(result.successful).toBe(0);
      expect(result.failed).toBe(0);
      expect(mockPublish).not.toHaveBeenCalled();
    });
  });
});
