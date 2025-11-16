import { JsMsg } from 'nats';
import { EventMetadata, Subscriber } from '../types';
import config from '../core/config';
import { Subject } from '../core/subject';
import { MiddlewareChain } from '../middleware/chain';
import { DlqHandler } from '../dlq/dlq-handler';

/**
 * MessageProcessor handles message processing logic
 *
 * Responsibilities:
 * - Parse message envelopes
 * - Execute middleware chain
 * - Run subscribers with concurrency control
 * - Handle timeouts
 * - Coordinate with DLQ handler on failures
 */
export class MessageProcessor {
  constructor(
    private middlewareChain: MiddlewareChain,
    private dlqHandler: DlqHandler
  ) {}

  /**
   * Process a single message through middleware and subscribers
   *
   * @param msg - NATS message to process
   * @param subscribers - Subscribers to execute for this message
   */
  async processMessage(msg: JsMsg, subscribers: Subscriber[]): Promise<void> {
    const logger = config.logger;

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

      // Process through each subscriber (run with controlled concurrency)
      const results = await this.executeSubscribers(envelope.payload, metadata, subscribers);

      const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];

      if (failed.length === 0) {
        // Acknowledge the message
        msg.ack();
        logger.debug('Message processed successfully', {
          subject: msg.subject,
          event_id: metadata.event_id,
        });
        return;
      }

      // If any subscriber failed, route to DLQ with failed subscriber names
      const failedNames = failed.map((_, idx) => subscribers[idx].constructor.name);
      await this.dlqHandler.handleFailure(
        msg,
        new Error(`Subscriber failures: ${failedNames.join(',')}`),
        {
          failedSubscribers: failedNames,
        }
      );
    } catch (error) {
      logger.error('Failed to process message', {
        subject: msg.subject,
        error,
      });

      await this.dlqHandler.handleFailure(msg, error);
    }
  }

  /**
   * Execute all subscribers with controlled concurrency
   */
  private async executeSubscribers(
    payload: Record<string, unknown>,
    metadata: EventMetadata,
    subscribers: Subscriber[]
  ): Promise<Array<PromiseSettledResult<{ subscriber: string; durationMs: number }>>> {
    const cfg = config.get();
    const limit = Math.max(1, cfg.perMessageConcurrency || subscribers.length || 1);
    const results: Array<PromiseSettledResult<{ subscriber: string; durationMs: number }>> = [];

    let index = 0;
    const runNext = async (): Promise<void> => {
      if (index >= subscribers.length) return;
      const currentIndex = index++;
      const subscriber = subscribers[currentIndex];
      const start = Date.now();

      const exec = async () => {
        await this.middlewareChain.execute(payload, metadata, async () => {
          // Ensure subscriber has a handle method
          if (!subscriber.handle) {
            throw new Error(
              `Subscriber ${subscriber.constructor?.name || 'unknown'} missing handle() method`
            );
          }

          // Per-subscriber timeout guard
          if (cfg.subscriberTimeoutMs && cfg.subscriberTimeoutMs > 0) {
            let timeoutId: NodeJS.Timeout | undefined;
            try {
              await Promise.race([
                subscriber.handle(payload, metadata),
                new Promise((_, reject) => {
                  timeoutId = setTimeout(
                    () => reject(new Error('subscriber_timeout')),
                    cfg.subscriberTimeoutMs
                  );
                  // Use unref() to allow process to exit even if timeout is pending
                  timeoutId?.unref();
                }),
              ]);
            } finally {
              // Always clear the timeout to prevent leaks
              if (timeoutId !== undefined) {
                clearTimeout(timeoutId);
              }
            }
          } else {
            await subscriber.handle(payload, metadata);
          }
        });
        return { subscriber: subscriber.constructor.name, durationMs: Date.now() - start };
      };

      results[currentIndex] = await exec()
        .then((value) => ({ status: 'fulfilled', value }) as const)
        .catch((reason) => ({ status: 'rejected', reason }) as const);

      await runNext();
    };

    const runners = Array.from({ length: Math.min(limit, subscribers.length) }, () => runNext());
    await Promise.all(runners);

    return results;
  }

  /**
   * Extract domain from subject
   */
  private extractDomain(subject: string): string {
    // Try parsing as event-based subject first
    const eventParsed = Subject.parseEvent(subject);
    if (eventParsed) {
      return eventParsed.domain;
    }

    // Fallback to topic-based parsing
    const topicParsed = Subject.parseTopic(subject);
    if (topicParsed) {
      // For topic-based subjects, use appName as domain
      return topicParsed.appName;
    }

    // Fallback: extract third segment for non-standard subjects
    const parts = subject.split('.');
    return parts.length >= 3 ? parts[2] : '';
  }
}
