import { NatsPubsubConfig, Logger } from '../types';
import { Consumer, Retry, Timeouts, DLQ } from './constants';
import { ConfigPresets, PresetName } from './config-presets';

/**
 * Configuration validation error
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

class Config {
  private config: NatsPubsubConfig;
  private preset?: PresetName;

  constructor() {
    this.config = {
      natsUrls: 'nats://localhost:4222',
      env: process.env.NODE_ENV || 'development',
      appName: process.env.APP_NAME || 'app',
      concurrency: Consumer.DEFAULT_CONCURRENCY,
      maxDeliver: Retry.MAX_ATTEMPTS,
      ackWait: Timeouts.ACK_WAIT_DEFAULT,
      backoff: [...Retry.DEFAULT_BACKOFF],
      useOutbox: false,
      useInbox: false,
      useDlq: true,
      perMessageConcurrency: Consumer.DEFAULT_CONCURRENCY,
      subscriberTimeoutMs: Timeouts.PROCESSING_TIMEOUT,
      dlqMaxAttempts: DLQ.MAX_ATTEMPTS,
    };
  }

  public configure(options: Partial<NatsPubsubConfig>): void {
    this.config = { ...this.config, ...options };
    this.validate();
  }

  /**
   * Configure with a preset
   *
   * @param preset - Preset name (development, production, testing)
   * @param overrides - Optional overrides to apply after preset
   */
  public configureWithPreset(preset: PresetName, overrides?: Partial<NatsPubsubConfig>): void {
    this.preset = preset;
    const presetConfig = ConfigPresets.apply(this.config, preset);
    this.config = { ...this.config, ...presetConfig, ...overrides } as NatsPubsubConfig;
    this.validate();
  }

  /**
   * Get the current preset name
   */
  public getPreset(): PresetName | undefined {
    return this.preset;
  }

  public get(): NatsPubsubConfig {
    return this.config;
  }

  public get streamName(): string {
    return this.config.streamName || `${this.config.env}-events-stream`;
  }

  /**
   * DLQ subject for failed messages
   */
  public get dlqSubject(): string {
    return this.config.dlqSubject || `${this.config.env}.${this.config.appName}.dlq`;
  }

  /**
   * Build event subject
   * Format: {env}.{app_name}.{domain}.{resource}.{action}
   *
   * @param domain - Business domain
   * @param resource - Resource type
   * @param action - Event action
   * @returns NATS subject string
   */
  public eventSubject(domain: string, resource: string, action: string): string {
    return `${this.config.env}.${this.config.appName}.${domain}.${resource}.${action}`;
  }

  public get logger(): Logger {
    if (this.config.logger) {
      return this.config.logger;
    }
    // Default console logger
    return {
      debug: (message: string, meta?: Record<string, unknown>) => {
        if (process.env.NODE_ENV !== 'production') {
          console.debug(message, meta || '');
        }
      },
      info: (message: string, meta?: Record<string, unknown>) => console.info(message, meta || ''),
      warn: (message: string, meta?: Record<string, unknown>) => console.warn(message, meta || ''),
      error: (message: string, meta?: Record<string, unknown>) =>
        console.error(message, meta || ''),
    };
  }

  /**
   * Validate configuration values
   * Throws ConfigurationError if invalid
   */
  public validate(): void {
    this.validateRequiredFields();
    this.validateNumericRanges();
    this.validateUrls();
  }

  /**
   * Validate required configuration fields
   */
  private validateRequiredFields(): void {
    if (!this.config.appName || this.config.appName.trim() === '') {
      throw new ConfigurationError('appName cannot be blank');
    }

    if (!this.config.env || this.config.env.trim() === '') {
      throw new ConfigurationError('env cannot be blank');
    }

    if (!this.config.natsUrls || this.config.natsUrls.length === 0) {
      throw new ConfigurationError('natsUrls cannot be empty');
    }
  }

  /**
   * Validate numeric configuration values are within acceptable ranges
   */
  private validateNumericRanges(): void {
    if (this.config.concurrency !== undefined && this.config.concurrency <= 0) {
      throw new ConfigurationError('concurrency must be positive');
    }

    // Validate concurrency bounds
    if (this.config.concurrency !== undefined) {
      if (this.config.concurrency < Consumer.MIN_CONCURRENCY) {
        throw new ConfigurationError(
          `concurrency must be at least ${Consumer.MIN_CONCURRENCY}, got ${this.config.concurrency}`
        );
      }
      if (this.config.concurrency > Consumer.MAX_CONCURRENCY) {
        throw new ConfigurationError(
          `concurrency cannot exceed ${Consumer.MAX_CONCURRENCY}, got ${this.config.concurrency}`
        );
      }
    }

    if (this.config.maxDeliver !== undefined && this.config.maxDeliver <= 0) {
      throw new ConfigurationError('maxDeliver must be positive');
    }

    if (this.config.dlqMaxAttempts !== undefined && this.config.dlqMaxAttempts <= 0) {
      throw new ConfigurationError('dlqMaxAttempts must be positive');
    }

    if (this.config.ackWait !== undefined && this.config.ackWait <= 0) {
      throw new ConfigurationError('ackWait must be positive');
    }

    if (this.config.perMessageConcurrency !== undefined && this.config.perMessageConcurrency <= 0) {
      throw new ConfigurationError('perMessageConcurrency must be positive');
    }

    if (this.config.subscriberTimeoutMs !== undefined && this.config.subscriberTimeoutMs < 0) {
      throw new ConfigurationError('subscriberTimeoutMs must be non-negative');
    }

    if (this.config.backoff) {
      if (!Array.isArray(this.config.backoff)) {
        throw new ConfigurationError('backoff must be an array');
      }

      if (this.config.backoff.some((ms) => ms <= 0)) {
        throw new ConfigurationError('backoff values must be positive');
      }
    }
  }

  /**
   * Validate NATS URLs format
   */
  private validateUrls(): void {
    const urls = Array.isArray(this.config.natsUrls)
      ? this.config.natsUrls
      : [this.config.natsUrls];

    for (const url of urls) {
      if (!/^nats:\/\//i.test(url)) {
        throw new ConfigurationError(`Invalid NATS URL: ${url}`);
      }
    }
  }
}

export default new Config();
