import Config from '../core/config';

describe('Config', () => {
  beforeEach(() => {
    // Reset singleton instance before each test
    (Config as any).instance = null;
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = Config.getInstance();
      const instance2 = Config.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should initialize with default values', () => {
      const config = Config.getInstance();
      expect(config.natsUrls).toBe('nats://localhost:4222');
      expect(config.env).toBe('development');
      expect(config.appName).toBe('app');
      expect(config.concurrency).toBe(5);
      expect(config.maxDeliver).toBe(3);
      expect(config.ackWait).toBe('30s');
      expect(config.backoff).toEqual(['1s', '5s', '15s']);
      expect(config.useDlq).toBe(true);
    });
  });

  describe('configure', () => {
    it('should update configuration values', () => {
      const config = Config.getInstance();

      config.configure({
        natsUrls: 'nats://custom:4222',
        env: 'production',
        appName: 'my-app',
        concurrency: 10,
        maxDeliver: 5,
        ackWait: '60s',
        backoff: ['2s', '10s', '30s'],
        useDlq: false,
      });

      expect(config.natsUrls).toBe('nats://custom:4222');
      expect(config.env).toBe('production');
      expect(config.appName).toBe('my-app');
      expect(config.concurrency).toBe(10);
      expect(config.maxDeliver).toBe(5);
      expect(config.ackWait).toBe('60s');
      expect(config.backoff).toEqual(['2s', '10s', '30s']);
      expect(config.useDlq).toBe(false);
    });

    it('should allow partial configuration updates', () => {
      const config = Config.getInstance();

      config.configure({
        appName: 'test-app',
        concurrency: 20,
      });

      expect(config.appName).toBe('test-app');
      expect(config.concurrency).toBe(20);
      expect(config.natsUrls).toBe('nats://localhost:4222'); // unchanged
    });

    it('should accept array of NATS URLs', () => {
      const config = Config.getInstance();
      const urls = ['nats://server1:4222', 'nats://server2:4222'];

      config.configure({ natsUrls: urls });

      expect(config.natsUrls).toEqual(urls);
    });
  });

  describe('streamName', () => {
    it('should return stream name based on env', () => {
      const config = Config.getInstance();
      config.configure({ env: 'production' });
      expect(config.streamName).toBe('production-events-stream');
    });

    it('should handle different environments', () => {
      const config = Config.getInstance();

      config.configure({ env: 'staging' });
      expect(config.streamName).toBe('staging-events-stream');

      config.configure({ env: 'development' });
      expect(config.streamName).toBe('development-events-stream');
    });
  });

  describe('dlqSubject', () => {
    it('should return DLQ subject based on env', () => {
      const config = Config.getInstance();
      config.configure({ env: 'production' });
      expect(config.dlqSubject).toBe('production.events.dlq');
    });
  });

  describe('logger', () => {
    it('should use custom logger when provided', () => {
      const customLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };

      const config = Config.getInstance();
      config.configure({ logger: customLogger });

      expect(config.logger).toBe(customLogger);
    });

    it('should use default console logger when not provided', () => {
      const config = Config.getInstance();
      expect(config.logger).toBeDefined();
      expect(config.logger.info).toBeDefined();
      expect(config.logger.error).toBeDefined();
    });
  });
});
