import { connect, NatsConnection, JetStreamClient } from 'nats';
import Connection from '../../core/connection';
import config from '../../core/config';

jest.mock('nats');
jest.mock('../../core/config');

describe('Connection', () => {
  let mockConnection: Partial<NatsConnection>;
  let mockJetstream: Partial<JetStreamClient>;
  let mockLogger: {
    debug: jest.Mock;
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
  };
  let statusIterator: AsyncIterableIterator<any>;

  beforeEach(() => {
    // Reset connection state
    Connection.connection = null;
    Connection.jetstream = null;
    (Connection as any).connecting = null;

    // Setup mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Setup mock status iterator
    statusIterator = {
      next: jest.fn().mockResolvedValue({ done: true, value: undefined }),
      return: jest.fn(),
      throw: jest.fn(),
      [Symbol.asyncIterator]: function () {
        return this;
      },
    } as AsyncIterableIterator<any>;

    // Setup mock connection
    mockConnection = {
      isClosed: jest.fn().mockReturnValue(false),
      drain: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      status: jest.fn().mockReturnValue(statusIterator),
      jetstream: jest.fn(),
    };

    // Setup mock jetstream
    mockJetstream = {};

    // Mock jetstream method
    (mockConnection.jetstream as jest.Mock).mockReturnValue(mockJetstream);

    // Mock connect function
    (connect as jest.Mock).mockResolvedValue(mockConnection);

    // Mock config
    (config.get as jest.Mock).mockReturnValue({
      natsUrls: 'nats://localhost:4222',
      appName: 'test-app',
      env: 'test',
    });

    Object.defineProperty(config, 'logger', {
      get: () => mockLogger,
      configurable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('connect', () => {
    it('should establish a connection to NATS', async () => {
      await Connection.connect();

      expect(connect).toHaveBeenCalledWith({
        servers: ['nats://localhost:4222'],
        name: 'test-app',
        maxReconnectAttempts: -1,
        reconnectTimeWait: 1000,
        waitOnFirstConnect: true,
      });
      expect(Connection.connection).toBe(mockConnection);
    });

    it('should initialize JetStream client', async () => {
      await Connection.connect();

      expect(mockConnection.jetstream).toHaveBeenCalled();
      expect(Connection.jetstream).toBe(mockJetstream);
    });

    it('should log connection progress', async () => {
      await Connection.connect();

      expect(mockLogger.info).toHaveBeenCalledWith('Connecting to NATS...', {
        urls: 'nats://localhost:4222',
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Connected to NATS successfully');
      expect(mockLogger.info).toHaveBeenCalledWith('JetStream client initialized');
    });

    it('should handle array of NATS URLs', async () => {
      (config.get as jest.Mock).mockReturnValue({
        natsUrls: ['nats://server1:4222', 'nats://server2:4222'],
        appName: 'test-app',
        env: 'test',
      });

      await Connection.connect();

      expect(connect).toHaveBeenCalledWith(
        expect.objectContaining({
          servers: ['nats://server1:4222', 'nats://server2:4222'],
        })
      );
    });

    it('should convert single URL string to array', async () => {
      (config.get as jest.Mock).mockReturnValue({
        natsUrls: 'nats://single:4222',
        appName: 'test-app',
        env: 'test',
      });

      await Connection.connect();

      expect(connect).toHaveBeenCalledWith(
        expect.objectContaining({
          servers: ['nats://single:4222'],
        })
      );
    });

    it('should not connect if already connected', async () => {
      await Connection.connect();
      const firstConnection = Connection.connection;

      jest.clearAllMocks();
      await Connection.connect();

      expect(connect).not.toHaveBeenCalled();
      expect(Connection.connection).toBe(firstConnection);
    });

    it('should handle concurrent connection attempts', async () => {
      const promise1 = Connection.connect();
      const promise2 = Connection.connect();
      const promise3 = Connection.connect();

      await Promise.all([promise1, promise2, promise3]);

      expect(connect).toHaveBeenCalledTimes(1);
    });

    it('should log and throw error on connection failure', async () => {
      const error = new Error('Connection failed');
      (connect as jest.Mock).mockRejectedValue(error);

      await expect(Connection.connect()).rejects.toThrow('Connection failed');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to connect to NATS', { error });
    });

    it('should setup event handlers after connection', async () => {
      await Connection.connect();
      expect(mockConnection.status).toHaveBeenCalled();
    });
  });

  describe('setupEventHandlers', () => {
    it('should handle disconnect event', async () => {
      const disconnectStatus = { type: 'disconnect' };
      statusIterator.next = jest
        .fn()
        .mockResolvedValueOnce({ done: false, value: disconnectStatus })
        .mockResolvedValueOnce({ done: true, value: undefined });

      await Connection.connect();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockLogger.warn).toHaveBeenCalledWith('Disconnected from NATS');
    });

    it('should handle reconnect event', async () => {
      const reconnectStatus = { type: 'reconnect' };
      statusIterator.next = jest
        .fn()
        .mockResolvedValueOnce({ done: false, value: reconnectStatus })
        .mockResolvedValueOnce({ done: true, value: undefined });

      await Connection.connect();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Reconnected to NATS'));
    });

    it('should handle reconnecting event', async () => {
      const reconnectingStatus = { type: 'reconnecting' };
      statusIterator.next = jest
        .fn()
        .mockResolvedValueOnce({ done: false, value: reconnectingStatus })
        .mockResolvedValueOnce({ done: true, value: undefined });

      await Connection.connect();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Reconnecting to NATS'));
    });

    it('should handle error event', async () => {
      const errorData = new Error('Connection error');
      const errorStatus = { type: 'error', data: errorData };
      statusIterator.next = jest
        .fn()
        .mockResolvedValueOnce({ done: false, value: errorStatus })
        .mockResolvedValueOnce({ done: true, value: undefined });

      await Connection.connect();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockLogger.error).toHaveBeenCalledWith('NATS connection error', {
        error: errorData,
      });
    });

    it('should not setup handlers if connection is null', () => {
      Connection.connection = null;
      (Connection as any).setupEventHandlers();
      // Should not throw
    });
  });

  describe('disconnect', () => {
    beforeEach(async () => {
      await Connection.connect();
    });

    it('should drain and close the connection', async () => {
      await Connection.disconnect();

      expect(mockConnection.drain).toHaveBeenCalled();
      expect(mockConnection.close).toHaveBeenCalled();
    });

    it('should set connection and jetstream to null', async () => {
      await Connection.disconnect();

      expect(Connection.connection).toBeNull();
      expect(Connection.jetstream).toBeNull();
    });

    it('should log disconnection', async () => {
      await Connection.disconnect();

      expect(mockLogger.info).toHaveBeenCalledWith('Closing NATS connection...');
      expect(mockLogger.info).toHaveBeenCalledWith('NATS connection closed');
    });

    it('should handle disconnect when not connected', async () => {
      Connection.connection = null;
      await Connection.disconnect();
      // Should not throw
      expect(mockConnection.drain).not.toHaveBeenCalled();
    });

    it('should drain before closing', async () => {
      const callOrder: string[] = [];
      (mockConnection.drain as jest.Mock).mockImplementation(() => {
        callOrder.push('drain');
        return Promise.resolve();
      });
      (mockConnection.close as jest.Mock).mockImplementation(() => {
        callOrder.push('close');
        return Promise.resolve();
      });

      await Connection.disconnect();

      expect(callOrder).toEqual(['drain', 'close']);
    });
  });

  describe('ensureConnection', () => {
    it('should connect if connection is null', async () => {
      Connection.connection = null;
      await Connection.ensureConnection();
      expect(Connection.connection).toBe(mockConnection);
    });

    it('should connect if connection is closed', async () => {
      await Connection.connect();
      (mockConnection.isClosed as jest.Mock).mockReturnValue(true);

      // Reset the connection to allow reconnecting
      Connection.connection = null;
      Connection.jetstream = null;
      jest.clearAllMocks();

      await Connection.ensureConnection();
      expect(connect).toHaveBeenCalled();
    });

    it('should not connect if already connected and open', async () => {
      await Connection.connect();
      jest.clearAllMocks();

      await Connection.ensureConnection();
      expect(connect).not.toHaveBeenCalled();
    });
  });

  describe('getJetStream', () => {
    it('should return jetstream client when initialized', async () => {
      await Connection.connect();
      const js = Connection.getJetStream();
      expect(js).toBe(mockJetstream);
    });

    it('should throw error when jetstream not initialized', () => {
      Connection.jetstream = null;
      expect(() => Connection.getJetStream()).toThrow(
        'JetStream not initialized. Call connect() first.'
      );
    });
  });

  describe('getConnection', () => {
    it('should return connection when initialized', async () => {
      await Connection.connect();
      const conn = Connection.getConnection();
      expect(conn).toBe(mockConnection);
    });

    it('should throw error when connection not initialized', () => {
      Connection.connection = null;
      expect(() => Connection.getConnection()).toThrow(
        'Connection not initialized. Call connect() first.'
      );
    });
  });

  describe('singleton pattern', () => {
    it('should export a singleton instance', () => {
      const Connection1 = require('../../core/connection').default;
      const Connection2 = require('../../core/connection').default;
      expect(Connection1).toBe(Connection2);
    });
  });
});
