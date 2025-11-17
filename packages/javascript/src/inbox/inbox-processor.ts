import { InboxRepository, InboxStatus, CreateInboxEventParams } from './types';
import { Logger, MessageContext } from '../types';
import config from '../core/config';

/**
 * InboxProcessor - Handles idempotent message processing using the Inbox pattern
 *
 * The Inbox pattern ensures messages are processed exactly once by:
 * 1. Checking if message was already processed (by event_id or stream_seq)
 * 2. Marking message as processing
 * 3. Processing the message
 * 4. Marking as processed
 *
 * This prevents duplicate processing of the same message, which is critical for:
 * - Financial transactions
 * - Order processing
 * - Any operation that shouldn't be repeated
 *
 * Design Patterns:
 * - Repository Pattern: Abstracts database operations
 * - Template Method: Defines the processing flow
 * - Dependency Injection: Repository and logger are injected
 *
 * @example
 * ```typescript
 * const processor = new InboxProcessor(repository, logger);
 * const result = await processor.process(
 *   {
 *     eventId: 'event-123',
 *     subject: 'production.app.order.created',
 *     payload: JSON.stringify(message),
 *     headers: JSON.stringify(natsHeaders),
 *     deliveries: 1
 *   },
 *   async (message, context) => {
 *     // Your message processing logic
 *     await orderService.createOrder(message);
 *   },
 *   context
 * );
 * ```
 */
export class InboxProcessor {
  private readonly repository: InboxRepository;
  private readonly logger: Logger;

  constructor(repository: InboxRepository, logger?: Logger) {
    this.repository = repository;
    this.logger = logger || config.logger;
  }

  /**
   * Process a message using the Inbox pattern
   *
   * @param params - Inbox event parameters
   * @param processFn - Function that processes the message
   * @param context - Message context
   * @returns Boolean indicating if message was processed (false if already processed)
   */
  async process(
    params: CreateInboxEventParams,
    processFn: (message: Record<string, unknown>, context: MessageContext) => Promise<void>,
    context: MessageContext
  ): Promise<boolean> {
    const { eventId, subject } = params;

    try {
      // Step 1: Find or create inbox event (idempotency check)
      const { event, alreadyExists } = await this.repository.findOrCreate(params);

      // Step 2: Check if already processed (idempotency)
      if (alreadyExists && event.status === InboxStatus.PROCESSED && event.processedAt) {
        this.logger.info('Inbox event already processed, skipping', {
          eventId,
          subject,
          processedAt: event.processedAt,
        });
        return false; // Already processed, don't process again
      }

      this.logger.debug('Processing inbox event', {
        eventId,
        subject,
        deliveries: params.deliveries,
      });

      // Step 3: Parse and process the message
      const message = JSON.parse(params.payload);
      await processFn(message, context);

      // Step 4: Mark as processed on success
      await this.repository.markAsProcessed(eventId);

      this.logger.info('Inbox event processed successfully', {
        eventId,
        subject,
      });

      return true; // Successfully processed
    } catch (error) {
      // Step 5: Mark as failed on error
      const errorMessage = error instanceof Error ? error.message : String(error);

      try {
        await this.repository.markAsFailed(eventId, errorMessage);
      } catch (repoError) {
        this.logger.error('Failed to mark inbox event as failed', {
          eventId,
          subject,
          error: repoError,
        });
      }

      this.logger.error('Inbox event processing failed', {
        eventId,
        subject,
        error: errorMessage,
      });

      // Re-throw to allow caller to handle (e.g., NAK the message)
      throw error;
    }
  }

  /**
   * Check if a message was already processed
   * Useful for quick idempotency checks before expensive operations
   *
   * @param eventId - Event identifier
   * @returns Boolean indicating if already processed
   */
  async isProcessed(eventId: string): Promise<boolean> {
    return await this.repository.isProcessed(eventId);
  }

  /**
   * Cleanup old processed events
   * Should be run periodically to prevent unbounded growth
   *
   * @param retentionDays - Number of days to retain processed events
   * @returns Number of events deleted
   */
  async cleanup(retentionDays: number = 30): Promise<number> {
    const olderThan = new Date();
    olderThan.setDate(olderThan.getDate() - retentionDays);

    const deletedCount = await this.repository.cleanup(olderThan);

    this.logger.info('Cleaned up old inbox events', {
      deletedCount,
      retentionDays,
      olderThan,
    });

    return deletedCount;
  }

  /**
   * Reset stale processing events
   * Events stuck in "processing" state for too long are marked as failed
   *
   * @param staleDurationMinutes - Duration in minutes to consider an event stale
   * @returns Number of events reset
   */
  async resetStale(staleDurationMinutes: number = 5): Promise<number> {
    const olderThan = new Date();
    olderThan.setMinutes(olderThan.getMinutes() - staleDurationMinutes);

    const resetCount = await this.repository.resetStaleProcessing(olderThan);

    this.logger.info('Reset stale processing inbox events', {
      resetCount,
      staleDurationMinutes,
      olderThan,
    });

    return resetCount;
  }

  /**
   * Get failed events for retry or manual intervention
   *
   * @param limit - Maximum number of events to return
   * @returns Array of failed inbox events
   */
  async getFailedEvents(limit: number = 100) {
    return await this.repository.findByStatus(InboxStatus.FAILED, { limit });
  }
}
