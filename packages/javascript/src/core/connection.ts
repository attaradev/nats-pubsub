import { connect, NatsConnection, JetStreamClient } from 'nats';
import { ConnectionManager } from '../types';
import config from './config';

class Connection implements ConnectionManager {
  public connection: NatsConnection | null = null;
  public jetstream: JetStreamClient | null = null;
  private connecting: Promise<void> | null = null;

  async connect(): Promise<void> {
    if (this.connecting) {
      return this.connecting;
    }

    if (this.connection) {
      return;
    }

    this.connecting = this._connect();
    await this.connecting;
    this.connecting = null;
  }

  private async _connect(): Promise<void> {
    const cfg = config.get();
    const logger = config.logger;

    try {
      logger.info('Connecting to NATS...', { urls: cfg.natsUrls });

      const servers = Array.isArray(cfg.natsUrls) ? cfg.natsUrls : [cfg.natsUrls];

      this.connection = await connect({
        servers,
        name: cfg.appName,
        maxReconnectAttempts: -1, // Unlimited reconnects
        reconnectTimeWait: 1000, // 1 second
        waitOnFirstConnect: true,
      });

      logger.info('Connected to NATS successfully');

      this.jetstream = this.connection.jetstream();
      logger.info('JetStream client initialized');

      // Handle connection events
      this.setupEventHandlers();
    } catch (error) {
      logger.error('Failed to connect to NATS', { error });
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.connection) return;

    const logger = config.logger;

    (async () => {
      for await (const status of this.connection!.status()) {
        switch (status.type) {
          case 'disconnect':
            logger.warn('Disconnected from NATS');
            break;
          case 'reconnect':
            logger.info('Reconnected to NATS');
            break;
          case 'reconnecting':
            logger.info('Reconnecting to NATS...');
            break;
          case 'error':
            logger.error('NATS connection error', { error: status.data });
            break;
        }
      }
    })();
  }

  async disconnect(): Promise<void> {
    const logger = config.logger;

    if (this.connection) {
      logger.info('Closing NATS connection...');
      await this.connection.drain();
      await this.connection.close();
      this.connection = null;
      this.jetstream = null;
      logger.info('NATS connection closed');
    }
  }

  async ensureConnection(): Promise<void> {
    if (!this.connection || this.connection.isClosed()) {
      await this.connect();
    }
  }

  getJetStream(): JetStreamClient {
    if (!this.jetstream) {
      throw new Error('JetStream not initialized. Call connect() first.');
    }
    return this.jetstream;
  }

  getConnection(): NatsConnection {
    if (!this.connection) {
      throw new Error('Connection not initialized. Call connect() first.');
    }
    return this.connection;
  }
}

export default new Connection();
