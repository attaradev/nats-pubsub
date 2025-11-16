import { Consumer } from '../../subscribers/consumer';
import connection from '../../core/connection';
import config from '../../core/config';
import { headers as natsHeaders } from 'nats';
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
        handle: jest.fn(),
      } as any;

      consumer.registerSubscriber(subscriber);

      const registry = (consumer as any).registry;
      expect(registry.hasSubscribers('test.events.users.user.created')).toBe(true);
      expect(registry.getSubscribers('test.events.users.user.created')).toContain(subscriber);
    });

    it('should register a subscriber for multiple subjects', () => {
      const subscriber: Subscriber = {
        subjects: ['test.events.users.user.created', 'test.events.orders.order.updated'],
        handle: jest.fn(),
      } as any;

      consumer.registerSubscriber(subscriber);

      const registry = (consumer as any).registry;
      expect(registry.hasSubscribers('test.events.users.user.created')).toBe(true);
      expect(registry.hasSubscribers('test.events.orders.order.updated')).toBe(true);
    });

    it('should allow multiple subscribers for the same subject', () => {
      const subscriber1: Subscriber = {
        subjects: ['test.events.users.user.created'],
        handle: jest.fn(),
      } as any;

      const subscriber2: Subscriber = {
        subjects: ['test.events.users.user.created'],
        handle: jest.fn(),
      } as any;

      consumer.registerSubscriber(subscriber1);
      consumer.registerSubscriber(subscriber2);

      const registry = (consumer as any).registry;
      const subscribers = registry.getSubscribers('test.events.users.user.created');
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
        handle: jest.fn(),
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

  // Note: ensureTopology tests have been moved to topology-manager.spec.ts
  // as topology management is now handled by the TopologyManager class

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

  // Note: extractDomain tests have been removed as this method
  // is no longer part of Consumer

  // Note: processMessage tests have been moved to message-processor.spec.ts
  // as message processing is now handled by the MessageProcessor class

  // Note: handleFailure tests have been moved to message-processor.spec.ts
  // as failure handling is now part of the MessageProcessor class

  /*
  // Legacy tests commented out - functionality moved to MessageProcessor
  describe('processMessage (legacy)', () => {
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

  // Note: publishToDlq tests have been moved to dlq-handler.spec.ts
  // as DLQ functionality is now handled by the DlqHandler class
  */
});
