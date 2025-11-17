import { OutboxRepository, OutboxStatus, PublishResult, CreateOutboxEventParams } from './types';
import { Logger } from '../types';
import config from '../core/config';

/**
 * OutboxPublisher - Handles publishing messages using the Outbox pattern
 *
 * The Outbox pattern ensures reliable message delivery by:
 * 1. Persisting the message to the database before publishing
 * 2. Publishing to NATS
 * 3. Marking as sent in the database
 *
 * This prevents message loss if the application crashes between publishing and commit
 *
 * Design Patterns:
 * - Repository Pattern: Abstracts database operations
 * - Template Method: Defines the publish flow
 * - Dependency Injection: Repository and logger are injected
 *
 * @example
 * ```typescript
 * const publisher = new OutboxPublisher(repository, logger);
 * const result = await publisher.publish({
 *   eventId: 'event-123',
 *   subject: 'production.app.order.created',
 *   payload: JSON.stringify(envelope),
 *   headers: JSON.stringify({ 'nats-msg-id': 'event-123' })
 * }, async () => {
 *   // Actual NATS publish logic
 *   await js.publish(subject, payload);
 * });
 * ```
 */
export class OutboxPublisher {
  private readonly repository: OutboxRepository;
  private readonly logger: Logger;

  constructor(repository: OutboxRepository, logger?: Logger) {
    this.repository = repository;
    this.logger = logger || config.logger;
  }

  /**
   * Publish a message using the Outbox pattern
   *
   * @param params - Outbox event parameters
   * @param publishFn - Function that performs the actual NATS publish
   * @returns PublishResult indicating success or failure
   */
  async publish(
    params: CreateOutboxEventParams,
    publishFn: () => Promise<void>
  ): Promise<PublishResult> {
    const { eventId, subject } = params;

    try {
      // Step 1: Find or create outbox event (idempotency)
      const event = await this.repository.findOrCreate(params);

      // Step 2: Check if already sent (idempotency)
      if (event.status === OutboxStatus.SENT && event.sentAt) {
        this.logger.info('Outbox event already sent, skipping publish', {
          eventId,
          subject,
          sentAt: event.sentAt,
        });
        return {
          success: true,
          eventId,
          subject,
          details: 'Already sent (idempotent)',
        };
      }

      // Step 3: Mark as publishing
      await this.repository.markAsPublishing(eventId);
      await this.repository.incrementAttempts(eventId);

      this.logger.debug('Publishing outbox event', {
        eventId,
        subject,
        attempts: event.attempts + 1,
      });

      // Step 4: Attempt to publish to NATS
      await publishFn();

      // Step 5: Mark as sent on success
      await this.repository.markAsSent(eventId);

      this.logger.info('Outbox event published successfully', {
        eventId,
        subject,
      });

      return {
        success: true,
        eventId,
        subject,
      };
    } catch (error) {
      // Step 6: Mark as failed on error
      const errorMessage = error instanceof Error ? error.message : String(error);

      try {
        await this.repository.markAsFailed(eventId, errorMessage);
      } catch (repoError) {
        this.logger.error('Failed to mark outbox event as failed', {
          eventId,
          subject,
          error: repoError,
        });
      }

      this.logger.error('Outbox event publish failed', {
        eventId,
        subject,
        error: errorMessage,
      });

      return {
        success: false,
        eventId,
        subject,
        reason: 'publish_failed',
        details: errorMessage,
        error: error instanceof Error ? error : new Error(errorMessage),
      };
    }
  }

  /**
   * Publish a batch of pending events
   * Useful for background workers processing the outbox
   *
   * @param limit - Maximum number of events to process
   * @returns Array of publish results
   */
  async publishPending(
    limit: number = 100,
    publishFn: (eventId: string, subject: string, payload: string, headers: string) => Promise<void>
  ): Promise<PublishResult[]> {
    const pendingEvents = await this.repository.findPending({ limit });

    this.logger.info('Processing pending outbox events', {
      count: pendingEvents.length,
    });

    const results: PublishResult[] = [];

    for (const event of pendingEvents) {
      const result = await this.publish(
        {
          eventId: event.eventId,
          subject: event.subject,
          payload: event.payload,
          headers: event.headers,
          enqueuedAt: event.enqueuedAt,
        },
        async () => {
          await publishFn(event.eventId, event.subject, event.payload, event.headers);
        }
      );

      results.push(result);
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    this.logger.info('Finished processing pending outbox events', {
      total: results.length,
      success: successCount,
      failed: failureCount,
    });

    return results;
  }

  /**
   * Cleanup old sent events
   * Should be run periodically to prevent unbounded growth
   *
   * @param retentionDays - Number of days to retain sent events
   * @returns Number of events deleted
   */
  async cleanup(retentionDays: number = 7): Promise<number> {
    const olderThan = new Date();
    olderThan.setDate(olderThan.getDate() - retentionDays);

    const deletedCount = await this.repository.cleanup(olderThan);

    this.logger.info('Cleaned up old outbox events', {
      deletedCount,
      retentionDays,
      olderThan,
    });

    return deletedCount;
  }

  /**
   * Reset stale publishing events
   * Events stuck in "publishing" state for too long are reset to pending
   *
   * @param staleDurationMinutes - Duration in minutes to consider an event stale
   * @returns Number of events reset
   */
  async resetStale(staleDurationMinutes: number = 5): Promise<number> {
    const olderThan = new Date();
    olderThan.setMinutes(olderThan.getMinutes() - staleDurationMinutes);

    const resetCount = await this.repository.resetStalePublishing(olderThan);

    this.logger.info('Reset stale publishing outbox events', {
      resetCount,
      staleDurationMinutes,
      olderThan,
    });

    return resetCount;
  }
}

/**
 * Create a PublishResult for success
 */
export function successResult(eventId: string, subject: string, details?: string): PublishResult {
  return {
    success: true,
    eventId,
    subject,
    details,
  };
}

/**
 * Create a PublishResult for failure
 */
export function failureResult(
  eventId: string,
  subject: string,
  reason: string,
  details?: string,
  error?: Error
): PublishResult {
  return {
    success: false,
    eventId,
    subject,
    reason,
    details,
    error,
  };
}
