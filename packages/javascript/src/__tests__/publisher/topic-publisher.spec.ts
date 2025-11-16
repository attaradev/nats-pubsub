import { TopicPublisher } from '../../publisher/topic-publisher';
import connection from '../../core/connection';
import config from '../../core/config';

// Mock dependencies
jest.mock('../../core/connection');
jest.mock('nats', () => ({
  headers: jest.fn(() => ({
    set: jest.fn(),
  })),
}));

describe('TopicPublisher', () => {
  let publisher: TopicPublisher;
  let mockJetstream: any;
  let mockHeaders: any;

  beforeEach(() => {
    publisher = new TopicPublisher();

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

  describe('publishToTopic', () => {
    it('should publish to a simple topic', async () => {
      const message = { text: 'Hello', user_id: 123 };

      await publisher.publishToTopic('notifications', message);

      expect(connection.ensureConnection).toHaveBeenCalled();
      expect(connection.getJetStream).toHaveBeenCalled();
      expect(mockJetstream.publish).toHaveBeenCalledWith(
        'test.test-app.notifications',
        expect.any(String),
        expect.objectContaining({
          msgID: expect.any(String),
          headers: mockHeaders,
        })
      );
    });

    it('should publish to a hierarchical topic', async () => {
      const message = { to: 'user@example.com', subject: 'Welcome' };

      await publisher.publishToTopic('notifications.email', message);

      const publishCall = mockJetstream.publish.mock.calls[0];
      expect(publishCall[0]).toBe('test.test-app.notifications.email');
    });

    it('should publish to multi-level hierarchical topic', async () => {
      const message = { order_id: 456, total: 99.99 };

      await publisher.publishToTopic('order.processing.completed', message);

      const publishCall = mockJetstream.publish.mock.calls[0];
      expect(publishCall[0]).toBe('test.test-app.order.processing.completed');
    });

    it('should create topic envelope with correct structure', async () => {
      const message = { text: 'Hello', user_id: 123 };
      const options = {
        event_id: 'custom-event-id',
        trace_id: 'trace-123',
        occurred_at: new Date('2025-01-01T00:00:00Z'),
        message_type: 'urgent',
      };

      await publisher.publishToTopic('notifications', message, options);

      const publishCall = mockJetstream.publish.mock.calls[0];
      const envelopeJson = publishCall[1];
      const envelope = JSON.parse(envelopeJson);

      expect(envelope).toEqual({
        event_id: 'custom-event-id',
        schema_version: 1,
        topic: 'notifications',
        message_type: 'urgent',
        producer: 'test-app',
        occurred_at: '2025-01-01T00:00:00.000Z',
        trace_id: 'trace-123',
        message,
      });
    });

    it('should generate event_id if not provided', async () => {
      const message = { text: 'Hello' };

      await publisher.publishToTopic('notifications', message);

      const publishCall = mockJetstream.publish.mock.calls[0];
      const envelopeJson = publishCall[1];
      const envelope = JSON.parse(envelopeJson);

      expect(envelope.event_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should set topic header', async () => {
      const message = { text: 'Hello' };

      await publisher.publishToTopic('notifications', message);

      expect(mockHeaders.set).toHaveBeenCalledWith('topic', 'notifications');
    });

    it('should set trace_id header when provided', async () => {
      const message = { text: 'Hello' };
      const options = { trace_id: 'trace-123' };

      await publisher.publishToTopic('notifications', message, options);

      expect(mockHeaders.set).toHaveBeenCalledWith('trace_id', 'trace-123');
    });

    it('should handle publish errors', async () => {
      const error = new Error('Publish failed');
      mockJetstream.publish.mockRejectedValueOnce(error);

      const message = { text: 'Hello' };

      await expect(publisher.publishToTopic('notifications', message)).rejects.toThrow(
        'Publish failed'
      );
    });

    it('should normalize topic names correctly', async () => {
      const message = { text: 'Hello' };

      // Test uppercase
      await publisher.publishToTopic('NOTIFICATIONS', message);
      expect(mockJetstream.publish.mock.calls[0][0]).toBe('test.test-app.notifications');

      jest.clearAllMocks();

      // Test special characters
      await publisher.publishToTopic('user@events!', message);
      expect(mockJetstream.publish.mock.calls[0][0]).toBe('test.test-app.user_events_');
    });

    it('should preserve dots in hierarchical topics', async () => {
      const message = { text: 'Hello' };

      await publisher.publishToTopic('analytics.user.signup', message);

      expect(mockJetstream.publish.mock.calls[0][0]).toBe('test.test-app.analytics.user.signup');
    });

    it('should preserve wildcards in topic names', async () => {
      const message = { text: 'Hello' };

      await publisher.publishToTopic('notifications.*', message);

      expect(mockJetstream.publish.mock.calls[0][0]).toBe('test.test-app.notifications.*');
    });
  });

  describe('publishToTopics', () => {
    it('should publish to multiple topics', async () => {
      const message = { action: 'user_login', user_id: 123 };
      const topics = ['notifications', 'audit.user_events'];

      const results = await publisher.publishToTopics(topics, message);

      expect(mockJetstream.publish).toHaveBeenCalledTimes(2);
      expect(results).toEqual({
        notifications: true,
        'audit.user_events': true,
      });
    });

    it('should handle partial failures', async () => {
      mockJetstream.publish
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Failed'));

      const message = { text: 'Hello' };
      const topics = ['topic1', 'topic2'];

      const results = await publisher.publishToTopics(topics, message);

      expect(results).toEqual({
        topic1: true,
        topic2: false,
      });
    });

    it('should publish the same message to all topics', async () => {
      const message = { action: 'password_changed', user_id: 123 };
      const topics = ['notifications', 'audit.events', 'security.alerts'];

      await publisher.publishToTopics(topics, message);

      expect(mockJetstream.publish).toHaveBeenCalledTimes(3);

      // Check that all envelopes have the same message
      for (let i = 0; i < 3; i++) {
        const envelopeJson = mockJetstream.publish.mock.calls[i][1];
        const envelope = JSON.parse(envelopeJson);
        expect(envelope.message).toEqual(message);
      }
    });
  });

  describe('publish (domain/resource/action)', () => {
    it('should map domain/resource/action to topic', async () => {
      const payload = { id: '123', name: 'John' };

      await publisher.publish('users', 'user', 'created', payload);

      const publishCall = mockJetstream.publish.mock.calls[0];
      const subject = publishCall[0];
      const envelopeJson = publishCall[1];
      const envelope = JSON.parse(envelopeJson);

      // Should map to topic: users.user.created
      expect(subject).toBe('test.test-app.users.user.created');
      expect(envelope.topic).toBe('users.user.created');
      expect(envelope.domain).toBe('users');
      expect(envelope.resource).toBe('user');
      expect(envelope.action).toBe('created');
    });

    it('should include domain/resource/action fields in envelope', async () => {
      const payload = { id: '123', name: 'John' };

      await publisher.publish('orders', 'order', 'placed', payload);

      const publishCall = mockJetstream.publish.mock.calls[0];
      const envelopeJson = publishCall[1];
      const envelope = JSON.parse(envelopeJson);

      expect(envelope).toMatchObject({
        topic: 'orders.order.placed',
        domain: 'orders',
        resource: 'order',
        action: 'placed',
        resource_id: '123',
        message: payload,
      });
    });
  });

  describe('cross-environment support', () => {
    it('should work with different environments', async () => {
      config.configure({
        env: 'production',
        appName: 'prod-app',
      });

      const message = { text: 'Hello' };
      await publisher.publishToTopic('notifications', message);

      const publishCall = mockJetstream.publish.mock.calls[0];
      expect(publishCall[0]).toBe('production.prod-app.notifications');

      const envelopeJson = publishCall[1];
      const envelope = JSON.parse(envelopeJson);
      expect(envelope.producer).toBe('prod-app');
    });
  });
});
