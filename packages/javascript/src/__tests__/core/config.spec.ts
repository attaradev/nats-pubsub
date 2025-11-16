import Config from '../../core/config';

describe('Config', () => {
  // Reset config between tests by clearing its configuration
  beforeEach(() => {
    // Reset to default configuration
    Config.configure({
      natsUrls: 'nats://localhost:4222',
      env: process.env.NODE_ENV || 'development',
      appName: process.env.APP_NAME || 'app',
      concurrency: 10,
      maxDeliver: 5,
      ackWait: 30000,
      backoff: [1000, 5000, 15000, 30000, 60000],
      useOutbox: false,
      useInbox: false,
      useDlq: true,
      perMessageConcurrency: 5,
      subscriberTimeoutMs: 30000,
      dlqMaxAttempts: 3,
    });
  });

  describe('default configuration', () => {
    it('should have default natsUrls', () => {
      const config = Config.get();
      expect(config.natsUrls).toBe('nats://localhost:4222');
    });

    it('should have default env', () => {
      const config = Config.get();
      expect(config.env).toBe(process.env.NODE_ENV || 'development');
    });

    it('should have default appName', () => {
      const config = Config.get();
      expect(config.appName).toBe(process.env.APP_NAME || 'app');
    });

    it('should have default concurrency', () => {
      const config = Config.get();
      expect(config.concurrency).toBe(10);
    });

    it('should have default maxDeliver', () => {
      const config = Config.get();
      expect(config.maxDeliver).toBe(5);
    });

    it('should have default ackWait', () => {
      const config = Config.get();
      expect(config.ackWait).toBe(30000);
    });

    it('should have default backoff', () => {
      const config = Config.get();
      expect(config.backoff).toEqual([1000, 5000, 15000, 30000, 60000]);
    });

    it('should have useOutbox set to false', () => {
      const config = Config.get();
      expect(config.useOutbox).toBe(false);
    });

    it('should have useInbox set to false', () => {
      const config = Config.get();
      expect(config.useInbox).toBe(false);
    });

    it('should have useDlq set to true', () => {
      const config = Config.get();
      expect(config.useDlq).toBe(true);
    });

    it('should have default perMessageConcurrency', () => {
      const config = Config.get();
      expect(config.perMessageConcurrency).toBe(5);
    });

    it('should have default subscriberTimeoutMs', () => {
      const config = Config.get();
      expect(config.subscriberTimeoutMs).toBe(30000);
    });

    it('should have default dlqMaxAttempts', () => {
      const config = Config.get();
      expect(config.dlqMaxAttempts).toBe(3);
    });
  });

  describe('configure', () => {
    it('should allow configuring natsUrls', () => {
      Config.configure({ natsUrls: 'nats://custom:4222' });
      expect(Config.get().natsUrls).toBe('nats://custom:4222');
    });

    it('should allow configuring env', () => {
      Config.configure({ env: 'production' });
      expect(Config.get().env).toBe('production');
    });

    it('should allow configuring appName', () => {
      Config.configure({ appName: 'my-service' });
      expect(Config.get().appName).toBe('my-service');
    });

    it('should allow configuring concurrency', () => {
      Config.configure({ concurrency: 20 });
      expect(Config.get().concurrency).toBe(20);
    });

    it('should allow configuring maxDeliver', () => {
      Config.configure({ maxDeliver: 10 });
      expect(Config.get().maxDeliver).toBe(10);
    });

    it('should allow configuring ackWait', () => {
      Config.configure({ ackWait: 60000 });
      expect(Config.get().ackWait).toBe(60000);
    });

    it('should allow configuring backoff', () => {
      const customBackoff = [2000, 4000, 8000];
      Config.configure({ backoff: customBackoff });
      expect(Config.get().backoff).toEqual(customBackoff);
    });

    it('should allow configuring useOutbox', () => {
      Config.configure({ useOutbox: true });
      expect(Config.get().useOutbox).toBe(true);
    });

    it('should allow configuring useInbox', () => {
      Config.configure({ useInbox: true });
      expect(Config.get().useInbox).toBe(true);
    });

    it('should allow configuring useDlq', () => {
      Config.configure({ useDlq: false });
      expect(Config.get().useDlq).toBe(false);
    });

    it('should merge configurations', () => {
      Config.configure({ natsUrls: 'nats://server1:4222', concurrency: 15 });
      const config = Config.get();
      expect(config.natsUrls).toBe('nats://server1:4222');
      expect(config.concurrency).toBe(15);
      expect(config.appName).toBe(process.env.APP_NAME || 'app'); // unchanged
    });

    it('should allow multiple configuration updates', () => {
      Config.configure({ concurrency: 15 });
      Config.configure({ maxDeliver: 8 });
      const config = Config.get();
      expect(config.concurrency).toBe(15);
      expect(config.maxDeliver).toBe(8);
    });

    it('should preserve previously configured values', () => {
      Config.configure({ natsUrls: 'nats://server1:4222', concurrency: 15 });
      Config.configure({ env: 'staging' });
      const config = Config.get();
      expect(config.natsUrls).toBe('nats://server1:4222');
      expect(config.concurrency).toBe(15);
      expect(config.env).toBe('staging');
    });
  });

  describe('get', () => {
    it('should return the current configuration', () => {
      const config = Config.get();
      expect(config).toBeDefined();
      expect(config.natsUrls).toBeDefined();
      expect(config.env).toBeDefined();
    });

    it('should return updated configuration after configure', () => {
      Config.configure({ concurrency: 25 });
      const config = Config.get();
      expect(config.concurrency).toBe(25);
    });
  });

  describe('streamName', () => {
    it('should return default stream name based on env', () => {
      Config.configure({ env: 'test' });
      expect(Config.streamName).toBe('test-events-stream');
    });

    it('should return custom stream name if configured', () => {
      Config.configure({ streamName: 'custom-stream' });
      expect(Config.streamName).toBe('custom-stream');
    });

    it('should prefer custom stream name over generated one', () => {
      Config.configure({ env: 'production', streamName: 'my-custom-stream' });
      expect(Config.streamName).toBe('my-custom-stream');
    });

    it('should generate stream name for different environments', () => {
      Config.configure({ env: 'staging', streamName: undefined });
      expect(Config.streamName).toBe('staging-events-stream');

      Config.configure({ env: 'production', streamName: undefined });
      expect(Config.streamName).toBe('production-events-stream');
    });
  });

  describe('dlqSubject', () => {
    it('should return default DLQ subject based on env', () => {
      Config.configure({ env: 'test', appName: 'app' });
      expect(Config.dlqSubject).toBe('test.app.dlq');
    });

    it('should return custom DLQ subject if configured', () => {
      Config.configure({ dlqSubject: 'custom.dlq.subject' });
      expect(Config.dlqSubject).toBe('custom.dlq.subject');
    });

    it('should prefer custom DLQ subject over generated one', () => {
      Config.configure({ env: 'production', dlqSubject: 'prod.dead.letters' });
      expect(Config.dlqSubject).toBe('prod.dead.letters');
    });

    it('should generate DLQ subject for different environments', () => {
      Config.configure({ env: 'staging', appName: 'app', dlqSubject: undefined });
      expect(Config.dlqSubject).toBe('staging.app.dlq');

      Config.configure({ env: 'production', appName: 'app', dlqSubject: undefined });
      expect(Config.dlqSubject).toBe('production.app.dlq');
    });
  });

  describe('logger', () => {
    it('should return default console logger when no custom logger configured', () => {
      const logger = Config.logger;
      expect(logger).toBeDefined();
      expect(logger.debug).toBeInstanceOf(Function);
      expect(logger.info).toBeInstanceOf(Function);
      expect(logger.warn).toBeInstanceOf(Function);
      expect(logger.error).toBeInstanceOf(Function);
    });

    it('should return custom logger when configured', () => {
      const customLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      Config.configure({ logger: customLogger });
      expect(Config.logger).toBe(customLogger);
    });

    describe('default logger behavior', () => {
      let consoleSpy: {
        debug: jest.SpyInstance;
        info: jest.SpyInstance;
        warn: jest.SpyInstance;
        error: jest.SpyInstance;
      };

      beforeEach(() => {
        consoleSpy = {
          debug: jest.spyOn(console, 'debug').mockImplementation(),
          info: jest.spyOn(console, 'info').mockImplementation(),
          warn: jest.spyOn(console, 'warn').mockImplementation(),
          error: jest.spyOn(console, 'error').mockImplementation(),
        };
        Config.configure({ logger: undefined });
      });

      afterEach(() => {
        Object.values(consoleSpy).forEach((spy) => spy.mockRestore());
      });

      it('should call console.info for info logs', () => {
        const logger = Config.logger;
        logger.info('test message', { key: 'value' });
        expect(consoleSpy.info).toHaveBeenCalledWith('test message', { key: 'value' });
      });

      it('should call console.warn for warn logs', () => {
        const logger = Config.logger;
        logger.warn('warning message');
        expect(consoleSpy.warn).toHaveBeenCalledWith('warning message', '');
      });

      it('should call console.error for error logs', () => {
        const logger = Config.logger;
        logger.error('error message', { error: 'details' });
        expect(consoleSpy.error).toHaveBeenCalledWith('error message', { error: 'details' });
      });

      it('should conditionally call console.debug in non-production', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';

        const logger = Config.logger;
        logger.debug('debug message');

        if (process.env.NODE_ENV !== 'production') {
          expect(consoleSpy.debug).toHaveBeenCalled();
        }

        process.env.NODE_ENV = originalEnv;
      });
    });
  });
});
