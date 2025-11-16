import Connection from '../core/connection';
import Config from '../core/config';

export interface HealthStatus {
  healthy: boolean;
  checks: {
    nats: {
      connected: boolean;
      servers?: number;
      lastError?: string;
    };
    jetstream: {
      available: boolean;
      lastError?: string;
    };
  };
  timestamp: string;
}

export class HealthCheck {
  private connection: Connection;
  private config: Config;

  constructor() {
    this.connection = Connection.getInstance();
    this.config = Config.getInstance();
  }

  async check(): Promise<HealthStatus> {
    const natsCheck = await this.checkNatsConnection();
    const jetstreamCheck = await this.checkJetStream();

    const healthy = natsCheck.connected && jetstreamCheck.available;

    return {
      healthy,
      checks: {
        nats: natsCheck,
        jetstream: jetstreamCheck,
      },
      timestamp: new Date().toISOString(),
    };
  }

  private async checkNatsConnection(): Promise<{
    connected: boolean;
    servers?: number;
    lastError?: string;
  }> {
    try {
      const conn = this.connection['connection'];
      if (!conn) {
        return {
          connected: false,
          lastError: 'No connection established',
        };
      }

      const stats = conn.stats();
      return {
        connected: !conn.isClosed(),
        servers: conn.getServer()?.length || 0,
      };
    } catch (error) {
      return {
        connected: false,
        lastError: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkJetStream(): Promise<{
    available: boolean;
    lastError?: string;
  }> {
    try {
      const js = this.connection.getJetStream();
      if (!js) {
        return {
          available: false,
          lastError: 'JetStream not initialized',
        };
      }

      // Try to get stream info to verify JetStream is available
      const jsm = await this.connection['connection']?.jetstreamManager();
      if (!jsm) {
        return {
          available: false,
          lastError: 'JetStream manager not available',
        };
      }

      return {
        available: true,
      };
    } catch (error) {
      return {
        available: false,
        lastError: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async checkConsumerLag(streamName?: string): Promise<{
    stream: string;
    consumers: Array<{
      name: string;
      pending: number;
      delivered: number;
      ackPending: number;
    }>;
  }> {
    const stream = streamName || this.config.streamName;

    try {
      const jsm = await this.connection['connection']?.jetstreamManager();
      if (!jsm) {
        throw new Error('JetStream manager not available');
      }

      const consumers = await jsm.consumers.list(stream).next();
      const consumerStats = [];

      for (const consumer of consumers) {
        const info = await jsm.consumers.info(stream, consumer.name);
        consumerStats.push({
          name: consumer.name,
          pending: info.num_pending,
          delivered: info.delivered.stream_seq,
          ackPending: info.num_ack_pending,
        });
      }

      return {
        stream,
        consumers: consumerStats,
      };
    } catch (error) {
      this.config.logger.error('Failed to check consumer lag', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}

export default new HealthCheck();
