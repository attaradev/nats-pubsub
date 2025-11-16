import Publisher from '../publisher/publisher';
import Connection from '../core/connection';
import Config from '../core/config';
import { JetStreamClient } from 'nats';

jest.mock('../core/connection');
jest.mock('../core/config');

describe('Publisher', () => {
  let publisher: Publisher;
  let mockJetStream: jest.Mocked<JetStreamClient>;
  let mockConnection: jest.Mocked<Connection>;
  let mockConfig: jest.Mocked<Config>;

  beforeEach(() => {
    // Reset singleton
    (Publisher as any).instance = null;
    (Connection as any).instance = null;
    (Config as any).instance = null;

    // Create mock JetStream client
    mockJetStream = {
      publish: jest.fn().mockResolvedValue({ seq: 1, duplicate: false }),
    } as any;

    // Create mock Connection
    mockConnection = {
      getJetStream: jest.fn().mockReturnValue(mockJetStream),
    } as any;
    (Connection.getInstance as jest.Mock).mockReturnValue(mockConnection);

    // Create mock Config
    mockConfig = {
      env: 'test',
      appName: 'test-app',
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
    } as any;
    (Config.getInstance as jest.Mock).mockReturnValue(mockConfig);

    publisher = Publisher.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = Publisher.getInstance();
      const instance2 = Publisher.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('publish', () => {
    it('should publish event with correct subject and envelope', async () => {
      const payload = { id: '123', name: 'Alice' };

      await publisher.publish('users', 'user', 'created', payload);

      expect(mockJetStream.publish).toHaveBeenCalledWith(
        'test.events.users.user.created',
        expect.any(Uint8Array),
        expect.objectContaining({
          headers: expect.anything(),
        })
      );
    });

    it('should include event envelope with all required fields', async () => {
      const payload = { id: '123', name: 'Alice' };

      await publisher.publish('users', 'user', 'created', payload);

      const publishCall = mockJetStream.publish.mock.calls[0];
      const encodedData = publishCall[1] as Uint8Array;
      const envelope = JSON.parse(new TextDecoder().decode(encodedData));

      expect(envelope).toMatchObject({
        event_type: 'created',
        producer: 'test-app',
        resource_type: 'user',
        resource_id: '123',
        schema_version: 1,
        payload,
      });
      expect(envelope.event_id).toBeDefined();
      expect(envelope.occurred_at).toBeDefined();
    });

    it('should add nats-msg-id header for idempotency', async () => {
      const payload = { id: '123' };

      await publisher.publish('users', 'user', 'created', payload);

      const publishCall = mockJetStream.publish.mock.calls[0];
      const options = publishCall[2];

      expect(options.headers).toBeDefined();
      const msgId = options.headers?.get('Nats-Msg-Id');
      expect(msgId).toBeDefined();
      expect(msgId).toMatch(/^[a-f0-9-]+$/); // UUID format
    });

    it('should use provided event_id when specified', async () => {
      const payload = { id: '123' };
      const customEventId = 'custom-event-id-123';

      await publisher.publish('users', 'user', 'created', payload, {
        event_id: customEventId,
      });

      const publishCall = mockJetStream.publish.mock.calls[0];
      const encodedData = publishCall[1] as Uint8Array;
      const envelope = JSON.parse(new TextDecoder().decode(encodedData));

      expect(envelope.event_id).toBe(customEventId);
    });

    it('should use provided trace_id when specified', async () => {
      const payload = { id: '123' };
      const traceId = 'trace-abc-123';

      await publisher.publish('users', 'user', 'created', payload, {
        trace_id: traceId,
      });

      const publishCall = mockJetStream.publish.mock.calls[0];
      const encodedData = publishCall[1] as Uint8Array;
      const envelope = JSON.parse(new TextDecoder().decode(encodedData));

      expect(envelope.trace_id).toBe(traceId);
    });

    it('should use provided occurred_at when specified', async () => {
      const payload = { id: '123' };
      const occurredAt = new Date('2025-01-01T00:00:00Z');

      await publisher.publish('users', 'user', 'created', payload, {
        occurred_at: occurredAt,
      });

      const publishCall = mockJetStream.publish.mock.calls[0];
      const encodedData = publishCall[1] as Uint8Array;
      const envelope = JSON.parse(new TextDecoder().decode(encodedData));

      expect(envelope.occurred_at).toBe(occurredAt.toISOString());
    });

    it('should extract resource_id from payload.id', async () => {
      const payload = { id: '456', name: 'Bob' };

      await publisher.publish('users', 'user', 'updated', payload);

      const publishCall = mockJetStream.publish.mock.calls[0];
      const encodedData = publishCall[1] as Uint8Array;
      const envelope = JSON.parse(new TextDecoder().decode(encodedData));

      expect(envelope.resource_id).toBe('456');
    });

    it('should handle payload without id', async () => {
      const payload = { name: 'Charlie' };

      await publisher.publish('notifications', 'notification', 'sent', payload);

      const publishCall = mockJetStream.publish.mock.calls[0];
      const encodedData = publishCall[1] as Uint8Array;
      const envelope = JSON.parse(new TextDecoder().decode(encodedData));

      expect(envelope.resource_id).toBeUndefined();
    });

    it('should log successful publish', async () => {
      await publisher.publish('users', 'user', 'created', { id: '123' });

      expect(mockConfig.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Published event'),
        expect.objectContaining({
          subject: 'test.events.users.user.created',
        })
      );
    });

    it('should throw error when publish fails', async () => {
      const error = new Error('Connection failed');
      mockJetStream.publish.mockRejectedValueOnce(error);

      await expect(
        publisher.publish('users', 'user', 'created', { id: '123' })
      ).rejects.toThrow('Connection failed');
    });

    it('should log error when publish fails', async () => {
      const error = new Error('Connection failed');
      mockJetStream.publish.mockRejectedValueOnce(error);

      try {
        await publisher.publish('users', 'user', 'created', { id: '123' });
      } catch (e) {
        // Expected error
      }

      expect(mockConfig.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to publish'),
        expect.objectContaining({
          error: expect.any(String),
        })
      );
    });
  });
});
