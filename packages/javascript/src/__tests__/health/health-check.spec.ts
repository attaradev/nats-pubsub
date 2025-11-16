import { HealthCheck } from '../../health/health-check';
import connection from '../../core/connection';
import config from '../../core/config';

jest.mock('../../core/connection');
jest.mock('../../core/config');

describe('HealthCheck', () => {
  let healthCheck: HealthCheck;
  let mockConnection: any;
  let mockJetstream: any;
  let mockJetstreamManager: any;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockJetstreamManager = {
      consumers: {
        list: jest.fn(),
        info: jest.fn(),
      },
    };

    mockConnection = {
      isClosed: jest.fn().mockReturnValue(false),
      getServer: jest.fn().mockReturnValue(['nats://localhost:4222']),
      jetstreamManager: jest.fn().mockResolvedValue(mockJetstreamManager),
    };

    mockJetstream = {};

    (connection as any).connection = mockConnection;
    (connection.getJetStream as jest.Mock).mockReturnValue(mockJetstream);

    Object.defineProperty(config, 'logger', {
      get: () => mockLogger,
      configurable: true,
    });

    Object.defineProperty(config, 'streamName', {
      get: () => 'test-events-stream',
      configurable: true,
    });

    healthCheck = new HealthCheck();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('check', () => {
    it('should return healthy status when all checks pass', async () => {
      const status = await healthCheck.check();

      expect(status.healthy).toBe(true);
      expect(status.checks.nats.connected).toBe(true);
      expect(status.checks.jetstream.available).toBe(true);
      expect(status.timestamp).toBeDefined();
    });

    it('should include timestamp in ISO format', async () => {
      const status = await healthCheck.check();

      expect(status.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should return unhealthy when NATS is disconnected', async () => {
      mockConnection.isClosed.mockReturnValue(true);

      const status = await healthCheck.check();

      expect(status.healthy).toBe(false);
      expect(status.checks.nats.connected).toBe(false);
    });

    it('should return unhealthy when connection is null', async () => {
      (connection as any).connection = null;

      const status = await healthCheck.check();

      expect(status.healthy).toBe(false);
      expect(status.checks.nats.connected).toBe(false);
      expect(status.checks.nats.lastError).toBe('No connection established');
    });

    it('should return unhealthy when JetStream is not available', async () => {
      (connection.getJetStream as jest.Mock).mockReturnValue(null);

      const status = await healthCheck.check();

      expect(status.healthy).toBe(false);
      expect(status.checks.jetstream.available).toBe(false);
      expect(status.checks.jetstream.lastError).toBe('JetStream not initialized');
    });

    it('should include server count in NATS check', async () => {
      mockConnection.getServer.mockReturnValue(['nats://server1:4222', 'nats://server2:4222']);

      const status = await healthCheck.check();

      expect(status.checks.nats.servers).toBe(2);
    });

    it('should handle missing server info', async () => {
      mockConnection.getServer.mockReturnValue(undefined);

      const status = await healthCheck.check();

      expect(status.checks.nats.servers).toBe(0);
    });
  });

  describe('checkNatsConnection', () => {
    it('should return connected true when connection is open', async () => {
      const result = await (healthCheck as any).checkNatsConnection();

      expect(result.connected).toBe(true);
      expect(result.servers).toBe(1);
    });

    it('should return connected false when connection is closed', async () => {
      mockConnection.isClosed.mockReturnValue(true);

      const result = await (healthCheck as any).checkNatsConnection();

      expect(result.connected).toBe(false);
    });

    it('should handle connection check errors', async () => {
      mockConnection.isClosed.mockImplementation(() => {
        throw new Error('Connection check failed');
      });

      const result = await (healthCheck as any).checkNatsConnection();

      expect(result.connected).toBe(false);
      expect(result.lastError).toBe('Connection check failed');
    });

    it('should handle non-Error exceptions', async () => {
      mockConnection.isClosed.mockImplementation(() => {
        throw 'string error';
      });

      const result = await (healthCheck as any).checkNatsConnection();

      expect(result.connected).toBe(false);
      expect(result.lastError).toBe('Unknown error');
    });
  });

  describe('checkJetStream', () => {
    it('should return available true when JetStream is initialized', async () => {
      const result = await (healthCheck as any).checkJetStream();

      expect(result.available).toBe(true);
      expect(result.lastError).toBeUndefined();
    });

    it('should return available false when JetStream is null', async () => {
      (connection.getJetStream as jest.Mock).mockReturnValue(null);

      const result = await (healthCheck as any).checkJetStream();

      expect(result.available).toBe(false);
      expect(result.lastError).toBe('JetStream not initialized');
    });

    it('should return available false when JetStream manager is not available', async () => {
      mockConnection.jetstreamManager.mockResolvedValue(null);

      const result = await (healthCheck as any).checkJetStream();

      expect(result.available).toBe(false);
      expect(result.lastError).toBe('JetStream manager not available');
    });

    it('should handle JetStream check errors', async () => {
      (connection.getJetStream as jest.Mock).mockImplementation(() => {
        throw new Error('JetStream error');
      });

      const result = await (healthCheck as any).checkJetStream();

      expect(result.available).toBe(false);
      expect(result.lastError).toBe('JetStream error');
    });
  });

  describe('checkConsumerLag', () => {
    const mockConsumerInfo = {
      name: 'test-consumer',
      num_pending: 10,
      delivered: { stream_seq: 100 },
      num_ack_pending: 5,
    };

    beforeEach(() => {
      mockJetstreamManager.consumers.list.mockReturnValue({
        next: jest.fn().mockResolvedValue([{ name: 'test-consumer' }]),
      });
      mockJetstreamManager.consumers.info.mockResolvedValue(mockConsumerInfo);
    });

    it('should return consumer lag information', async () => {
      const result = await healthCheck.checkConsumerLag();

      expect(result.stream).toBe('test-events-stream');
      expect(result.consumers).toHaveLength(1);
      expect(result.consumers[0]).toEqual({
        name: 'test-consumer',
        pending: 10,
        delivered: 100,
        ackPending: 5,
      });
    });

    it('should use provided stream name', async () => {
      await healthCheck.checkConsumerLag('custom-stream');

      expect(mockJetstreamManager.consumers.list).toHaveBeenCalledWith('custom-stream');
    });

    it('should use default stream name if not provided', async () => {
      await healthCheck.checkConsumerLag();

      expect(mockJetstreamManager.consumers.list).toHaveBeenCalledWith('test-events-stream');
    });

    it('should handle multiple consumers', async () => {
      mockJetstreamManager.consumers.list.mockReturnValue({
        next: jest.fn().mockResolvedValue([{ name: 'consumer-1' }, { name: 'consumer-2' }]),
      });

      mockJetstreamManager.consumers.info
        .mockResolvedValueOnce({
          name: 'consumer-1',
          num_pending: 5,
          delivered: { stream_seq: 50 },
          num_ack_pending: 2,
        })
        .mockResolvedValueOnce({
          name: 'consumer-2',
          num_pending: 15,
          delivered: { stream_seq: 150 },
          num_ack_pending: 8,
        });

      const result = await healthCheck.checkConsumerLag();

      expect(result.consumers).toHaveLength(2);
      expect(result.consumers[0].name).toBe('consumer-1');
      expect(result.consumers[1].name).toBe('consumer-2');
    });

    it('should throw error when JetStream manager is not available', async () => {
      mockConnection.jetstreamManager.mockResolvedValue(null);

      await expect(healthCheck.checkConsumerLag()).rejects.toThrow(
        'JetStream manager not available'
      );
    });

    it('should log error and throw on failure', async () => {
      const error = new Error('Failed to list consumers');
      mockJetstreamManager.consumers.list.mockReturnValue({
        next: jest.fn().mockRejectedValue(error),
      });

      await expect(healthCheck.checkConsumerLag()).rejects.toThrow('Failed to list consumers');

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to check consumer lag', {
        error: 'Failed to list consumers',
      });
    });

    it('should handle non-Error exceptions in consumer lag check', async () => {
      mockJetstreamManager.consumers.list.mockReturnValue({
        next: jest.fn().mockRejectedValue('string error'),
      });

      await expect(healthCheck.checkConsumerLag()).rejects.toBe('string error');

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to check consumer lag', {
        error: 'Unknown error',
      });
    });
  });

  describe('integration', () => {
    it('should perform all checks when check() is called', async () => {
      const status = await healthCheck.check();

      expect(mockConnection.isClosed).toHaveBeenCalled();
      expect(connection.getJetStream).toHaveBeenCalled();
      expect(mockConnection.jetstreamManager).toHaveBeenCalled();
      expect(status).toHaveProperty('healthy');
      expect(status).toHaveProperty('checks');
      expect(status).toHaveProperty('timestamp');
    });

    it('should work with real timestamp', async () => {
      const before = new Date();
      const status = await healthCheck.check();
      const after = new Date();

      const timestamp = new Date(status.timestamp);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
});
