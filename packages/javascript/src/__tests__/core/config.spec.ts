import Config, { ConfigurationError } from '../../core/config';

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

  describe('validation', () => {
    describe('validateRequiredFields', () => {
      it('should throw ConfigurationError when appName is blank', () => {
        expect(() => {
          Config.configure({ appName: '' });
        }).toThrow(ConfigurationError);
        expect(() => {
          Config.configure({ appName: '' });
        }).toThrow('appName cannot be blank');
      });

      it('should throw ConfigurationError when appName is only whitespace', () => {
        expect(() => {
          Config.configure({ appName: '   ' });
        }).toThrow(ConfigurationError);
        expect(() => {
          Config.configure({ appName: '   ' });
        }).toThrow('appName cannot be blank');
      });

      it('should throw ConfigurationError when env is blank', () => {
        expect(() => {
          Config.configure({ env: '' });
        }).toThrow(ConfigurationError);
        expect(() => {
          Config.configure({ env: '' });
        }).toThrow('env cannot be blank');
      });

      it('should throw ConfigurationError when env is only whitespace', () => {
        expect(() => {
          Config.configure({ env: '   ' });
        }).toThrow(ConfigurationError);
        expect(() => {
          Config.configure({ env: '   ' });
        }).toThrow('env cannot be blank');
      });

      it('should throw ConfigurationError when natsUrls is empty string', () => {
        expect(() => {
          Config.configure({ natsUrls: '' });
        }).toThrow(ConfigurationError);
        expect(() => {
          Config.configure({ natsUrls: '' });
        }).toThrow('natsUrls cannot be empty');
      });

      it('should throw ConfigurationError when natsUrls is empty array', () => {
        expect(() => {
          Config.configure({ natsUrls: [] });
        }).toThrow(ConfigurationError);
        expect(() => {
          Config.configure({ natsUrls: [] });
        }).toThrow('natsUrls cannot be empty');
      });

      it('should accept valid appName', () => {
        expect(() => {
          Config.configure({ appName: 'my-app' });
        }).not.toThrow();
      });

      it('should accept valid env', () => {
        expect(() => {
          Config.configure({ env: 'production' });
        }).not.toThrow();
      });

      it('should accept valid natsUrls string', () => {
        expect(() => {
          Config.configure({ natsUrls: 'nats://localhost:4222' });
        }).not.toThrow();
      });

      it('should accept valid natsUrls array', () => {
        expect(() => {
          Config.configure({ natsUrls: ['nats://server1:4222', 'nats://server2:4222'] });
        }).not.toThrow();
      });
    });

    describe('validateNumericRanges', () => {
      it('should throw ConfigurationError when concurrency is zero', () => {
        expect(() => {
          Config.configure({ concurrency: 0 });
        }).toThrow(ConfigurationError);
        expect(() => {
          Config.configure({ concurrency: 0 });
        }).toThrow('concurrency must be positive');
      });

      it('should throw ConfigurationError when concurrency is negative', () => {
        expect(() => {
          Config.configure({ concurrency: -1 });
        }).toThrow(ConfigurationError);
        expect(() => {
          Config.configure({ concurrency: -1 });
        }).toThrow('concurrency must be positive');
      });

      it('should throw ConfigurationError when maxDeliver is zero', () => {
        expect(() => {
          Config.configure({ maxDeliver: 0 });
        }).toThrow(ConfigurationError);
        expect(() => {
          Config.configure({ maxDeliver: 0 });
        }).toThrow('maxDeliver must be positive');
      });

      it('should throw ConfigurationError when maxDeliver is negative', () => {
        expect(() => {
          Config.configure({ maxDeliver: -5 });
        }).toThrow(ConfigurationError);
        expect(() => {
          Config.configure({ maxDeliver: -5 });
        }).toThrow('maxDeliver must be positive');
      });

      it('should throw ConfigurationError when dlqMaxAttempts is zero', () => {
        expect(() => {
          Config.configure({ dlqMaxAttempts: 0 });
        }).toThrow(ConfigurationError);
        expect(() => {
          Config.configure({ dlqMaxAttempts: 0 });
        }).toThrow('dlqMaxAttempts must be positive');
      });

      it('should throw ConfigurationError when dlqMaxAttempts is negative', () => {
        expect(() => {
          Config.configure({ dlqMaxAttempts: -3 });
        }).toThrow(ConfigurationError);
        expect(() => {
          Config.configure({ dlqMaxAttempts: -3 });
        }).toThrow('dlqMaxAttempts must be positive');
      });

      it('should throw ConfigurationError when ackWait is zero', () => {
        expect(() => {
          Config.configure({ ackWait: 0 });
        }).toThrow(ConfigurationError);
        expect(() => {
          Config.configure({ ackWait: 0 });
        }).toThrow('ackWait must be positive');
      });

      it('should throw ConfigurationError when ackWait is negative', () => {
        expect(() => {
          Config.configure({ ackWait: -30000 });
        }).toThrow(ConfigurationError);
        expect(() => {
          Config.configure({ ackWait: -30000 });
        }).toThrow('ackWait must be positive');
      });

      it('should throw ConfigurationError when perMessageConcurrency is zero', () => {
        expect(() => {
          Config.configure({ perMessageConcurrency: 0 });
        }).toThrow(ConfigurationError);
        expect(() => {
          Config.configure({ perMessageConcurrency: 0 });
        }).toThrow('perMessageConcurrency must be positive');
      });

      it('should throw ConfigurationError when perMessageConcurrency is negative', () => {
        expect(() => {
          Config.configure({ perMessageConcurrency: -2 });
        }).toThrow(ConfigurationError);
        expect(() => {
          Config.configure({ perMessageConcurrency: -2 });
        }).toThrow('perMessageConcurrency must be positive');
      });

      it('should throw ConfigurationError when subscriberTimeoutMs is negative', () => {
        expect(() => {
          Config.configure({ subscriberTimeoutMs: -1000 });
        }).toThrow(ConfigurationError);
        expect(() => {
          Config.configure({ subscriberTimeoutMs: -1000 });
        }).toThrow('subscriberTimeoutMs must be non-negative');
      });

      it('should accept zero for subscriberTimeoutMs (no timeout)', () => {
        expect(() => {
          Config.configure({ subscriberTimeoutMs: 0 });
        }).not.toThrow();
      });

      it('should throw ConfigurationError when backoff is not an array', () => {
        expect(() => {
          Config.configure({ backoff: 'invalid' as any });
        }).toThrow(ConfigurationError);
        expect(() => {
          Config.configure({ backoff: 'invalid' as any });
        }).toThrow('backoff must be an array');
      });

      it('should throw ConfigurationError when backoff contains zero', () => {
        expect(() => {
          Config.configure({ backoff: [1000, 0, 5000] });
        }).toThrow(ConfigurationError);
        expect(() => {
          Config.configure({ backoff: [1000, 0, 5000] });
        }).toThrow('backoff values must be positive');
      });

      it('should throw ConfigurationError when backoff contains negative values', () => {
        expect(() => {
          Config.configure({ backoff: [1000, -5000, 15000] });
        }).toThrow(ConfigurationError);
        expect(() => {
          Config.configure({ backoff: [1000, -5000, 15000] });
        }).toThrow('backoff values must be positive');
      });

      it('should accept valid positive numeric values', () => {
        expect(() => {
          Config.configure({
            concurrency: 20,
            maxDeliver: 10,
            dlqMaxAttempts: 5,
            ackWait: 60000,
            perMessageConcurrency: 3,
            subscriberTimeoutMs: 45000,
            backoff: [2000, 4000, 8000],
          });
        }).not.toThrow();
      });
    });

    describe('validateUrls', () => {
      it('should throw ConfigurationError for URL without nats:// protocol', () => {
        expect(() => {
          Config.configure({ natsUrls: 'localhost:4222' });
        }).toThrow(ConfigurationError);
        expect(() => {
          Config.configure({ natsUrls: 'localhost:4222' });
        }).toThrow('Invalid NATS URL: localhost:4222');
      });

      it('should throw ConfigurationError for http:// URL', () => {
        expect(() => {
          Config.configure({ natsUrls: 'http://localhost:4222' });
        }).toThrow(ConfigurationError);
        expect(() => {
          Config.configure({ natsUrls: 'http://localhost:4222' });
        }).toThrow('Invalid NATS URL: http://localhost:4222');
      });

      it('should throw ConfigurationError for https:// URL', () => {
        expect(() => {
          Config.configure({ natsUrls: 'https://localhost:4222' });
        }).toThrow(ConfigurationError);
        expect(() => {
          Config.configure({ natsUrls: 'https://localhost:4222' });
        }).toThrow('Invalid NATS URL: https://localhost:4222');
      });

      it('should throw ConfigurationError for invalid URL in array', () => {
        expect(() => {
          Config.configure({
            natsUrls: ['nats://server1:4222', 'http://server2:4222', 'nats://server3:4222'],
          });
        }).toThrow(ConfigurationError);
        expect(() => {
          Config.configure({
            natsUrls: ['nats://server1:4222', 'http://server2:4222', 'nats://server3:4222'],
          });
        }).toThrow('Invalid NATS URL: http://server2:4222');
      });

      it('should accept valid nats:// URL', () => {
        expect(() => {
          Config.configure({ natsUrls: 'nats://localhost:4222' });
        }).not.toThrow();
      });

      it('should accept valid NATS:// URL (case insensitive)', () => {
        expect(() => {
          Config.configure({ natsUrls: 'NATS://localhost:4222' });
        }).not.toThrow();
      });

      it('should accept valid nats:// URL with username and password', () => {
        expect(() => {
          Config.configure({ natsUrls: 'nats://user:pass@localhost:4222' });
        }).not.toThrow();
      });

      it('should accept multiple valid nats:// URLs', () => {
        expect(() => {
          Config.configure({
            natsUrls: ['nats://server1:4222', 'nats://server2:4222', 'nats://server3:4222'],
          });
        }).not.toThrow();
      });
    });

    describe('validate method', () => {
      it('should be callable directly', () => {
        expect(() => {
          Config.validate();
        }).not.toThrow();
      });

      it('should throw when called after invalid configuration', () => {
        // First configure with valid config
        Config.configure({ appName: 'valid-app' });

        // Manually set invalid config (bypassing validation for test)
        const cfg: any = Config.get();
        cfg.appName = '';

        // Now validate should throw
        expect(() => {
          Config.validate();
        }).toThrow(ConfigurationError);
      });
    });

    describe('ConfigurationError', () => {
      it('should be an instance of Error', () => {
        const error = new ConfigurationError('test error');
        expect(error).toBeInstanceOf(Error);
      });

      it('should have correct name', () => {
        const error = new ConfigurationError('test error');
        expect(error.name).toBe('ConfigurationError');
      });

      it('should have correct message', () => {
        const error = new ConfigurationError('test error message');
        expect(error.message).toBe('test error message');
      });

      it('should maintain prototype chain', () => {
        const error = new ConfigurationError('test error');
        expect(error instanceof ConfigurationError).toBe(true);
      });
    });
  });
});
