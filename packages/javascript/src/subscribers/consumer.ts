import { AckPolicy, ConsumerConfig, DeliverPolicy, ReplayPolicy } from 'nats';
import { Middleware, Subscriber } from '../types';
import connection from '../core/connection';
import config from '../core/config';
import { toNanos } from '../core/duration';
import { MiddlewareChain } from '../middleware/chain';
import { TopologyManager } from '../topology/topology-manager';
import { DlqHandler } from '../dlq/dlq-handler';
import { Registry } from './registry';
import { MessageProcessor } from './message-processor';

/**
 * Consumer orchestrates message consumption from NATS JetStream
 *
 * This class has been refactored to follow Single Responsibility Principle.
 * It now delegates specific responsibilities to focused modules:
 * - TopologyManager: Stream and DLQ setup
 * - Registry: Subscriber management
 * - MessageProcessor: Message processing logic
 * - DlqHandler: Dead letter queue operations
 *
 * The Consumer class focuses on:
 * - Lifecycle management (start/stop)
 * - Subscription management
 * - Coordinating the specialized modules
 */
export class Consumer {
  private running = false;
  private readonly middlewareChain: MiddlewareChain = new MiddlewareChain();
  private readonly topologyManager: TopologyManager = new TopologyManager();
  private readonly dlqHandler: DlqHandler = new DlqHandler();
  private readonly registry: Registry = new Registry();
  private readonly messageProcessor: MessageProcessor;

  constructor() {
    this.messageProcessor = new MessageProcessor(this.middlewareChain, this.dlqHandler);
  }

  /**
   * Register a subscriber to handle messages
   */
  registerSubscriber(subscriber: Subscriber): void {
    this.registry.register(subscriber);
  }

  /**
   * Add middleware to the processing chain
   */
  use(middleware: Middleware): void {
    this.middlewareChain.add(middleware);
  }

  /**
   * Start consuming messages
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error('Consumer already running');
    }

    await connection.ensureConnection();
    const logger = config.logger;

    this.running = true;
    logger.info('Starting consumer...');

    // Ensure stream topology exists
    const jsm = await connection.getConnection().jetstreamManager();
    await this.topologyManager.ensureTopology(jsm);

    // Start subscriptions for each unique subject
    const subjects = this.registry.getAllSubjects();

    for (const subject of subjects) {
      this.subscribe(subject);
    }

    logger.info('Consumer started', { subjects });
  }

  /**
   * Stop consuming messages
   */
  async stop(): Promise<void> {
    this.running = false;
    const logger = config.logger;
    logger.info('Stopping consumer...');
    await connection.disconnect();
    logger.info('Consumer stopped');
  }

  /**
   * Subscribe to a subject and process messages
   */
  private async subscribe(subject: string): Promise<void> {
    const js = connection.getJetStream();
    const cfg = config.get();
    const streamName = config.streamName;
    const logger = config.logger;

    const durableName = this.buildDurableName(subject);

    const consumerConfig: Partial<ConsumerConfig> = {
      durable_name: durableName,
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.All,
      replay_policy: ReplayPolicy.Instant,
      filter_subject: subject,
      max_deliver: cfg.maxDeliver || 5,
      ack_wait: toNanos(cfg.ackWait || 30000),
      max_ack_pending: cfg.concurrency || 10,
    };

    if (cfg.backoff && cfg.backoff.length > 0) {
      consumerConfig.backoff = cfg.backoff.map((ms) => toNanos(ms));
    }

    try {
      logger.info('Creating consumer subscription', {
        subject,
        durable: durableName,
      });

      const consumer = await js.consumers.get(streamName, durableName);
      const messages = await consumer.consume({
        max_messages: cfg.concurrency || 10,
      });

      logger.info('Consumer subscription created', { subject, durable: durableName });

      // Process messages
      (async () => {
        for await (const msg of messages) {
          if (!this.running) break;

          const subscribers = this.registry.getSubscribers(subject);
          await this.messageProcessor.processMessage(msg, subscribers);
        }
      })();
    } catch (error) {
      logger.error('Failed to create consumer subscription', {
        subject,
        error,
      });
      throw error;
    }
  }

  /**
   * Build durable consumer name from subject
   */
  private buildDurableName(subject: string): string {
    const cfg = config.get();
    // Replace wildcards and dots with underscores
    const sanitized = subject.replace(/[.*>]/g, '_');
    return `${cfg.appName}_${sanitized}`;
  }
}

export default new Consumer();
