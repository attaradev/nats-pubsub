import { Consumer } from '../../consumer/consumer';
import connection from '../../core/connection';
import config from '../../core/config';
import { JsMsg, headers as natsHeaders } from 'nats';
import { Subscriber } from '../../types';

jest.mock('../../core/connection');
jest.mock('../../core/config');
jest.mock('nats');

describe('Consumer', () => {
  let consumer: Consumer;
  let mockLogger: {
    debug: jest.Mock;
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
  };
  let mockJetStream: any;
  let mockConnection: any;
  let mockJetstreamManager: any;

  beforeEach(() => {
    consumer = new Consumer();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const mockConsumer = {
      consume: jest.fn().mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          // Empty iterator for testing
        },
      }),
    };

    mockJetStream = {
      consumers: {
        get: jest.fn().mockResolvedValue(mockConsumer),
      },
      publish: jest.fn().mockResolvedValue(undefined),
    };

    mockJetstreamManager = {
      streams: {
        info: jest.fn(),
        add: jest.fn().mockResolvedValue(undefined),
      },
    };

    mockConnection = {
      jetstreamManager: jest.fn().mockResolvedValue(mockJetstreamManager),
    };

    (connection.ensureConnection as jest.Mock).mockResolvedValue(undefined);
    (connection.getJetStream as jest.Mock).mockReturnValue(mockJetStream);
    (connection.getConnection as jest.Mock).mockReturnValue(mockConnection);
    (connection.disconnect as jest.Mock).mockResolvedValue(undefined);

    (config.get as jest.Mock).mockReturnValue({
      natsUrls: 'nats://localhost:4222',
      appName: 'test-app',
      env: 'test',
      concurrency: 10,
      maxDeliver: 5,
      ackWait: 30000,
      backoff: [1000, 5000, 15000],
      useDlq: true,
      perMessageConcurrency: 5,
      subscriberTimeoutMs: 30000,
      dlqMaxAttempts: 3,
      dlqSubject: 'test.events.dlq',
      streamName: 'test-events-stream',
    });

    Object.defineProperty(config, 'logger', {
      get: () => mockLogger,
      configurable: true,
    });

    Object.defineProperty(config, 'streamName', {
      get: () => 'test-events-stream',
      configurable: true,
    });

    Object.defineProperty(config, 'dlqSubject', {
      get: () => 'test.events.dlq',
      configurable: true,
    });

    (natsHeaders as jest.Mock).mockReturnValue({
      set: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
      has: jest.fn(),
    });
  });

  afterEach(async () => {
    // Ensure consumer is stopped to prevent leaks
    if ((consumer as any).running) {
      await consumer.stop();
    }
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers(); // Ensure we reset to real timers
  });

  describe('registerSubscriber', () => {
    it('should register a subscriber for a single subject', () => {
      const subscriber: Subscriber = {
        subjects: ['test.events.users.user.created'],
        call: jest.fn(),
      } as any;

      consumer.registerSubscriber(subscriber);

      expect((consumer as any).subscribers.has('test.events.users.user.created')).toBe(true);
      expect((consumer as any).subscribers.get('test.events.users.user.created')).toContain(
        subscriber
      );
    });

    it('should register a subscriber for multiple subjects', () => {
      const subscriber: Subscriber = {
        subjects: ['test.events.users.user.created', 'test.events.orders.order.updated'],
        call: jest.fn(),
      } as any;

      consumer.registerSubscriber(subscriber);

      expect((consumer as any).subscribers.has('test.events.users.user.created')).toBe(true);
      expect((consumer as any).subscribers.has('test.events.orders.order.updated')).toBe(true);
    });

    it('should allow multiple subscribers for the same subject', () => {
      const subscriber1: Subscriber = {
        subjects: ['test.events.users.user.created'],
        call: jest.fn(),
      } as any;

      const subscriber2: Subscriber = {
        subjects: ['test.events.users.user.created'],
        call: jest.fn(),
      } as any;

      consumer.registerSubscriber(subscriber1);
      consumer.registerSubscriber(subscriber2);

      const subscribers = (consumer as any).subscribers.get('test.events.users.user.created');
      expect(subscribers).toHaveLength(2);
      expect(subscribers).toContain(subscriber1);
      expect(subscribers).toContain(subscriber2);
    });
  });

  describe('use', () => {
    it('should add middleware to the chain', () => {
      const middleware = {
        execute: jest.fn((_payload, _metadata, next) => next()),
      };

      consumer.use(middleware as any);

      expect((consumer as any).middlewareChain).toBeDefined();
    });
  });

  describe('start', () => {
    beforeEach(() => {
      mockJetstreamManager.streams.info.mockRejectedValue({ code: '404' });
    });

    it('should throw error if already running', async () => {
      (consumer as any).running = true;
      await expect(consumer.start()).rejects.toThrow('Consumer already running');
    });

    it('should ensure connection', async () => {
      await consumer.start();
      expect(connection.ensureConnection).toHaveBeenCalled();
    });

    it('should set running to true', async () => {
      await consumer.start();
      expect((consumer as any).running).toBe(true);
    });

    it('should log starting message', async () => {
      await consumer.start();
      expect(mockLogger.info).toHaveBeenCalledWith('Starting consumer...');
    });

    it('should ensure topology', async () => {
      await consumer.start();
      expect(mockConnection.jetstreamManager).toHaveBeenCalled();
    });

    it('should log consumer started with subjects', async () => {
      const subscriber: Subscriber = {
        subjects: ['test.events.users.user.created'],
        call: jest.fn(),
      } as any;

      consumer.registerSubscriber(subscriber);
      await consumer.start();

      expect(mockLogger.info).toHaveBeenCalledWith('Consumer started', {
        subjects: ['test.events.users.user.created'],
      });
    });
  });

  describe('stop', () => {
    it('should set running to false', async () => {
      (consumer as any).running = true;
      await consumer.stop();
      expect((consumer as any).running).toBe(false);
    });

    it('should disconnect connection', async () => {
      await consumer.stop();
      expect(connection.disconnect).toHaveBeenCalled();
    });

    it('should log stopping and stopped messages', async () => {
      await consumer.stop();
      expect(mockLogger.info).toHaveBeenCalledWith('Stopping consumer...');
      expect(mockLogger.info).toHaveBeenCalledWith('Consumer stopped');
    });
  });

  describe('ensureTopology', () => {
    it('should check if stream exists', async () => {
      mockJetstreamManager.streams.info.mockResolvedValue({});

      await (consumer as any).ensureTopology();

      expect(mockJetstreamManager.streams.info).toHaveBeenCalledWith('test-events-stream');
    });

    it('should create stream if it does not exist', async () => {
      mockJetstreamManager.streams.info.mockRejectedValue({ code: '404' });

      await (consumer as any).ensureTopology();

      expect(mockJetstreamManager.streams.add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-events-stream',
          subjects: expect.arrayContaining(['test.events.>', 'test.events.dlq']),
        })
      );
    });

    it('should not create stream if it already exists', async () => {
      mockJetstreamManager.streams.info.mockResolvedValue({});

      await (consumer as any).ensureTopology();

      expect(mockJetstreamManager.streams.add).not.toHaveBeenCalled();
    });

    it('should create DLQ stream if useDlq is enabled', async () => {
      mockJetstreamManager.streams.info.mockRejectedValue({ code: '404' });

      await (consumer as any).ensureTopology();

      expect(mockJetstreamManager.streams.add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-events-stream-dlq',
          subjects: ['test.events.dlq'],
        })
      );
    });

    it('should throw error for non-404 errors', async () => {
      mockJetstreamManager.streams.info.mockRejectedValue({ code: '500', message: 'Server error' });

      await expect((consumer as any).ensureTopology()).rejects.toEqual({
        code: '500',
        message: 'Server error',
      });
    });
  });

  describe('buildDurableName', () => {
    it('should build durable name from subject', () => {
      const name = (consumer as any).buildDurableName('test.events.users.user.created');
      expect(name).toBe('test-app_test_events_users_user_created');
    });

    it('should replace wildcards in subject', () => {
      const name = (consumer as any).buildDurableName('test.events.*');
      expect(name).toBe('test-app_test_events__');
    });

    it('should replace > in subject', () => {
      const name = (consumer as any).buildDurableName('test.events.>');
      expect(name).toBe('test-app_test_events__');
    });
  });

  describe('extractDomain', () => {
    it('should extract domain from subject', () => {
      const domain = (consumer as any).extractDomain('test.events.users.user.created');
      expect(domain).toBe('users');
    });

    it('should return empty string for invalid subject', () => {
      const domain = (consumer as any).extractDomain('test.events');
      expect(domain).toBe('');
    });
  });

  describe('processMessage', () => {
    let mockMsg: Partial<JsMsg>;
    let mockSubscriber: Subscriber;

    beforeEach(() => {
      mockMsg = {
        data: Buffer.from(
          JSON.stringify({
            event_id: 'event-123',
            resource_type: 'user',
            event_type: 'created',
            payload: { name: 'John' },
            trace_id: 'trace-123',
          })
        ),
        subject: 'test.events.users.user.created',
        seq: 1,
        info: {
          deliveryCount: 1,
          stream: 'test-events-stream',
        } as any,
        ack: jest.fn(),
        nak: jest.fn(),
        term: jest.fn(),
        headers: undefined,
      };

      mockSubscriber = {
        subjects: ['test.events.users.user.created'],
        call: jest.fn().mockResolvedValue(undefined),
        constructor: { name: 'TestSubscriber' },
      } as any;

      consumer.registerSubscriber(mockSubscriber);
    });

    it('should process message successfully', async () => {
      await (consumer as any).processMessage(mockMsg, 'test.events.users.user.created');

      expect(mockSubscriber.call).toHaveBeenCalledWith(
        { name: 'John' },
        expect.objectContaining({
          event_id: 'event-123',
          subject: 'test.events.users.user.created',
          resource: 'user',
          action: 'created',
        })
      );
      expect(mockMsg.ack).toHaveBeenCalled();
    });

    it('should log debug messages', async () => {
      await (consumer as any).processMessage(mockMsg, 'test.events.users.user.created');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Processing message',
        expect.objectContaining({
          subject: 'test.events.users.user.created',
          event_id: 'event-123',
        })
      );
    });

    it('should handle subscriber timeout', async () => {
      // Set a very short timeout for this test
      (config.get as jest.Mock).mockReturnValue({
        ...config.get(),
        subscriberTimeoutMs: 50, // 50ms timeout
        useDlq: false, // Disable DLQ for simpler test
      });

      // Create a slow subscriber that never resolves (simulating a hanging call)
      // Using a promise that never resolves is cleaner than one with a long setTimeout
      mockSubscriber.call = jest.fn().mockImplementation(() => new Promise(() => {}));

      await (consumer as any).processMessage(mockMsg, 'test.events.users.user.created');

      // When subscriber times out, the promise race should reject
      // This should result in the message being nak'd, not ack'd
      expect(mockMsg.ack).not.toHaveBeenCalled();
      expect(mockMsg.nak).toHaveBeenCalled();
    });

    it('should handle parse errors', async () => {
      mockMsg.data = Buffer.from('invalid json');

      await (consumer as any).processMessage(mockMsg, 'test.events.users.user.created');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to process message',
        expect.objectContaining({
          subject: 'test.events.users.user.created',
        })
      );
    });
  });

  describe('handleFailure', () => {
    let mockMsg: Partial<JsMsg>;

    beforeEach(() => {
      mockMsg = {
        data: Buffer.from(
          JSON.stringify({
            event_id: 'event-123',
            payload: { test: 'data' },
          })
        ),
        subject: 'test.events.test',
        info: {
          deliveryCount: 1,
        } as any,
        ack: jest.fn(),
        nak: jest.fn(),
        term: jest.fn(),
        headers: undefined,
      };
    });

    it('should publish to DLQ when useDlq is true', async () => {
      await (consumer as any).handleFailure(mockMsg as JsMsg, new Error('Test error'));

      expect(mockJetStream.publish).toHaveBeenCalledWith(
        'test.events.dlq',
        expect.any(Buffer),
        expect.any(Object)
      );
      expect(mockMsg.ack).toHaveBeenCalled();
    });

    it('should nak message when DLQ publish fails', async () => {
      mockJetStream.publish.mockRejectedValue(new Error('DLQ failed'));

      await (consumer as any).handleFailure(mockMsg as JsMsg, new Error('Test error'));

      expect(mockMsg.nak).toHaveBeenCalled();
    });

    it('should term message when max deliveries exceeded', async () => {
      mockMsg.info!.deliveryCount = 5;

      (config.get as jest.Mock).mockReturnValue({
        ...config.get(),
        useDlq: false,
      });

      await (consumer as any).handleFailure(mockMsg as JsMsg, new Error('Test error'));

      expect(mockMsg.term).toHaveBeenCalled();
    });

    it('should nak message for retry when under max attempts', async () => {
      mockMsg.info!.deliveryCount = 2;

      (config.get as jest.Mock).mockReturnValue({
        ...config.get(),
        useDlq: false,
        maxDeliver: 5,
      });

      await (consumer as any).handleFailure(mockMsg as JsMsg, new Error('Test error'));

      expect(mockMsg.nak).toHaveBeenCalled();
    });
  });

  describe('publishToDlq', () => {
    let mockMsg: Partial<JsMsg>;

    beforeEach(() => {
      mockMsg = {
        data: Buffer.from(
          JSON.stringify({
            event_id: 'event-123',
            payload: { test: 'data' },
            trace_id: 'trace-456',
          })
        ),
        subject: 'test.events.test',
        sid: 123,
        info: {
          deliveryCount: 3,
        } as any,
        headers: undefined,
      };
    });

    it('should publish message to DLQ with correct payload', async () => {
      await (consumer as any).publishToDlq(
        mockMsg as JsMsg,
        new Error('Test error'),
        'handler_error'
      );

      expect(mockJetStream.publish).toHaveBeenCalledWith(
        'test.events.dlq',
        expect.any(Buffer),
        expect.objectContaining({
          headers: expect.any(Object),
        })
      );

      const publishedData = JSON.parse(
        (mockJetStream.publish as jest.Mock).mock.calls[0][1].toString()
      );
      expect(publishedData).toMatchObject({
        event_id: 'event-123',
        original_subject: 'test.events.test',
        deliveries: 3,
        reason: 'handler_error',
        error: 'Error: Test error',
        trace_id: 'trace-456',
      });
    });

    it('should set DLQ headers', async () => {
      const mockHeaders = {
        set: jest.fn(),
      };
      (natsHeaders as jest.Mock).mockReturnValue(mockHeaders);

      await (consumer as any).publishToDlq(
        mockMsg as JsMsg,
        new Error('Test error'),
        'max_deliver_exceeded'
      );

      expect(mockHeaders.set).toHaveBeenCalledWith('x-dead-letter', 'true');
      expect(mockHeaders.set).toHaveBeenCalledWith('x-dlq-reason', 'max_deliver_exceeded');
      expect(mockHeaders.set).toHaveBeenCalledWith('x-deliveries', '3');
    });

    it('should throw error if dlqSubject is not configured', async () => {
      (config.get as jest.Mock).mockReturnValue({
        ...config.get(),
        dlqSubject: undefined,
      });

      Object.defineProperty(config, 'dlqSubject', {
        get: () => undefined,
        configurable: true,
      });

      await expect(
        (consumer as any).publishToDlq(mockMsg as JsMsg, new Error('Test error'), 'handler_error')
      ).rejects.toThrow('DLQ subject is not configured');
    });
  });
});
