import {
  AckPolicy,
  ConsumerConfig,
  DeliverPolicy,
  JetStreamClient,
  JsMsg,
  ReplayPolicy,
} from 'nats';
import { EventMetadata, Subscriber } from '../types';
import connection from '../core/connection';
import config from '../core/config';
import { toNanos } from '../core/duration';
import { MiddlewareChain } from '../middleware/chain';

export class Consumer {
  private subscribers: Map<string, Subscriber[]> = new Map();
  private middlewareChain: MiddlewareChain = new MiddlewareChain();
  private running = false;

  /**
   * Register a subscriber
   */
  registerSubscriber(subscriber: Subscriber): void {
    for (const subject of subscriber.subjects) {
      if (!this.subscribers.has(subject)) {
        this.subscribers.set(subject, []);
      }
      this.subscribers.get(subject)!.push(subscriber);
    }
  }

  /**
   * Add middleware to the processing chain
   */
  use(middleware: any): void {
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
    await this.ensureTopology();

    // Start subscriptions for each unique subject
    const subjects = Array.from(this.subscribers.keys());

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
   * Ensure JetStream topology (stream) exists
   */
  private async ensureTopology(): Promise<void> {
    const js = connection.getJetStream();
    const jsm = await connection.getConnection().jetstreamManager();
    const cfg = config.get();
    const streamName = config.streamName;
    const logger = config.logger;

    try {
      // Try to get existing stream
      await jsm.streams.info(streamName);
      logger.debug('Stream already exists', { stream: streamName });
    } catch (error: any) {
      if (error.code === '404') {
        // Stream doesn't exist, create it
        logger.info('Creating stream...', { stream: streamName });

        const subjects = [`${cfg.env}.events.>`];
        if (cfg.useDlq) {
          subjects.push(config.dlqSubject);
        }

        await jsm.streams.add({
          name: streamName,
          subjects,
          retention: 'limits',
          max_age: toNanos(7 * 24 * 60 * 60 * 1000), // 7 days in nanoseconds
          storage: 'file',
          num_replicas: 1,
          discard: 'old',
        });

        logger.info('Stream created successfully', { stream: streamName });
      } else {
        throw error;
      }
    }
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
          await this.processMessage(msg, subject);
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
   * Process a single message
   */
  private async processMessage(msg: JsMsg, subject: string): Promise<void> {
    const logger = config.logger;
    const subscribers = this.subscribers.get(subject) || [];

    try {
      const data = JSON.parse(msg.data.toString());
      const envelope = data;

      const metadata: EventMetadata = {
        event_id: envelope.event_id,
        subject: msg.subject,
        domain: this.extractDomain(msg.subject),
        resource: envelope.resource_type,
        action: envelope.event_type,
        stream: msg.info?.stream,
        stream_seq: msg.seq,
        deliveries: msg.info?.delivered,
        trace_id: envelope.trace_id,
      };

      logger.debug('Processing message', {
        subject: msg.subject,
        event_id: metadata.event_id,
        deliveries: metadata.deliveries,
      });

      // Process through each subscriber
      for (const subscriber of subscribers) {
        await this.middlewareChain.execute(envelope.payload, metadata, async () => {
          await subscriber.call(envelope.payload, metadata);
        });
      }

      // Acknowledge the message
      msg.ack();

      logger.debug('Message processed successfully', {
        subject: msg.subject,
        event_id: metadata.event_id,
      });
    } catch (error) {
      logger.error('Failed to process message', {
        subject: msg.subject,
        error,
      });

      // Check if we've exceeded max_deliver
      if (msg.info && msg.info.delivered >= (config.get().maxDeliver || 5)) {
        logger.warn('Message exceeded max_deliver, moving to DLQ', {
          subject: msg.subject,
          deliveries: msg.info.delivered,
        });
        msg.ack(); // Ack to remove from original subject
        // In production, you'd publish to DLQ here
      } else {
        msg.nak(); // Negative acknowledge for retry
      }
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

  /**
   * Extract domain from subject
   */
  private extractDomain(subject: string): string {
    const parts = subject.split('.');
    return parts.length >= 3 ? parts[2] : '';
  }
}

export default new Consumer();
