import { NatsPubsubConfig, Logger } from '../types';

class Config {
  private config: NatsPubsubConfig;

  constructor() {
    this.config = {
      natsUrls: 'nats://localhost:4222',
      env: process.env.NODE_ENV || 'development',
      appName: process.env.APP_NAME || 'app',
      concurrency: 10,
      maxDeliver: 5,
      ackWait: 30000, // 30 seconds in ms
      backoff: [1000, 5000, 15000, 30000, 60000], // in ms
      useOutbox: false,
      useInbox: false,
      useDlq: true,
    };
  }

  public configure(options: Partial<NatsPubsubConfig>): void {
    this.config = { ...this.config, ...options };
  }

  public get(): NatsPubsubConfig {
    return this.config;
  }

  public get streamName(): string {
    return this.config.streamName || `${this.config.env}-events-stream`;
  }

  public get dlqSubject(): string {
    return this.config.dlqSubject || `${this.config.env}.events.dlq`;
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
      info: (message: string, meta?: Record<string, unknown>) =>
        console.info(message, meta || ''),
      warn: (message: string, meta?: Record<string, unknown>) =>
        console.warn(message, meta || ''),
      error: (message: string, meta?: Record<string, unknown>) =>
        console.error(message, meta || ''),
    };
  }
}

export default new Config();
