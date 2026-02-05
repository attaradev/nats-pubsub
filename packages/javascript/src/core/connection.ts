import {
  connect,
  NatsConnection,
  JetStreamClient,
  ConnectionOptions,
  credsAuthenticator,
} from 'nats';
import { readFileSync } from 'fs';
import { ConnectionManager, NatsAuthConfig, NatsTlsConfig } from '../types';
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

  private static readonly MAX_CONNECT_RETRIES = 5;
  private static readonly INITIAL_RETRY_DELAY_MS = 1000;

  private async _connect(): Promise<void> {
    const cfg = config.get();
    const logger = config.logger;

    const servers = Array.isArray(cfg.natsUrls) ? cfg.natsUrls : [cfg.natsUrls];

    const connectOpts: ConnectionOptions = {
      servers,
      name: cfg.appName,
      maxReconnectAttempts: -1, // Unlimited reconnects
      reconnectTimeWait: 1000, // 1 second
      waitOnFirstConnect: true,
    };

    // Apply authentication options
    if (cfg.auth) {
      Object.assign(connectOpts, this.buildAuthOptions(cfg.auth));
    }

    // Apply TLS options
    if (cfg.tls) {
      connectOpts.tls = this.buildTlsOptions(cfg.tls);
    }

    // Retry initial connection with exponential backoff
    let lastError: unknown;
    for (let attempt = 1; attempt <= Connection.MAX_CONNECT_RETRIES; attempt++) {
      try {
        logger.info('Connecting to NATS...', { urls: cfg.natsUrls, attempt });
        this.connection = await connect(connectOpts);
        logger.info('Connected to NATS successfully');

        this.jetstream = this.connection.jetstream();
        logger.info('JetStream client initialized');

        this.setupEventHandlers();
        return;
      } catch (error) {
        lastError = error;
        if (attempt < Connection.MAX_CONNECT_RETRIES) {
          const delay = Connection.INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          logger.warn('NATS connection attempt failed, retrying...', {
            attempt,
            maxRetries: Connection.MAX_CONNECT_RETRIES,
            nextRetryMs: delay,
            error,
          });
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    logger.error('Failed to connect to NATS after retries', { error: lastError });
    throw lastError;
  }

  private setupEventHandlers(): void {
    if (!this.connection) return;

    const logger = config.logger;

    (async () => {
      try {
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
      } catch (error) {
        logger.error('NATS status monitor failed', { error });
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

  /**
   * Reset connection state without draining. Useful for testing.
   */
  reset(): void {
    this.connection = null;
    this.jetstream = null;
    this.connecting = null;
  }

  /**
   * Build NATS authentication options from config
   */
  private buildAuthOptions(auth: NatsAuthConfig): Partial<ConnectionOptions> {
    switch (auth.type) {
      case 'token':
        if (!auth.token) throw new Error('auth.token is required for token authentication');
        return { token: auth.token };

      case 'user-password':
        if (!auth.user || !auth.pass)
          throw new Error('auth.user and auth.pass are required for user-password authentication');
        return { user: auth.user, pass: auth.pass };

      case 'nkey':
        if (!auth.nkey) throw new Error('auth.nkey is required for nkey authentication');
        return { authenticator: credsAuthenticator(new TextEncoder().encode(auth.nkey)) };

      case 'credentials':
        if (!auth.credentialsPath)
          throw new Error('auth.credentialsPath is required for credentials authentication');
        return { authenticator: credsAuthenticator(readFileSync(auth.credentialsPath)) };

      default:
        throw new Error(`Unknown auth type: ${(auth as NatsAuthConfig).type}`);
    }
  }

  /**
   * Build TLS options from config
   */
  private buildTlsOptions(tls: NatsTlsConfig): ConnectionOptions['tls'] {
    const tlsOpts: Record<string, unknown> = {};

    if (tls.caFile) {
      tlsOpts.ca = readFileSync(tls.caFile);
    }
    if (tls.certFile) {
      tlsOpts.cert = readFileSync(tls.certFile);
    }
    if (tls.keyFile) {
      tlsOpts.key = readFileSync(tls.keyFile);
    }
    if (tls.rejectUnauthorized !== undefined) {
      tlsOpts.rejectUnauthorized = tls.rejectUnauthorized;
    }

    return tlsOpts;
  }
}

export default new Connection();
