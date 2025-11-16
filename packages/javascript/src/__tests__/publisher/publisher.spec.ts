import { Publisher } from '../../publisher/publisher';
import connection from '../../core/connection';
import config from '../../core/config';

// Mock dependencies
jest.mock('../../core/connection');
jest.mock('nats', () => ({
  headers: jest.fn(() => ({
    set: jest.fn(),
  })),
}));

describe('Publisher', () => {
  let publisher: Publisher;
  let mockJetstream: any;
  let mockHeaders: any;

  beforeEach(() => {
    publisher = new Publisher();

    mockHeaders = {
      set: jest.fn(),
    };

    mockJetstream = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    (connection.ensureConnection as jest.Mock) = jest.fn().mockResolvedValue(undefined);
    (connection.getJetStream as jest.Mock) = jest.fn().mockReturnValue(mockJetstream);

    const { headers } = require('nats');
    (headers as jest.Mock).mockReturnValue(mockHeaders);

    config.configure({
      natsUrls: 'nats://localhost:4222',
      env: 'test',
      appName: 'test-app',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('publish', () => {
    it('should publish an event successfully', async () => {
      const payload = { id: '123', name: 'Test User' };

      await publisher.publish('users', 'user', 'created', payload);

      expect(connection.ensureConnection).toHaveBeenCalled();
      expect(connection.getJetStream).toHaveBeenCalled();
      expect(mockJetstream.publish).toHaveBeenCalledWith(
        'test.test-app.users.user.created',
        expect.any(String),
        expect.objectContaining({
          msgID: expect.any(String),
          headers: mockHeaders,
        })
      );
    });

    it('should create event envelope with correct structure', async () => {
      const payload = { id: '123', name: 'Test User' };
      const options = {
        event_id: 'custom-event-id',
        trace_id: 'trace-123',
        occurred_at: new Date('2025-01-01T00:00:00Z'),
      };

      await publisher.publish('users', 'user', 'created', payload, options);

      const publishCall = mockJetstream.publish.mock.calls[0];
      const envelopeJson = publishCall[1];
      const envelope = JSON.parse(envelopeJson);

      expect(envelope).toEqual({
        event_id: 'custom-event-id',
        schema_version: 1,
        topic: 'users.user.created',
        producer: 'test-app',
        domain: 'users',
        resource: 'user',
        action: 'created',
        resource_id: '123',
        occurred_at: '2025-01-01T00:00:00.000Z',
        trace_id: 'trace-123',
        message: payload,
      });
    });

    it('should generate event_id if not provided', async () => {
      const payload = { id: '123', name: 'Test User' };

      await publisher.publish('users', 'user', 'created', payload);

      const publishCall = mockJetstream.publish.mock.calls[0];
      const envelopeJson = publishCall[1];
      const envelope = JSON.parse(envelopeJson);

      expect(envelope.event_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should use current timestamp if occurred_at not provided', async () => {
      const beforeTime = new Date().getTime();
      const payload = { id: '123', name: 'Test User' };

      await publisher.publish('users', 'user', 'created', payload);

      const afterTime = new Date().getTime();
      const publishCall = mockJetstream.publish.mock.calls[0];
      const envelopeJson = publishCall[1];
      const envelope = JSON.parse(envelopeJson);
      const occurredTime = new Date(envelope.occurred_at).getTime();

      expect(occurredTime).toBeGreaterThanOrEqual(beforeTime);
      expect(occurredTime).toBeLessThanOrEqual(afterTime);
    });

    it('should set Nats-Msg-Id header for idempotent publishing', async () => {
      const payload = { id: '123', name: 'Test User' };
      const options = { event_id: 'custom-event-id' };

      await publisher.publish('users', 'user', 'created', payload, options);

      expect(mockHeaders.set).toHaveBeenCalledWith('Nats-Msg-Id', 'custom-event-id');
    });

    it('should set trace_id header when provided', async () => {
      const payload = { id: '123', name: 'Test User' };
      const options = { trace_id: 'trace-123' };

      await publisher.publish('users', 'user', 'created', payload, options);

      expect(mockHeaders.set).toHaveBeenCalledWith('trace_id', 'trace-123');
    });

    it('should not set trace_id header when not provided', async () => {
      const payload = { id: '123', name: 'Test User' };

      await publisher.publish('users', 'user', 'created', payload);

      expect(mockHeaders.set).toHaveBeenCalledTimes(2);
      expect(mockHeaders.set).toHaveBeenCalledWith('Nats-Msg-Id', expect.any(String));
      expect(mockHeaders.set).toHaveBeenCalledWith('topic', 'users.user.created');
    });

    it('should extract resource_id from payload.id', async () => {
      const payload = { id: '123', name: 'Test User' };

      await publisher.publish('users', 'user', 'created', payload);

      const publishCall = mockJetstream.publish.mock.calls[0];
      const envelopeJson = publishCall[1];
      const envelope = JSON.parse(envelopeJson);

      expect(envelope.resource_id).toBe('123');
    });

    it('should extract resource_id from payload.ID', async () => {
      const payload = { ID: '456', name: 'Test User' };

      await publisher.publish('users', 'user', 'created', payload);

      const publishCall = mockJetstream.publish.mock.calls[0];
      const envelopeJson = publishCall[1];
      const envelope = JSON.parse(envelopeJson);

      expect(envelope.resource_id).toBe('456');
    });

    it('should handle payload without id', async () => {
      const payload = { name: 'Test User' };

      await publisher.publish('users', 'user', 'created', payload);

      const publishCall = mockJetstream.publish.mock.calls[0];
      const envelopeJson = publishCall[1];
      const envelope = JSON.parse(envelopeJson);

      expect(envelope.resource_id).toBeUndefined();
    });

    it('should build correct subject from domain, resource, and action', async () => {
      const payload = { id: '123', name: 'Test User' };

      await publisher.publish('orders', 'order', 'placed', payload);

      expect(mockJetstream.publish).toHaveBeenCalledWith(
        'test.test-app.orders.order.placed',
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should handle publish errors', async () => {
      const error = new Error('Publish failed');
      mockJetstream.publish.mockRejectedValueOnce(error);

      const payload = { id: '123', name: 'Test User' };

      await expect(publisher.publish('users', 'user', 'created', payload)).rejects.toThrow(
        'Publish failed'
      );
    });

    it('should ensure connection before publishing', async () => {
      const payload = { id: '123', name: 'Test User' };

      await publisher.publish('users', 'user', 'created', payload);

      expect(connection.ensureConnection).toHaveBeenCalled();
      expect(connection.getJetStream).toHaveBeenCalled();
    });

    it('should publish events with different configurations', async () => {
      config.configure({
        natsUrls: 'nats://localhost:4222',
        env: 'production',
        appName: 'prod-app',
      });

      const payload = { id: '123', name: 'Test User' };

      await publisher.publish('users', 'user', 'created', payload);

      const publishCall = mockJetstream.publish.mock.calls[0];
      const subject = publishCall[0];
      const envelopeJson = publishCall[1];
      const envelope = JSON.parse(envelopeJson);

      expect(subject).toBe('production.prod-app.users.user.created');
      expect(envelope.producer).toBe('prod-app');
    });
  });
});
