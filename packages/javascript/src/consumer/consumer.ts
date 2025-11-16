import {
  AckPolicy,
  ConsumerConfig,
  DeliverPolicy,
  DiscardPolicy,
  JsMsg,
  ReplayPolicy,
  RetentionPolicy,
  StorageType,
} from 'nats';
import { EventMetadata, Middleware, Subscriber } from '../types';
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
    const jsm = await connection.getConnection().jetstreamManager();
    const cfg = config.get();
    const streamName = config.streamName;
    const logger = config.logger;

    try {
      // Try to get existing stream
      await jsm.streams.info(streamName);
      logger.debug('Stream already exists', { stream: streamName });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === '404') {
        // Stream doesn't exist, create it
        logger.info('Creating stream...', { stream: streamName });

        const subjects = [`${cfg.env}.events.>`];
        if (cfg.useDlq) {
          subjects.push(config.dlqSubject);
        }

        await jsm.streams.add({
          name: streamName,
          subjects,
          retention: RetentionPolicy.Limits,
          max_age: toNanos(7 * 24 * 60 * 60 * 1000), // 7 days in nanoseconds
          storage: StorageType.File,
          num_replicas: 1,
          discard: DiscardPolicy.Old,
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
        deliveries: msg.info?.deliveryCount,
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

      await this.handleFailure(msg, error);
    }
  }

  /**
   * Handle processing failures with DLQ support
   */
  private async handleFailure(msg: JsMsg, error: unknown): Promise<void> {
    const logger = config.logger;
    const cfg = config.get();
    const deliveries = msg.info?.deliveryCount ?? 0;
    const maxDeliver = cfg.maxDeliver || 5;
    const exceededMaxDeliver = deliveries >= maxDeliver;

    if (cfg.useDlq) {
      try {
        await this.publishToDlq(
          msg,
          error,
          exceededMaxDeliver ? 'max_deliver_exceeded' : 'handler_error'
        );
        // Only ack after DLQ publish succeeds
        msg.ack();
        return;
      } catch (dlqError) {
        logger.error('Failed to publish to DLQ', { subject: msg.subject, error: dlqError });
        // Fall through to NAK so the message can be retried
      }
    }

    if (exceededMaxDeliver) {
      logger.warn('Message exceeded max_deliver; dropping', {
        subject: msg.subject,
        deliveries,
      });
      msg.ack();
    } else {
      msg.nak(); // Negative acknowledge for retry
    }
  }

  /**
   * Publish a failed message to the DLQ with context
   */
  private async publishToDlq(msg: JsMsg, error: unknown, reason: string): Promise<void> {
    const js = connection.getJetStream();
    const cfg = config.get();
    const rawPayload = msg.data?.toString() ?? '';
    let parsedPayload: unknown;

    try {
      parsedPayload = JSON.parse(rawPayload);
    } catch {
      parsedPayload = rawPayload; // Keep raw if not JSON
    }

    const payload = {
      event_id:
        (parsedPayload as { event_id?: string })?.event_id ||
        msg.headers?.get('nats-msg-id') ||
        msg.sid.toString(),
      original_subject: msg.subject,
      payload: parsedPayload,
      deliveries: msg.info?.deliveryCount ?? 0,
      reason,
      error:
        error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? 'unknown'),
      occurred_at: new Date().toISOString(),
    };

    if (!cfg.dlqSubject) {
      throw new Error('DLQ subject is not configured');
    }

    await js.publish(cfg.dlqSubject, Buffer.from(JSON.stringify(payload)));
    config.logger.warn('Message moved to DLQ', {
      subject: msg.subject,
      deliveries: msg.info?.deliveryCount,
      reason,
    });
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
