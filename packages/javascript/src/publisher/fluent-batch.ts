import { Publisher } from './publisher';
import { TopicPublishOptions } from './types';
import config from '../core/config';

/**
 * Result of a batch publish operation
 */
export interface FluentBatchPublishResult {
  /** Total number of messages in the batch */
  total: number;
  /** Number of successfully published messages */
  succeeded: number;
  /** Number of failed messages */
  failed: number;
  /** Detailed results for each message */
  results: Array<{
    topic: string;
    success: boolean;
    eventId?: string;
    error?: string;
  }>;
}

/**
 * Item in the batch
 */
interface BatchItem {
  topic: string;
  message: Record<string, unknown>;
}

/**
 * FluentBatchPublisher provides a modern fluent API for publishing multiple messages efficiently.
 * Messages are published in parallel with optimized error handling.
 *
 * @example
 * ```typescript
 * const result = await NatsPubsub.batch()
 *   .add('user.created', { id: 1, name: 'Alice' })
 *   .add('user.created', { id: 2, name: 'Bob' })
 *   .add('notification.sent', { userId: 1 })
 *   .withOptions({ traceId: 'batch-123' })
 *   .publish();
 *
 * console.log(`Published ${result.succeeded}/${result.total} messages`);
 * ```
 */
export class FluentBatchPublisher {
  private items: BatchItem[] = [];
  private options: TopicPublishOptions = {};
  private publisher: Publisher;

  constructor(publisher?: Publisher) {
    this.publisher = publisher || new Publisher();
  }

  /**
   * Add a message to the batch
   *
   * @param topic - Topic to publish to
   * @param message - Message payload
   * @returns this for chaining
   */
  add(topic: string, message: Record<string, unknown>): this {
    this.items.push({ topic, message });
    return this;
  }

  /**
   * Set options that will be applied to all messages in the batch
   *
   * @param options - Publish options (traceId, correlationId, etc.)
   * @returns this for chaining
   */
  withOptions(options: TopicPublishOptions): this {
    this.options = { ...this.options, ...options };
    return this;
  }

  /**
   * Publish all messages in the batch
   *
   * Messages are published in parallel using Promise.allSettled to ensure
   * all messages are attempted even if some fail.
   *
   * @returns FluentBatchPublishResult with success/failure details
   */
  async publish(): Promise<FluentBatchPublishResult> {
    if (this.items.length === 0) {
      return {
        total: 0,
        succeeded: 0,
        failed: 0,
        results: [],
      };
    }

    const logger = config.get().logger;
    logger?.debug(`Publishing batch of ${this.items.length} messages`);

    // Publish all messages in parallel
    const promises = this.items.map(async (item) => {
      try {
        await this.publisher.publishToTopic(item.topic, item.message, this.options);
        return {
          topic: item.topic,
          success: true as const,
          eventId: this.options.event_id,
        };
      } catch (error) {
        logger?.error(`Batch publish failed for topic ${item.topic}:`, { error });
        return {
          topic: item.topic,
          success: false as const,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    const results = await Promise.allSettled(promises);

    // Process results
    const mappedResults = results.map((result) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        // This shouldn't happen since we catch errors above, but handle it anyway
        return {
          topic: 'unknown',
          success: false as const,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        };
      }
    });

    const succeeded = mappedResults.filter((r) => r.success).length;
    const failed = mappedResults.filter((r) => !r.success).length;

    logger?.info(
      `Batch publish completed: ${succeeded}/${this.items.length} succeeded, ${failed} failed`
    );

    return {
      total: this.items.length,
      succeeded,
      failed,
      results: mappedResults,
    };
  }

  /**
   * Clear all items from the batch
   *
   * @returns this for chaining
   */
  clear(): this {
    this.items = [];
    return this;
  }

  /**
   * Get the number of items in the batch
   *
   * @returns number of items
   */
  get size(): number {
    return this.items.length;
  }
}
