/**
 * Prometheus Metrics Module
 *
 * To use this module, install prom-client:
 * npm install prom-client
 *
 * Example usage:
 * import { PrometheusMetrics } from 'nats-pubsub/metrics/prometheus';
 *
 * const metrics = new PrometheusMetrics();
 * metrics.startServer(9090);
 */

export interface MetricsConfig {
  prefix?: string;
  port?: number;
  endpoint?: string;
  labels?: Record<string, string>;
}

interface PromClientCounter {
  inc(labels: Record<string, string>): void;
}

interface PromClientHistogram {
  observe(labels: Record<string, string>, value: number): void;
}

interface PromClientGauge {
  set(value: number): void;
  set(labels: Record<string, string>, value: number): void;
}

interface PromClientRegistry {
  metrics(): Promise<string>;
  setDefaultLabels(labels: Record<string, string>): void;
  contentType: string;
}

interface PromClient {
  Counter: new (config: unknown) => PromClientCounter;
  Histogram: new (config: unknown) => PromClientHistogram;
  Gauge: new (config: unknown) => PromClientGauge;
  Registry: new () => PromClientRegistry;
  collectDefaultMetrics(config: { register: PromClientRegistry }): void;
}

export class PrometheusMetrics {
  private promClient: PromClient;
  private register: PromClientRegistry;
  private metrics: {
    messagesReceived?: PromClientCounter;
    messagesProcessed?: PromClientCounter;
    messagesFailed?: PromClientCounter;
    processingDuration?: PromClientHistogram;
    dlqMessages?: PromClientCounter;
    publishAttempts?: PromClientCounter;
    publishSuccesses?: PromClientCounter;
    publishFailures?: PromClientCounter;
    connectionStatus?: PromClientGauge;
    consumerLag?: PromClientGauge;
  } = {};

  private config: MetricsConfig;
  private server: unknown;

  constructor(config: MetricsConfig = {}) {
    this.config = {
      prefix: config.prefix || 'nats_pubsub_',
      port: config.port || 9090,
      endpoint: config.endpoint || '/metrics',
      labels: config.labels || {},
    };

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.promClient = require('prom-client') as PromClient;
      this.register = new this.promClient.Registry();

      // Add default labels
      this.register.setDefaultLabels(this.config.labels);

      // Collect default metrics (CPU, memory, etc.)
      this.promClient.collectDefaultMetrics({ register: this.register });

      this.initializeMetrics();
    } catch {
      console.warn('prom-client not installed. Install it with: npm install prom-client');
      throw new Error('prom-client is required for PrometheusMetrics');
    }
  }

  private initializeMetrics(): void {
    // Counter: Messages received
    this.metrics.messagesReceived = new this.promClient.Counter({
      name: `${this.config.prefix}messages_received_total`,
      help: 'Total number of messages received',
      labelNames: ['subject', 'domain', 'resource', 'action'],
      registers: [this.register],
    });

    // Counter: Messages processed successfully
    this.metrics.messagesProcessed = new this.promClient.Counter({
      name: `${this.config.prefix}messages_processed_total`,
      help: 'Total number of messages processed successfully',
      labelNames: ['subject', 'domain', 'resource', 'action', 'subscriber'],
      registers: [this.register],
    });

    // Counter: Messages failed
    this.metrics.messagesFailed = new this.promClient.Counter({
      name: `${this.config.prefix}messages_failed_total`,
      help: 'Total number of messages that failed processing',
      labelNames: ['subject', 'domain', 'resource', 'action', 'subscriber', 'error_type'],
      registers: [this.register],
    });

    // Histogram: Processing duration
    this.metrics.processingDuration = new this.promClient.Histogram({
      name: `${this.config.prefix}processing_duration_seconds`,
      help: 'Duration of message processing in seconds',
      labelNames: ['subject', 'domain', 'resource', 'action', 'subscriber'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10],
      registers: [this.register],
    });

    // Counter: DLQ messages
    this.metrics.dlqMessages = new this.promClient.Counter({
      name: `${this.config.prefix}dlq_messages_total`,
      help: 'Total number of messages sent to DLQ',
      labelNames: ['subject', 'reason'],
      registers: [this.register],
    });

    // Counter: Publish attempts
    this.metrics.publishAttempts = new this.promClient.Counter({
      name: `${this.config.prefix}publish_attempts_total`,
      help: 'Total number of publish attempts',
      labelNames: ['subject', 'domain', 'resource', 'action'],
      registers: [this.register],
    });

    // Counter: Publish successes
    this.metrics.publishSuccesses = new this.promClient.Counter({
      name: `${this.config.prefix}publish_successes_total`,
      help: 'Total number of successful publishes',
      labelNames: ['subject', 'domain', 'resource', 'action'],
      registers: [this.register],
    });

    // Counter: Publish failures
    this.metrics.publishFailures = new this.promClient.Counter({
      name: `${this.config.prefix}publish_failures_total`,
      help: 'Total number of failed publishes',
      labelNames: ['subject', 'domain', 'resource', 'action', 'error_type'],
      registers: [this.register],
    });

    // Gauge: Connection status
    this.metrics.connectionStatus = new this.promClient.Gauge({
      name: `${this.config.prefix}connection_status`,
      help: 'NATS connection status (1 = connected, 0 = disconnected)',
      registers: [this.register],
    });

    // Gauge: Consumer lag
    this.metrics.consumerLag = new this.promClient.Gauge({
      name: `${this.config.prefix}consumer_lag`,
      help: 'Number of pending messages per consumer',
      labelNames: ['stream', 'consumer'],
      registers: [this.register],
    });
  }

  // Increment message received counter
  recordMessageReceived(subject: string, domain: string, resource: string, action: string): void {
    this.metrics.messagesReceived?.inc({ subject, domain, resource, action });
  }

  // Increment message processed counter
  recordMessageProcessed(
    subject: string,
    domain: string,
    resource: string,
    action: string,
    subscriber: string
  ): void {
    this.metrics.messagesProcessed?.inc({ subject, domain, resource, action, subscriber });
  }

  // Increment message failed counter
  recordMessageFailed(
    subject: string,
    domain: string,
    resource: string,
    action: string,
    subscriber: string,
    errorType: string
  ): void {
    this.metrics.messagesFailed?.inc({ subject, domain, resource, action, subscriber, error_type: errorType });
  }

  // Record processing duration
  recordProcessingDuration(
    subject: string,
    domain: string,
    resource: string,
    action: string,
    subscriber: string,
    durationSeconds: number
  ): void {
    this.metrics.processingDuration?.observe({ subject, domain, resource, action, subscriber }, durationSeconds);
  }

  // Increment DLQ messages counter
  recordDlqMessage(subject: string, reason: string): void {
    this.metrics.dlqMessages?.inc({ subject, reason });
  }

  // Record publish attempt
  recordPublishAttempt(subject: string, domain: string, resource: string, action: string): void {
    this.metrics.publishAttempts?.inc({ subject, domain, resource, action });
  }

  // Record publish success
  recordPublishSuccess(subject: string, domain: string, resource: string, action: string): void {
    this.metrics.publishSuccesses?.inc({ subject, domain, resource, action });
  }

  // Record publish failure
  recordPublishFailure(
    subject: string,
    domain: string,
    resource: string,
    action: string,
    errorType: string
  ): void {
    this.metrics.publishFailures?.inc({ subject, domain, resource, action, error_type: errorType });
  }

  // Update connection status
  setConnectionStatus(connected: boolean): void {
    this.metrics.connectionStatus?.set(connected ? 1 : 0);
  }

  // Update consumer lag
  setConsumerLag(stream: string, consumer: string, lag: number): void {
    this.metrics.consumerLag?.set({ stream, consumer }, lag);
  }

  // Get metrics as string (for /metrics endpoint)
  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  // Start HTTP server for metrics endpoint
  startServer(port?: number): void {
    const serverPort = port || this.config.port;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const http = require('http') as {
      createServer(callback: (req: { url?: string }, res: {
        setHeader(name: string, value: string): void;
        end(data?: string): void;
        statusCode: number;
      }) => void): { listen(port: number, callback: () => void): void; close(): void };
    };

    this.server = http.createServer(async (req, res) => {
      if (req.url === this.config.endpoint) {
        res.setHeader('Content-Type', this.register.contentType);
        res.end(await this.getMetrics());
      } else if (req.url === '/health') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 'ok' }));
      } else {
        res.statusCode = 404;
        res.end('Not found');
      }
    });

    this.server.listen(serverPort, () => {
      console.log(`Metrics server listening on http://localhost:${serverPort}${this.config.endpoint}`);
    });
  }

  // Stop HTTP server
  stopServer(): void {
    if (this.server && typeof this.server === 'object' && 'close' in this.server) {
      (this.server as { close(): void }).close();
    }
  }
}
